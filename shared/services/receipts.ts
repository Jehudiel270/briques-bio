/**
 * Service réceptions : pesée à l'arrivée, décisions par type de plastique, création des lots de matière
 * (kg acceptés = `available`, kg en quarantaine = `quarantine`, kg rejetés = aucun lot), mouvements d'entrée,
 * rémunération SIMULÉE du collecteur.
 */
import type { CollectionStatus, Id, PolymerCode, RawLot, Receipt, ReceiptLine } from '../types/domain'
import type { Db } from '../utils/db-core'
import { fcfa } from '../utils/format'
import { POLYMER_LABEL } from '../utils/labels'
import { fail } from './errors'
import { addMovement, guard, nearly, need, notifySupplier, qtyOf, round2, settingsOf, statusIn } from './helpers'

type LineInput = {
  polymer: PolymerCode
  weighedKg: number
  acceptedKg: number
  rejectedKg: number
  quarantineKg: number
  contaminationPct?: number
  decision: ReceiptLine['decision']
  reason?: string
}

const RECEIVABLE: CollectionStatus[] = ['collected', 'weighed']

/** Emplacement des lots acceptés : celui où le même polymère est déjà stocké, sinon le premier emplacement de matière. */
function rawLocationFor(db: Db, polymer: PolymerCode): Id {
  const same = db.raw('rawLots').find((l) => l.polymer === polymer && l.status === 'available')
  const loc = same ? db.peek('stockLocations', same.locationId) : undefined
  if (loc?.kind === 'raw') return loc.id
  return need(db.raw('stockLocations').find((l) => l.kind === 'raw'), 'Un emplacement de stockage de matière première').id
}

const quarantineLocation = (db: Db): Id =>
  need(db.raw('stockLocations').find((l) => l.kind === 'quarantine'), 'La zone de quarantaine').id

export function confirm(db: Db, input: { collectionId?: Id; supplierId: Id; lines: LineInput[]; notes?: string }): Receipt {
  guard(db, 'receipts.confirm')
  const supplier = need(db.peek('suppliers', input.supplierId), 'Le fournisseur')
  if (supplier.status !== 'approved') fail(`${supplier.name} n’est pas un fournisseur approuvé : validez son profil avant de réceptionner.`)
  const collection = input.collectionId ? need(db.peek('collections', input.collectionId), 'La collecte') : undefined
  if (collection) {
    if (collection.supplierId !== supplier.id) fail(`${collection.ref} appartient à un autre fournisseur : vérifiez la collecte choisie.`)
    statusIn(collection.status, RECEIVABLE, collection.status === 'received'
      ? `${collection.ref} a déjà été réceptionnée.`
      : `${collection.ref} ne peut pas être réceptionnée (statut actuel : ${collection.status}) : elle doit d’abord être enlevée par le chauffeur (statut « collectée » ou « pesée »).`)
  }
  if (!input.lines?.length) fail('Ajoutez au moins une ligne de pesée (type de plastique et poids).')

  const settings = settingsOf(db)
  const lines: ReceiptLine[] = []
  const seen = new Set<PolymerCode>()
  for (const l of input.lines) {
    const name = POLYMER_LABEL[l.polymer] ?? l.polymer
    const rule = settings.polymers.find((p) => p.code === l.polymer) ?? fail(`Type de plastique inconnu : ${l.polymer}.`)
    if (seen.has(l.polymer)) fail(`${name} apparaît deux fois : regroupez les pesées d’un même type de plastique sur une seule ligne.`)
    seen.add(l.polymer)
    const weighed = qtyOf(l.weighedKg, `Le poids pesé de ${name}`)
    const accepted = qtyOf(l.acceptedKg ?? 0, `Les kg acceptés de ${name}`, { allowZero: true })
    const rejected = qtyOf(l.rejectedKg ?? 0, `Les kg rejetés de ${name}`, { allowZero: true })
    const quarantine = qtyOf(l.quarantineKg ?? 0, `Les kg en quarantaine de ${name}`, { allowZero: true })
    if (!nearly(accepted + rejected + quarantine, weighed)) {
      fail(`${name} : accepté + rejeté + quarantaine (${round2(accepted + rejected + quarantine)} kg) doit égaler le poids pesé (${round2(weighed)} kg).`)
    }
    if (!rule.accepted && accepted > 0) fail(`${name} n’est pas accepté actuellement : rejetez ces kg ou placez-les en quarantaine.`, 'polymer_refused')
    const decision: ReceiptLine['decision'] = nearly(accepted, weighed) ? 'accepted' : nearly(rejected, weighed) ? 'rejected' : nearly(quarantine, weighed) ? 'quarantine' : 'partial'
    lines.push({
      polymer: l.polymer, weighedKg: weighed, acceptedKg: accepted, rejectedKg: rejected, quarantineKg: quarantine,
      contaminationPct: l.contaminationPct, decision, reason: l.reason?.trim() || undefined,
    })
  }

  const weighedTotal = round2(lines.reduce((s, l) => s + l.weighedKg, 0))
  const acceptedTotal = round2(lines.reduce((s, l) => s + l.acceptedKg, 0))
  const rateOf = (code: PolymerCode) => settings.polymers.find((p) => p.code === code)?.pricePerKg ?? 0
  const payoutAmount = Math.round(lines.reduce((s, l) => s + l.acceptedKg * rateOf(l.polymer), 0))
  const withPayout = settings.features.collectorPayouts && supplier.paymentModel === 'per_kg' && acceptedTotal > 0 && payoutAmount > 0

  const receipt = db.create('receipts', {
    ref: db.nextRef('receipts', 'RCP'), collectionId: collection?.id, supplierId: supplier.id, receivedAt: db.now(), receivedBy: db.actor()?.id ?? 'system',
    declaredKg: collection?.estimatedTotalKg ?? weighedTotal, weighedKg: weighedTotal, lines, status: 'closed',
    payout: withPayout ? { amount: payoutAmount, status: 'pending' } : undefined, notes: input.notes?.trim() || undefined,
  }, { via: 'receipts.confirm', summary: `Réception pesée · ${supplier.name}` }) as Receipt

  const createLot = (line: ReceiptLine, kg: number, status: RawLot['status'], locationId: Id) => {
    const lot = db.create('rawLots', {
      ref: db.nextRef('rawLots', 'MP'), receiptId: receipt.id, supplierId: supplier.id, polymer: line.polymer, kgInitial: kg, kgAvailable: kg, kgReserved: 0,
      kgConsumed: 0, locationId, status, receivedAt: receipt.receivedAt, notes: status === 'quarantine' ? line.reason ?? 'Placé en quarantaine à la réception.' : undefined,
    }, { via: 'receipts.confirm', summary: `Lot de matière · ${receipt.ref} · ${line.polymer}` }) as RawLot
    addMovement(db, 'receipts.confirm', { type: 'in', itemKind: 'raw', itemId: lot.id, qty: kg, unit: 'kg', toLocationId: locationId, refType: 'receipt', refId: receipt.id, note: status === 'quarantine' ? 'Entrée en quarantaine' : undefined })
    return lot
  }
  for (const line of lines) {
    if (line.acceptedKg > 0) createLot(line, line.acceptedKg, 'available', rawLocationFor(db, line.polymer))
    if (line.quarantineKg > 0) createLot(line, line.quarantineKg, 'quarantine', quarantineLocation(db))
    // kg rejetés : aucun lot (contrat §7)
  }

  if (collection) {
    db.update('collections', collection.id, {
      status: 'received', receiptId: receipt.id, history: [...collection.history, db.history('Réceptionnée', `${receipt.ref} · ${weighedTotal} kg pesés, ${acceptedTotal} kg acceptés`)],
    }, { via: 'receipts.confirm' })
  }
  const rejectedTotal = round2(lines.reduce((s, l) => s + l.rejectedKg, 0))
  notifySupplier(db, supplier.id, {
    title: 'Réception enregistrée',
    body: `${receipt.ref} : ${weighedTotal} kg pesés, ${acceptedTotal} kg acceptés${rejectedTotal ? `, ${rejectedTotal} kg rejetés` : ''}${withPayout ? `. Rémunération simulée : ${fcfa(payoutAmount)}.` : '.'}`,
    level: rejectedTotal > 0 ? 'warning' : 'success', href: collection ? `/collecte/demandes/${collection.id}` : '/collecte/historique',
  })
  return receipt
}

export function pay(db: Db, receiptId: Id): Receipt {
  guard(db, 'receipts.pay')
  const receipt = need(db.peek('receipts', receiptId), 'La réception')
  if (!receipt.payout) fail(`${receipt.ref} n’a pas de rémunération à verser (aucun kg accepté, fournisseur non rémunéré ou rémunération désactivée).`)
  if (receipt.payout.status === 'paid_simulated') fail(`La rémunération de ${receipt.ref} est déjà versée (simulé).`)
  const paidAt = db.now()
  db.update('receipts', receipt.id, {
    payout: { ...receipt.payout, status: 'paid_simulated', ref: `SIM-PAY-${receipt.ref.replace(/^RCP-/, '')}`, paidAt },
  }, { via: 'receipts.pay', summary: `Rémunération simulée · ${receipt.ref} · ${fcfa(receipt.payout.amount)}` })
  notifySupplier(db, receipt.supplierId, {
    title: 'Rémunération simulée versée', body: `${receipt.ref} : ${fcfa(receipt.payout.amount)} (paiement simulé, aucune transaction réelle).`,
    level: 'success', href: '/collecte/paiements',
  })
  return db.peek('receipts', receiptId)!
}

export const receipts = { confirm, pay }
