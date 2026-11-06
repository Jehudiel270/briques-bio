/**
 * Service environnement : agrégation mensuelle de QUANTITÉS MESURÉES (kg reçus, acceptés, rejetés, utilisés,
 * rebuts, pièces finies), validation et publication d'indicateurs avec méthodologie et justificatif.
 *
 * Règle d'or : aucune économie de CO₂ n'est calculée ni publiée. Les indicateurs « carbone » sont refusés.
 */
import type { EnvIndicator, EnvRecord, Id, PolymerCode } from '../types/domain'
import { uid, type Db } from '../utils/db-core'
import { fail } from './errors'
import { guard, need, notifyRoles, periodOf, round2, settingsOf, text } from './helpers'

const POLYMERS: PolymerCode[] = ['PET', 'HDPE', 'LDPE', 'PP', 'PS', 'PVC', 'OTHER']
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/
const CARBON = /co2|co₂|carbon|émission|emission|gaz à effet/i
const MIN_METHOD_CHARS = 15

const mentionsCarbon = (...xs: (string | undefined)[]) => xs.some((x) => !!x && CARBON.test(x))
const NO_CARBON = 'Ce prototype ne calcule ni ne publie d’économie de carbone : utilisez des quantités mesurées (kg reçus, acceptés, utilisés, rebuts, pièces finies).'

interface Metrics { receivedKg: number; acceptedKg: number; rejectedKg: number; usedInProductionKg: number; finishedUnits: number; finishedKg: number; lossKg: number }
const METRIC_KEYS: (keyof Metrics)[] = ['receivedKg', 'acceptedKg', 'rejectedKg', 'usedInProductionKg', 'finishedUnits', 'finishedKg', 'lossKg']
const AGG_NOTE = 'Calculé depuis les pesées, lots de matière et lots de produits finis du mois. Pièces et poids finis répartis par polymère au prorata des kg de matière consommés ; pertes = matière utilisée moins poids fini, plus pertes de stock enregistrées.'

/** Recalcule un EnvRecord par polymère pour un mois (AAAA-MM). Une validation existante est conservée si les chiffres sont inchangés. */
export function aggregate(db: Db, period: string): EnvRecord[] {
  const a = guard(db, 'env.aggregate')
  if (!PERIOD.test(period)) fail('Période invalide : saisissez un mois au format AAAA-MM (par exemple 2026-10).')
  const accepted = new Set(settingsOf(db).polymers.filter((p) => p.accepted).map((p) => p.code))
  const zero = (): Metrics => ({ receivedKg: 0, acceptedKg: 0, rejectedKg: 0, usedInProductionKg: 0, finishedUnits: 0, finishedKg: 0, lossKg: 0 })
  const m = Object.fromEntries(POLYMERS.map((p) => [p, zero()])) as Record<PolymerCode, Metrics>

  for (const r of db.raw('receipts')) {
    if (periodOf(r.receivedAt) !== period) continue
    for (const l of r.lines) {
      const x = m[l.polymer]
      x.receivedKg += l.weighedKg
      x.acceptedKg += l.acceptedKg
      x.rejectedKg += l.rejectedKg
    }
  }
  for (const lot of db.raw('productionLots')) {
    if (periodOf(lot.producedAt) !== period) continue
    const total = lot.rawInputs.reduce((s, i) => s + i.kg, 0)
    if (total <= 0) continue
    const unitKg = db.peek('products', lot.productId)?.unitWeightKg ?? 0
    for (const input of lot.rawInputs) {
      const polymer = db.peek('rawLots', input.rawLotId)?.polymer
      if (!polymer) continue
      const share = input.kg / total
      const x = m[polymer]
      x.usedInProductionKg += input.kg
      x.finishedUnits += lot.producedQty * share
      x.finishedKg += lot.producedQty * unitKg * share
    }
  }
  const stockLoss: Partial<Record<PolymerCode, number>> = {}
  for (const mv of db.raw('stockMovements')) {
    if (mv.type !== 'loss' || mv.itemKind !== 'raw' || periodOf(mv.at) !== period) continue
    const polymer = db.peek('rawLots', mv.itemId)?.polymer
    if (polymer) stockLoss[polymer] = (stockLoss[polymer] ?? 0) + mv.qty
  }

  const out: EnvRecord[] = []
  let changed = 0
  for (const polymer of POLYMERS) {
    const x = m[polymer]
    const metrics: Metrics = {
      receivedKg: round2(x.receivedKg), acceptedKg: round2(x.acceptedKg), rejectedKg: round2(x.rejectedKg), usedInProductionKg: round2(x.usedInProductionKg),
      finishedUnits: Math.round(x.finishedUnits), finishedKg: round2(x.finishedKg),
      lossKg: round2(Math.max(0, x.usedInProductionKg - x.finishedKg) + (stockLoss[polymer] ?? 0)),
    }
    const hasData = METRIC_KEYS.some((k) => metrics[k] > 0)
    const existing = db.raw('envRecords').find((r) => r.period === period && r.polymer === polymer)
    if (!hasData && !accepted.has(polymer) && !existing) continue
    if (existing) {
      if (METRIC_KEYS.every((k) => existing[k] === metrics[k])) { out.push(existing); continue }
      db.update('envRecords', existing.id, { ...metrics, validated: false, validatedBy: undefined, notes: AGG_NOTE }, { via: 'env.aggregate', summary: `Agrégation · ${period} · ${polymer}` })
      out.push(db.peek('envRecords', existing.id)!)
    } else {
      out.push(db.create('envRecords', { id: `env_${period}_${polymer}`, period, polymer, ...metrics, validated: false, notes: AGG_NOTE, demo: true }, { via: 'env.aggregate', summary: `Agrégation · ${period} · ${polymer}` }) as EnvRecord)
    }
    changed++
  }
  if (changed && a?.role !== 'environment') notifyRoles(db, ['environment'], { title: 'Données à valider', body: `Les données de ${period} ont été recalculées (${changed} ligne(s)) et attendent votre validation.`, level: 'info', href: '/ops/environnement/donnees' })
  return out
}

/** Valide une ligne mensuelle (EnvRecord) ou, par son identifiant, un indicateur (EnvIndicator) : brouillon → validé. */
export function validateRecord(db: Db, id: Id): EnvRecord | EnvIndicator {
  const a = guard(db, 'env.validate')
  const record = db.peek('envRecords', id)
  if (record) {
    if (record.validated) fail(`Les données ${record.period} · ${record.polymer} sont déjà validées.`)
    db.update('envRecords', id, { validated: true, validatedBy: a?.id }, { via: 'env.validate', summary: `Validation · données ${record.period} · ${record.polymer}` })
    return db.peek('envRecords', id)!
  }
  const indicator = need(db.peek('envIndicators', id), 'La ligne de données ou l’indicateur')
  if (indicator.status !== 'draft') fail(`L’indicateur « ${indicator.label} » est déjà ${indicator.status === 'published' ? 'publié' : 'validé'}.`)
  db.update('envIndicators', id, { status: 'validated' }, { via: 'env.validate', summary: `Validation · indicateur ${indicator.key}` })
  return db.peek('envIndicators', id)!
}

export function createIndicator(db: Db, partial: {
  key: string
  label: string
  value: number
  unit: string
  periodFrom: string
  periodTo: string
  methodology?: string
  evidenceDocumentIds?: Id[]
}): EnvIndicator {
  guard(db, 'env.createIndicator')
  const key = text(partial.key, 'La clé de l’indicateur')
  const label = text(partial.label, 'Le libellé de l’indicateur')
  const unit = text(partial.unit, 'L’unité de l’indicateur')
  if (mentionsCarbon(key, label, unit)) fail(NO_CARBON, 'carbon_forbidden')
  const value = Number(partial.value)
  if (partial.value == null || !Number.isFinite(value)) fail('La valeur de l’indicateur doit être un nombre.')
  if (!PERIOD.test(partial.periodFrom ?? '') || !PERIOD.test(partial.periodTo ?? '')) fail('Les périodes de l’indicateur doivent être au format AAAA-MM.')
  if (partial.periodFrom > partial.periodTo) fail('La période de début doit précéder la période de fin.')
  if (db.raw('envIndicators').some((i) => i.key === key && i.periodFrom === partial.periodFrom && i.periodTo === partial.periodTo)) {
    fail(`Un indicateur « ${key} » existe déjà pour cette période : modifiez-le plutôt que d’en créer un second.`)
  }
  for (const docId of partial.evidenceDocumentIds ?? []) need(db.peek('documents', docId), 'Le document justificatif')
  return db.create('envIndicators', {
    id: uid('ind'), key, label, value, unit, periodFrom: partial.periodFrom, periodTo: partial.periodTo, methodology: partial.methodology?.trim() ?? '',
    evidenceDocumentIds: [...new Set(partial.evidenceDocumentIds ?? [])], status: 'draft', demo: true,
  }, { via: 'env.createIndicator', summary: `Création · indicateur ${key}` }) as EnvIndicator
}

export function publish(db: Db, indicatorId: Id): EnvIndicator {
  const a = guard(db, 'env.publish')
  const ind = need(db.peek('envIndicators', indicatorId), 'L’indicateur')
  if (ind.status === 'published') fail(`L’indicateur « ${ind.label} » est déjà publié.`)
  if (mentionsCarbon(ind.key, ind.label, ind.unit)) fail(NO_CARBON, 'carbon_forbidden')
  if (ind.methodology.trim().length < MIN_METHOD_CHARS) fail(`Décrivez la méthodologie de « ${ind.label} » (au moins une phrase : source des pesées, période, mode de calcul) avant de le publier.`, 'methodology_missing')
  if (!ind.evidenceDocumentIds.length) fail(`Rattachez au moins une pièce justificative à « ${ind.label} » avant de le publier.`, 'evidence_missing')
  for (const docId of ind.evidenceDocumentIds) {
    const doc = db.peek('documents', docId)
    if (!doc || !['internal', 'published'].includes(doc.status)) fail(`La pièce justificative ${doc?.ref ?? docId} n’est pas exploitable (document absent, brouillon ou archivé) : rattachez un document actif.`, 'evidence_missing')
  }
  if (ind.status !== 'validated') fail(`« ${ind.label} » doit être validé avant d’être publié : validez-le d’abord.`, 'not_validated')
  db.update('envIndicators', indicatorId, { status: 'published', approvedBy: a?.id, approvedAt: db.now() }, { via: 'env.publish', summary: `Publication · indicateur ${ind.key}` })
  notifyRoles(db, ['admin'], { title: 'Indicateur publié', body: `« ${ind.label} » est publié sur la page d’impact (quantité mesurée, méthodologie incluse).`, level: 'success', href: '/admin/impact' })
  return db.peek('envIndicators', indicatorId)!
}

export function unpublish(db: Db, indicatorId: Id): EnvIndicator {
  guard(db, 'env.unpublish')
  const ind = need(db.peek('envIndicators', indicatorId), 'L’indicateur')
  if (ind.status !== 'published') fail(`L’indicateur « ${ind.label} » n’est pas publié.`)
  db.update('envIndicators', indicatorId, { status: 'validated', approvedBy: undefined, approvedAt: undefined }, { via: 'env.unpublish', summary: `Dépublication · indicateur ${ind.key}` })
  return db.peek('envIndicators', indicatorId)!
}

export const env = { aggregate, validateRecord, createIndicator, publish, unpublish }
