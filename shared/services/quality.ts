/**
 * Service qualité : demande de contrôle d'un lot, saisie des résultats, décision (libération, rejet,
 * quarantaine). Un lot n'est libéré — donc vendable — que si tous les tests `required` sont saisis ET conformes.
 * Les seuils des référentiels sont des valeurs de démonstration, pas des exigences normatives.
 */
import type { Id, QcCriterion, QcInspection, QcResult, QcTemplate } from '../types/domain'
import type { Db } from '../utils/db-core'
import { num } from '../utils/format'
import { fail } from './errors'
import { guard, need, notifyRoles, notifyUser, statusIn, text } from './helpers'

const opsHref = (q: QcInspection) => `/ops/qualite/controles/${q.id}`
const entered = (r?: QcResult) => !!r && (r.value !== undefined || r.passed !== undefined)

export const templatesFor = (db: Db, productId: Id): QcTemplate[] =>
  db.raw('qcTemplates').filter((t) => !t.productId || t.productId === productId).sort((a, b) => a.order - b.order)

/** Évalue une valeur mesurée par rapport au critère du test. */
export function meetsCriterion(c: QcCriterion, value: number): boolean {
  switch (c.kind) {
    case 'min': return c.min == null || value >= c.min
    case 'max': return c.max == null || value <= c.max
    case 'range': return (c.min == null || value >= c.min) && (c.max == null || value <= c.max)
    default: return true
  }
}

const criterionText = (t: QcTemplate) => {
  const c = t.criterion
  const u = t.unit ? ` ${t.unit}` : ''
  if (c.kind === 'min') return `≥ ${num(c.min ?? 0, 1)}${u}`
  if (c.kind === 'max') return `≤ ${num(c.max ?? 0, 1)}${u}`
  if (c.kind === 'range') return `entre ${num(c.min ?? 0, 1)} et ${num(c.max ?? 0, 1)}${u}`
  return 'conforme'
}

export function request(db: Db, lotId: Id, assignedTo?: Id): QcInspection {
  const a = guard(db, 'quality.request')
  const lot = need(db.peek('productionLots', lotId), 'Le lot de produits finis')
  if (lot.qcStatus === 'released') fail(`${lot.ref} est déjà libéré.`)
  if (lot.qcStatus === 'rejected') fail(`${lot.ref} a été rejeté : il ne peut plus être contrôlé.`)
  if (lot.qcStatus === 'in_qc' || db.raw('qcInspections').some((q) => q.lotId === lot.id && q.status !== 'completed')) fail(`Un contrôle est déjà en cours pour ${lot.ref}.`)
  let assignee = assignedTo
  if (assignee) {
    const user = need(db.peek('users', assignee), 'Le technicien')
    if (user.role !== 'quality' && user.role !== 'admin') fail(`${user.name} n’est pas technicien qualité : choisissez un membre de l’équipe qualité.`)
  } else {
    assignee = a?.role === 'quality' ? a.id : db.raw('users').find((u) => u.role === 'quality' && u.active)?.id
  }
  const results: QcResult[] = templatesFor(db, lot.productId).map((t) => ({ templateId: t.id, measuredAt: '' }))
  const inspection = db.create('qcInspections', {
    ref: db.nextRef('qcInspections', 'QC'), lotId: lot.id, requestedAt: db.now(), requestedBy: a?.id, assignedTo: assignee, status: 'pending', results,
    history: [db.history('Contrôle demandé', `${results.length} test(s) à saisir`)],
  }, { via: 'quality.request', summary: `Contrôle qualité demandé · ${lot.ref}` }) as QcInspection
  db.update('productionLots', lot.id, { qcStatus: 'in_qc', inspectionIds: [...lot.inspectionIds, inspection.id] }, { via: 'quality.request' })
  const n = { title: 'Contrôle à réaliser', body: `${inspection.ref} : ${lot.ref} attend ses résultats d’essais.`, level: 'info' as const, href: opsHref(inspection) }
  if (assignee) notifyUser(db, assignee, n)
  notifyRoles(db, ['quality'], n)
  return inspection
}

export function record(db: Db, inspectionId: Id, results: { templateId: Id; value?: number; passed?: boolean; note?: string }[]): QcInspection {
  guard(db, 'quality.record')
  const inspection = need(db.peek('qcInspections', inspectionId), 'Le contrôle')
  if (inspection.status === 'completed') fail(`${inspection.ref} est déjà clôturé : les résultats ne sont plus modifiables.`)
  if (!results?.length) fail('Saisissez au moins un résultat de test.')
  const lot = need(db.peek('productionLots', inspection.lotId), 'Le lot contrôlé')
  const templates = templatesFor(db, lot.productId)
  const now = db.now()
  const merged = inspection.results.map((r) => ({ ...r }))
  for (const input of results) {
    const t = templates.find((x) => x.id === input.templateId) ?? fail('Ce test ne fait pas partie du référentiel applicable à ce produit.')
    let res: QcResult
    if (t.criterion.kind === 'pass_fail') {
      if (typeof input.passed !== 'boolean') fail(`« ${t.name} » : indiquez conforme ou non conforme.`)
      res = { templateId: t.id, passed: input.passed, measuredAt: now, note: input.note?.trim() || undefined }
    } else {
      const value = Number(input.value)
      if (input.value == null || !Number.isFinite(value)) fail(`« ${t.name} » : saisissez la valeur mesurée${t.unit ? ` (${t.unit})` : ''}.`)
      res = { templateId: t.id, value, passed: meetsCriterion(t.criterion, value), measuredAt: now, note: input.note?.trim() || undefined }
    }
    const i = merged.findIndex((r) => r.templateId === t.id)
    if (i >= 0) merged[i] = res
    else merged.push(res)
  }
  db.update('qcInspections', inspectionId, {
    status: 'in_progress', results: merged, history: [...inspection.history, db.history('Résultats saisis', `${results.length} test(s)`)],
  }, { via: 'quality.record' })
  return db.peek('qcInspections', inspectionId)!
}

export function decide(db: Db, inspectionId: Id, input: { decision: 'accepted' | 'rejected' | 'quarantine'; reason: string }): QcInspection {
  const a = guard(db, 'quality.decide')
  const inspection = need(db.peek('qcInspections', inspectionId), 'Le contrôle')
  if (inspection.status === 'completed') fail(`${inspection.ref} est déjà clôturé (décision : ${inspection.decision}).`)
  if (!['accepted', 'rejected', 'quarantine'].includes(input.decision)) fail('Choisissez la décision : libérer, rejeter ou mettre en quarantaine.')
  const reason = text(input.reason, 'Le motif de la décision')
  const lot = need(db.peek('productionLots', inspection.lotId), 'Le lot contrôlé')

  if (input.decision === 'accepted') {
    const problems: string[] = []
    for (const t of templatesFor(db, lot.productId).filter((x) => x.required)) {
      const r = inspection.results.find((x) => x.templateId === t.id)
      if (!entered(r)) problems.push(`« ${t.name} » n’est pas saisi`)
      else if (r!.passed !== true) problems.push(`« ${t.name} » est hors critère${r!.value !== undefined ? ` (${num(r!.value, 2)}${t.unit ? ' ' + t.unit : ''}, attendu ${criterionText(t)})` : ''}`)
    }
    if (problems.length) fail(`Libération impossible pour ${lot.ref} : ${problems.join(' ; ')}. Saisissez les résultats manquants ou choisissez le rejet ou la quarantaine.`, 'criteria_not_met')
  }

  const now = db.now()
  const label = input.decision === 'accepted' ? 'Lot libéré' : input.decision === 'rejected' ? 'Lot rejeté' : 'Lot mis en quarantaine'
  db.update('qcInspections', inspectionId, {
    status: 'completed', decision: input.decision, decisionReason: reason, decidedBy: a?.id, decidedAt: now,
    history: [...inspection.history, db.history(`Décision : ${input.decision}`, reason)],
  }, { via: 'quality.decide' })
  db.update('productionLots', lot.id, {
    qcStatus: input.decision === 'accepted' ? 'released' : input.decision === 'rejected' ? 'rejected' : 'quarantine',
    releasedAt: input.decision === 'accepted' ? now : lot.releasedAt, releasedBy: input.decision === 'accepted' ? a?.id : lot.releasedBy,
    inspectionIds: lot.inspectionIds.includes(inspectionId) ? lot.inspectionIds : [...lot.inspectionIds, inspectionId],
  }, { via: 'quality.decide', summary: `Statut · ${lot.ref} → ${input.decision === 'accepted' ? 'released' : input.decision}` })

  const href = `/ops/production/lots/${lot.id}`
  notifyRoles(db, ['production'], { title: label, body: `${lot.ref} : ${reason}`, level: input.decision === 'accepted' ? 'success' : 'warning', href })
  if (input.decision === 'accepted') {
    const waiting = db.raw('orders').filter((o) => o.awaitingStock && o.lines.some((l) => l.productId === lot.productId))
    if (waiting.length) {
      notifyRoles(db, ['sales', 'logistics'], {
        title: 'Lot libéré : commandes en attente', body: `${lot.ref} est libéré (${lot.availableQty} pièces) : relancez l’allocation de ${waiting.map((o) => o.ref).join(', ')}.`,
        level: 'info', href: `/ops/commercial/commandes/${waiting[0]!.id}`,
      })
    }
  }
  return db.peek('qcInspections', inspectionId)!
}

export function attachReport(db: Db, inspectionId: Id, documentId: Id): QcInspection {
  guard(db, 'quality.attachReport')
  const inspection = need(db.peek('qcInspections', inspectionId), 'Le contrôle')
  const doc = need(db.peek('documents', documentId), 'Le document')
  if (doc.kind !== 'test_report') fail(`« ${doc.title} » n’est pas un rapport d’essai : choisissez un document de type rapport d’essai.`)
  statusIn(doc.status, ['draft', 'internal', 'published'], `« ${doc.title} » est archivé : choisissez un document actif.`)
  db.update('qcInspections', inspectionId, { reportDocumentId: doc.id, history: [...inspection.history, db.history('Rapport rattaché', doc.ref)] }, { via: 'quality.attachReport' })
  return db.peek('qcInspections', inspectionId)!
}

export const quality = { request, record, decide, attachReport }
