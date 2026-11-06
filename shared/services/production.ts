/**
 * Service production : ordres de fabrication, réservation de matière (lots `available` uniquement),
 * suivi, clôture → lot de produits finis `pending_qc` avec traçabilité amont (`rawInputs`).
 *
 * `record` enregistre des TOTAUX cumulés (pas des incréments) : valeurs courantes de l'ordre.
 */
import type { Id, ProductionEvent, ProductionLot, RawLot, WorkOrder, WorkOrderStatus } from '../types/domain'
import { uid, type Db } from '../utils/db-core'
import { fdate } from '../utils/format'
import { fail } from './errors'
import { addMovement, dateOf, guard, need, notifyRoles, qtyOf, round2, statusIn, text } from './helpers'
import { rawStockByPolymer } from './pricing'

const opsHref = (w: WorkOrder) => `/ops/production/ordres/${w.id}`
const reservedKg = (w: WorkOrder) => round2(w.reservations.reduce((s, r) => s + r.kg, 0))
const OPEN: WorkOrderStatus[] = ['draft', 'planned', 'materials_reserved', 'in_progress', 'paused']

/** Alerte (une seule fois) quand le disponible d'un polymère passe sous son seuil. */
function alertThresholds(db: Db, before: ReturnType<typeof rawStockByPolymer>) {
  const after = rawStockByPolymer(db)
  for (const code of Object.keys(after) as (keyof typeof after)[]) {
    if (after[code].belowThreshold && !before[code].belowThreshold) {
      notifyRoles(db, ['procurement', 'production'], {
        title: 'Stock matière à surveiller', body: `Le stock disponible de ${code} (${round2(after[code].available)} kg) passe sous le seuil d’alerte (${after[code].thresholdKg} kg).`,
        level: 'warning', href: '/ops/appro/stock',
      })
    }
  }
}

export function createOrder(db: Db, input: {
  productId: Id
  plannedQty: number
  plannedStart: string
  plannedEnd: string
  operatorIds: Id[]
  internalRecipeNote?: string
}): WorkOrder {
  const a = guard(db, 'production.createOrder')
  const product = need(db.peek('products', input.productId), 'Le produit')
  const plannedQty = qtyOf(input.plannedQty, 'La quantité à produire', { integer: true })
  const start = dateOf(input.plannedStart, 'La date de début')
  const end = dateOf(input.plannedEnd, 'La date de fin')
  if (+end < +start) fail('La date de fin doit être postérieure à la date de début.')
  if (!input.operatorIds?.length) fail('Affectez au moins un opérateur à l’ordre de fabrication.')
  for (const oid of input.operatorIds) {
    const op = need(db.peek('operators', oid), 'L’opérateur')
    if (!op.active) fail(`${op.name} est inactif : choisissez un autre opérateur.`)
  }
  if (!product.unitWeightKg) fail(`Renseignez le poids unitaire de « ${product.name} » avant de planifier sa fabrication (besoin en matière).`)
  const materialKgPlanned = Math.ceil(plannedQty * product.unitWeightKg * 1.05)
  const wo = db.create('workOrders', {
    ref: db.nextRef('workOrders', 'OF'), productId: product.id, plannedQty, producedQty: 0, scrapQty: 0, status: 'planned',
    plannedStart: start.toISOString(), plannedEnd: end.toISOString(), materialKgPlanned, materialKgConsumed: 0, reservations: [],
    operatorIds: [...new Set(input.operatorIds)], supervisorId: a?.id, internalRecipeNote: input.internalRecipeNote?.trim() || undefined,
    history: [db.history('Ordre créé', `${plannedQty} × ${product.name} · matière estimée ${materialKgPlanned} kg (marge de 5 % de démonstration)`)],
  }, { via: 'production.createOrder', summary: `Création · ordre de fabrication ${product.ref}` }) as WorkOrder
  notifyRoles(db, ['procurement'], { title: 'Matière à prévoir', body: `${wo.ref} : ${materialKgPlanned} kg de matière estimés pour le ${fdate(start)}.`, level: 'info', href: '/ops/appro/lots-matiere' })
  return wo
}

export function reserve(db: Db, id: Id, allocations: { rawLotId: Id; kg: number }[] | 'auto' = 'auto'): WorkOrder {
  guard(db, 'production.reserve')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, OPEN, `${wo.ref} est ${wo.status === 'completed' ? 'clôturé' : 'annulé'} : la matière ne peut plus être réservée.`)
  const picks = new Map<Id, number>()

  if (allocations === 'auto') {
    const target = round2(wo.materialKgPlanned - reservedKg(wo))
    if (target <= 0) fail(`${wo.ref} a déjà toute sa matière réservée (${reservedKg(wo)} kg).`)
    const lots = db.raw('rawLots')
      .filter((l) => l.status === 'available' && l.kgAvailable > 0)
      .sort((x, y) => x.receivedAt.localeCompare(y.receivedAt) || x.ref.localeCompare(y.ref))
    const availableKg = round2(lots.reduce((s, l) => s + l.kgAvailable, 0))
    if (availableKg + 0.0005 < target) {
      fail(`Matière disponible insuffisante pour ${wo.ref} : ${target} kg nécessaires, ${availableKg} kg disponibles (il manque ${round2(target - availableKg)} kg). Réceptionnez de la matière ou réduisez la quantité de l’ordre.`, 'stock_insufficient')
    }
    let left = target
    for (const lot of lots) {
      if (left <= 0) break
      const take = round2(Math.min(lot.kgAvailable, left))
      picks.set(lot.id, take)
      left = round2(left - take)
    }
  } else {
    if (!allocations.length) fail('Indiquez au moins un lot de matière à réserver, ou choisissez la réservation automatique.')
    for (const al of allocations) picks.set(al.rawLotId, round2((picks.get(al.rawLotId) ?? 0) + qtyOf(al.kg, 'La quantité réservée')))
    for (const [lotId, kg] of picks) {
      const lot = need(db.peek('rawLots', lotId), 'Le lot de matière')
      if (lot.status !== 'available') fail(`${lot.ref} est ${lot.status === 'quarantine' ? 'en quarantaine' : lot.status === 'rejected' ? 'rejeté' : 'épuisé'} : seule la matière disponible peut être réservée.`, 'lot_unavailable')
      if (kg > lot.kgAvailable + 0.0005) fail(`${lot.ref} n’a que ${round2(lot.kgAvailable)} kg disponibles pour ${kg} kg demandés.`, 'stock_insufficient')
    }
  }

  const before = rawStockByPolymer(db)
  const reservations = wo.reservations.map((r) => ({ ...r }))
  for (const [lotId, kg] of picks) {
    const lot = db.peek('rawLots', lotId)!
    db.update('rawLots', lotId, { kgAvailable: round2(lot.kgAvailable - kg), kgReserved: round2(lot.kgReserved + kg) }, { via: 'production.reserve', silent: true })
    addMovement(db, 'production.reserve', { type: 'reservation', itemKind: 'raw', itemId: lotId, qty: kg, unit: 'kg', refType: 'work_order', refId: wo.id })
    const existing = reservations.find((r) => r.rawLotId === lotId)
    if (existing) existing.kg = round2(existing.kg + kg)
    else reservations.push({ rawLotId: lotId, kg })
  }
  const total = round2([...picks.values()].reduce((s, k) => s + k, 0))
  db.update('workOrders', wo.id, {
    reservations, status: wo.status === 'draft' || wo.status === 'planned' ? 'materials_reserved' : wo.status,
    history: [...wo.history, db.history('Matière réservée', `${total} kg sur ${picks.size} lot(s) : ${[...picks.keys()].map((k) => db.peek('rawLots', k)?.ref).join(', ')}`)],
  }, { via: 'production.reserve' })
  alertThresholds(db, before)
  return db.peek('workOrders', wo.id)!
}

export function start(db: Db, id: Id): WorkOrder {
  guard(db, 'production.start')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  if (wo.status === 'planned' || wo.status === 'draft') fail(`Réservez la matière de ${wo.ref} avant de démarrer la production.`, 'materials_missing')
  statusIn(wo.status, ['materials_reserved'], `${wo.ref} ne peut pas être démarré (statut actuel : ${wo.status}).`)
  if (reservedKg(wo) <= 0) fail(`${wo.ref} n’a aucune matière réservée : réservez-la avant de démarrer.`, 'materials_missing')
  db.update('workOrders', id, { status: 'in_progress', actualStart: db.now(), history: [...wo.history, db.history('Production démarrée')] }, { via: 'production.start' })
  return db.peek('workOrders', id)!
}

export function pause(db: Db, id: Id): WorkOrder {
  guard(db, 'production.pause')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, ['in_progress'], `${wo.ref} n’est pas en production : seul un ordre en cours peut être mis en pause.`)
  db.update('workOrders', id, { status: 'paused', history: [...wo.history, db.history('Mis en pause')] }, { via: 'production.pause' })
  return db.peek('workOrders', id)!
}

export function resume(db: Db, id: Id): WorkOrder {
  guard(db, 'production.resume')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, ['paused'], `${wo.ref} n’est pas en pause.`)
  db.update('workOrders', id, { status: 'in_progress', history: [...wo.history, db.history('Production reprise')] }, { via: 'production.resume' })
  return db.peek('workOrders', id)!
}

export function logEvent(db: Db, id: Id, input: { type: ProductionEvent['type']; severity: ProductionEvent['severity']; description: string; durationMin?: number }): ProductionEvent {
  const a = guard(db, 'production.logEvent')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  if (wo.status === 'cancelled') fail(`${wo.ref} est annulé : aucun événement ne peut être ajouté.`)
  if (!['anomaly', 'stop', 'note'].includes(input.type)) fail('Choisissez le type d’événement (anomalie, arrêt ou note).')
  if (!['low', 'medium', 'high'].includes(input.severity)) fail('Choisissez la gravité de l’événement (faible, moyenne ou élevée).')
  const description = text(input.description, 'La description de l’événement')
  const durationMin = input.durationMin == null ? undefined : qtyOf(input.durationMin, 'La durée (minutes)', { allowZero: true })
  const ev = db.create('productionEvents', {
    id: uid('ev'), workOrderId: wo.id, type: input.type, severity: input.severity, startedAt: db.now(), durationMin, description, resolved: false, userId: a?.id,
  }, { via: 'production.logEvent', summary: `Événement de production · ${wo.ref}` }) as ProductionEvent
  db.update('workOrders', wo.id, { history: [...wo.history, db.history(input.type === 'stop' ? 'Arrêt signalé' : input.type === 'anomaly' ? 'Anomalie signalée' : 'Note ajoutée', description)] }, { via: 'production.logEvent', silent: true })
  if (input.severity === 'high') notifyRoles(db, a?.role === 'quality' ? ['production'] : ['production', 'quality'], { title: input.type === 'stop' ? 'Arrêt de production' : 'Anomalie de production grave', body: `${wo.ref} : ${description}`, level: 'danger', href: opsHref(wo) })
  return ev
}

export function record(db: Db, id: Id, input: { producedQty: number; scrapQty: number; materialKgConsumed: number }): WorkOrder {
  guard(db, 'production.record')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, ['in_progress', 'paused'], `${wo.ref} n’est pas en production : démarrez-le avant d’enregistrer des quantités.`)
  const producedQty = qtyOf(input.producedQty, 'La quantité produite', { integer: true, allowZero: true })
  const scrapQty = qtyOf(input.scrapQty, 'La quantité de rebuts', { integer: true, allowZero: true })
  const consumed = round2(qtyOf(input.materialKgConsumed, 'La matière consommée (kg)', { allowZero: true }))
  if (consumed > reservedKg(wo) + 0.0005) fail(`La matière consommée (${consumed} kg) dépasse la matière réservée (${reservedKg(wo)} kg) : réservez de la matière supplémentaire d’abord.`, 'over_reserved')
  db.update('workOrders', id, {
    producedQty, scrapQty, materialKgConsumed: consumed,
    history: [...wo.history, db.history('Production enregistrée', `${producedQty} pièces, ${scrapQty} rebut(s), ${consumed} kg de matière`)],
  }, { via: 'production.record' })
  return db.peek('workOrders', id)!
}

export function complete(db: Db, id: Id): ProductionLot {
  guard(db, 'production.complete')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, ['in_progress', 'paused'], `${wo.ref} ne peut pas être clôturé (statut actuel : ${wo.status}).`)
  if (wo.producedQty <= 0) fail(`Enregistrez la production de ${wo.ref} (pièces produites) avant de le clôturer.`, 'nothing_recorded')
  if (wo.materialKgConsumed <= 0) fail(`Enregistrez la matière consommée par ${wo.ref} avant de le clôturer (traçabilité du lot).`, 'nothing_recorded')
  const product = need(db.peek('products', wo.productId), 'Le produit')
  const before = rawStockByPolymer(db)

  // Consommation FIFO des réservations ; le non-consommé revient au disponible.
  let remaining = wo.materialKgConsumed
  const rawInputs: ProductionLot['rawInputs'] = []
  for (const r of wo.reservations) {
    const lot = need(db.peek('rawLots', r.rawLotId), 'Le lot de matière') as RawLot
    const used = round2(Math.min(r.kg, remaining))
    remaining = round2(remaining - used)
    const back = round2(r.kg - used)
    const available = round2(lot.kgAvailable + back)
    const reserved = Math.max(0, round2(lot.kgReserved - r.kg))
    db.update('rawLots', lot.id, {
      kgReserved: reserved, kgConsumed: round2(lot.kgConsumed + used), kgAvailable: available,
      status: lot.status === 'available' && available + reserved <= 0 ? 'depleted' : lot.status,
    }, { via: 'production.complete', silent: true })
    if (used > 0) {
      rawInputs.push({ rawLotId: lot.id, kg: used })
      addMovement(db, 'production.complete', { type: 'out', itemKind: 'raw', itemId: lot.id, qty: used, unit: 'kg', refType: 'work_order', refId: wo.id, note: 'Consommation en production' })
    }
    if (back > 0) addMovement(db, 'production.complete', { type: 'release', itemKind: 'raw', itemId: lot.id, qty: back, unit: 'kg', refType: 'work_order', refId: wo.id, note: 'Réservation non consommée' })
  }

  // Aire de produits finis la moins chargée
  const finished = db.raw('stockLocations').filter((l) => l.kind === 'finished')
  const load = (locId: Id) => db.raw('productionLots').filter((l) => l.locationId === locId).reduce((s, l) => s + l.availableQty + l.reservedQty, 0)
  const location = [...finished].sort((x, y) => load(x.id) - load(y.id))[0]

  const lot = db.create('productionLots', {
    ref: db.nextRef('productionLots', 'LOT'), workOrderId: wo.id, productId: wo.productId, producedQty: wo.producedQty, scrapQty: wo.scrapQty,
    availableQty: wo.producedQty, reservedQty: 0, shippedQty: 0, producedAt: db.now(), locationId: location?.id, rawInputs, qcStatus: 'pending_qc', inspectionIds: [],
  }, { via: 'production.complete', summary: `Création · lot ${product.ref} (${wo.producedQty} pièces)` }) as ProductionLot
  addMovement(db, 'production.complete', { type: 'in', itemKind: 'finished', itemId: lot.id, qty: lot.producedQty, unit: 'unit', toLocationId: location?.id, refType: 'work_order', refId: wo.id })

  db.update('workOrders', id, {
    status: 'completed', actualEnd: db.now(), lotId: lot.id, reservations: [],
    history: [...wo.history, db.history('Ordre clôturé', `${lot.ref} créé (${lot.producedQty} pièces, en attente de contrôle qualité)`)],
  }, { via: 'production.complete' })
  notifyRoles(db, ['quality'], { title: 'Lot en attente de contrôle', body: `${lot.ref} (${product.name}, ${lot.producedQty} pièces) attend une demande de contrôle.`, level: 'info', href: '/ops/qualite/lots' })
  alertThresholds(db, before)
  return lot
}

export function cancel(db: Db, id: Id, reason: string): WorkOrder {
  guard(db, 'production.cancel')
  const wo = need(db.peek('workOrders', id), 'L’ordre de fabrication')
  statusIn(wo.status, OPEN, `${wo.ref} est déjà ${wo.status === 'completed' ? 'clôturé' : 'annulé'}.`)
  const why = text(reason, 'Le motif d’annulation')
  if (wo.producedQty > 0 || wo.materialKgConsumed > 0) fail(`${wo.ref} a déjà consommé de la matière ou produit des pièces : clôturez l’ordre au lieu de l’annuler.`)
  const releasedKg = reservedKg(wo)
  for (const r of wo.reservations) {
    const lot = db.peek('rawLots', r.rawLotId)
    if (!lot) continue
    const back = Math.min(r.kg, lot.kgReserved)
    db.update('rawLots', lot.id, { kgReserved: round2(lot.kgReserved - back), kgAvailable: round2(lot.kgAvailable + back) }, { via: 'production.cancel', silent: true })
    addMovement(db, 'production.cancel', { type: 'release', itemKind: 'raw', itemId: lot.id, qty: back, unit: 'kg', refType: 'work_order', refId: wo.id, note: `Annulation ${wo.ref}` })
  }
  db.update('workOrders', id, { status: 'cancelled', reservations: [], history: [...wo.history, db.history('Ordre annulé', why)] }, { via: 'production.cancel' })
  if (releasedKg > 0) notifyRoles(db, ['procurement'], { title: 'Matière libérée', body: `${wo.ref} annulé : ${releasedKg} kg de matière sont de nouveau disponibles.`, level: 'info', href: '/ops/appro/lots-matiere' })
  return db.peek('workOrders', id)!
}

export const production = { createOrder, reserve, start, pause, resume, logEvent, record, complete, cancel }
