/**
 * Service collectes : demande du collecteur, examen et planification par l'approvisionnement (tournées),
 * mises à jour du chauffeur sur le terrain, annulation. La réception pesée est dans `receipts`.
 */
import type { Address, CollectionRequest, CollectionStatus, Id, MediaRef, PolymerCode, Tour } from '../types/domain'
import { PermissionError, type Db } from '../utils/db-core'
import { fdatetime } from '../utils/format'
import { POLYMER_LABEL } from '../utils/labels'
import { fail } from './errors'
import { dateOf, dayOf, guard, need, notifyRoles, notifySupplier, notifyUser, qtyOf, settingsOf, statusIn, text } from './helpers'

const collectorHref = (c: CollectionRequest) => `/collecte/demandes/${c.id}`
const opsHref = (c: CollectionRequest) => `/ops/appro/demandes/${c.id}`
const fieldHref = (c: CollectionRequest) => `/terrain/collectes/${c.id}`
const TERMINAL: CollectionStatus[] = ['weighed', 'received', 'cancelled', 'rejected', 'problem']

export function request(db: Db, input: {
  supplierId?: Id
  polymers: { code: PolymerCode; estimatedKg: number }[]
  pickupPoint: Address & { label?: string }
  photos?: MediaRef[]
  preferredSlots: string[]
  notes?: string
}): CollectionRequest {
  const a = guard(db, 'collections.request')
  let supplierId: Id
  if (a?.role === 'collector') {
    if (!a.supplierId) fail('Votre compte collecteur n’est rattaché à aucun profil de collecte : contactez l’équipe approvisionnement.')
    if (input.supplierId && input.supplierId !== a.supplierId) throw new PermissionError('Vous ne pouvez déclarer une collecte que pour votre propre profil de collecte.', 'collections', 'service')
    supplierId = a.supplierId
  } else {
    supplierId = input.supplierId ?? fail('Indiquez le collecteur ou fournisseur concerné par la collecte.')
  }
  const supplier = need(db.peek('suppliers', supplierId), 'Le collecteur')
  if (supplier.status !== 'approved') fail(supplier.status === 'pending' ? 'Votre profil de collecte est en attente de validation : vous pourrez déclarer des collectes dès son approbation.' : 'Ce profil de collecte est suspendu : contactez l’équipe approvisionnement.')

  if (!input.polymers?.length) fail('Ajoutez au moins un type de plastique avec une quantité estimée.')
  const rules = settingsOf(db).polymers
  const merged = new Map<PolymerCode, number>()
  for (const p of input.polymers) {
    const rule = rules.find((r) => r.code === p.code)
    if (!rule) fail(`Type de plastique inconnu : ${p.code}.`)
    if (!rule.accepted) fail(`Le ${POLYMER_LABEL[p.code] ?? p.code} n’est pas accepté actuellement. Retirez-le de la demande (${rule.criteria})`, 'polymer_refused')
    merged.set(p.code, (merged.get(p.code) ?? 0) + qtyOf(p.estimatedKg, `La quantité estimée de ${POLYMER_LABEL[p.code] ?? p.code}`))
  }
  const polymers = [...merged].map(([code, estimatedKg]) => ({ code, estimatedKg }))
  const line = text(input.pickupPoint?.line, 'L’adresse du point d’enlèvement')
  text(input.pickupPoint?.city, 'La ville du point d’enlèvement')

  const col = db.create('collections', {
    ref: db.nextRef('collections', 'COL'), supplierId, polymers, estimatedTotalKg: polymers.reduce((s, p) => s + p.estimatedKg, 0),
    pickupPoint: { ...input.pickupPoint, label: input.pickupPoint.label?.trim() || line }, photos: input.photos ?? [],
    preferredSlots: input.preferredSlots ?? [], proposedSlots: [], status: 'submitted', notes: input.notes?.trim() || undefined,
    history: [db.history('Demande envoyée', `${polymers.length} type(s) de plastique`)],
  }, { via: 'collections.request', summary: 'Demande de collecte' }) as CollectionRequest
  notifyRoles(db, ['procurement'], { title: 'Collecte à examiner', body: `${col.ref} vient d’être déposée (${col.estimatedTotalKg} kg estimés).`, level: 'info', href: opsHref(col) })
  return col
}

export function review(db: Db, id: Id, input: { accept: boolean; reason?: string; proposedSlots?: string[] }): CollectionRequest {
  guard(db, 'collections.review')
  const col = need(db.peek('collections', id), 'La demande de collecte')
  statusIn(col.status, ['submitted', 'under_review'], `${col.ref} a déjà été traitée (statut actuel : ${col.status}).`)
  if (!input.accept) {
    const why = text(input.reason, 'Le motif du refus')
    db.update('collections', id, { status: 'rejected', problemReason: why, history: [...col.history, db.history('Demande refusée', why)] }, { via: 'collections.review' })
    notifySupplier(db, col.supplierId, { title: 'Demande de collecte refusée', body: `${col.ref} : ${why}`, level: 'warning', href: collectorHref(col) })
  } else {
    const slots = (input.proposedSlots ?? []).map((s) => dateOf(s, 'Un créneau proposé').toISOString())
    db.update('collections', id, {
      status: 'under_review', proposedSlots: slots.length ? slots : col.proposedSlots,
      history: [...col.history, db.history('Demande acceptée', slots.length ? `Créneaux proposés : ${slots.map((s) => fdatetime(s)).join(' ; ')}` : input.reason?.trim() || undefined)],
    }, { via: 'collections.review' })
    notifySupplier(db, col.supplierId, { title: 'Demande de collecte acceptée', body: `${col.ref} : l’enlèvement va être planifié${slots.length ? ' (créneaux proposés)' : ''}.`, level: 'success', href: collectorHref(col) })
  }
  return db.peek('collections', id)!
}

function detachFromTour(db: Db, via: string, col: CollectionRequest) {
  const tour = col.tourId ? db.peek('tours', col.tourId) : undefined
  if (!tour) return
  const left = tour.collectionIds.filter((x) => x !== col.id)
  db.update('tours', tour.id, { collectionIds: left, status: left.length === 0 && tour.status === 'planned' ? 'cancelled' : tour.status }, { via })
}

export function plan(db: Db, id: Id, input: { scheduledAt: string; driverUserId: Id; tourId?: Id }): CollectionRequest {
  guard(db, 'collections.plan')
  const col = need(db.peek('collections', id), 'La demande de collecte')
  statusIn(col.status, ['submitted', 'under_review', 'planned', 'problem'], `${col.ref} ne peut plus être planifiée (statut actuel : ${col.status}).`)
  const when = dateOf(input.scheduledAt, 'La date d’enlèvement')
  if (dayOf(when.toISOString()) < dayOf(db.now())) fail('La date d’enlèvement ne peut pas être dans le passé : choisissez une date à partir d’aujourd’hui.')
  const driver = need(db.peek('users', input.driverUserId), 'Le chauffeur')
  if (driver.role !== 'driver' || !driver.active) fail(`${driver.name} n’est pas un chauffeur actif : choisissez un agent de collecte.`)

  let tour: Tour | undefined
  if (input.tourId) {
    tour = need(db.peek('tours', input.tourId), 'La tournée')
    statusIn(tour.status, ['planned', 'in_progress'], `${tour.ref} est clôturée : choisissez une autre tournée ou laissez-en créer une.`)
    if (tour.driverUserId !== driver.id) fail(`${tour.ref} est attribuée à un autre chauffeur : choisissez le chauffeur de la tournée.`)
  } else {
    tour = db.raw('tours').find((t) => t.driverUserId === driver.id && ['planned', 'in_progress'].includes(t.status) && dayOf(t.date) === dayOf(when.toISOString()))
  }
  if (col.tourId && col.tourId !== tour?.id) detachFromTour(db, 'collections.plan', col)
  if (tour) {
    if (!tour.collectionIds.includes(id)) db.update('tours', tour.id, { collectionIds: [...tour.collectionIds, id] }, { via: 'collections.plan' })
  } else {
    const carrier = driver.carrierId ? db.peek('carriers', driver.carrierId) : undefined
    tour = db.create('tours', {
      ref: db.nextRef('tours', 'TRN'), date: when.toISOString(), driverUserId: driver.id, carrierId: carrier?.id, vehicle: carrier?.vehicle ?? 'Véhicule à préciser',
      collectionIds: [id], status: 'planned',
    }, { via: 'collections.plan', summary: `Création · tournée de ${driver.name}` }) as Tour
  }
  db.update('collections', id, {
    status: 'planned', scheduledAt: when.toISOString(), driverUserId: driver.id, tourId: tour.id, problemReason: undefined,
    history: [...col.history, db.history('Collecte planifiée', `${fdatetime(when)} · ${driver.name} · ${tour.ref}`)],
  }, { via: 'collections.plan' })
  notifySupplier(db, col.supplierId, { title: 'Collecte planifiée', body: `${col.ref} : enlèvement prévu le ${fdatetime(when)}.`, level: 'success', href: collectorHref(col) })
  notifyUser(db, driver.id, { title: 'Nouvelle collecte', body: `${col.ref} (${col.pickupPoint.label}) le ${fdatetime(when)}.`, level: 'info', href: fieldHref(col) })
  return db.peek('collections', id)!
}

const RANK: Partial<Record<CollectionStatus, number>> = { planned: 0, en_route: 1, collected: 2, weighed: 3 }

export function driverUpdate(db: Db, id: Id, input: {
  status: 'en_route' | 'collected' | 'weighed' | 'problem' | 'cancelled'
  recordedKg?: number
  proof?: { note: string; photo?: MediaRef }
  problemReason?: string
}): CollectionRequest {
  const a = guard(db, 'collections.driverUpdate')
  const col = need(db.peek('collections', id), 'La collecte')
  if (a?.role === 'driver' && col.driverUserId !== a.id) throw new PermissionError('Cette collecte est attribuée à un autre chauffeur : vous ne pouvez pas la mettre à jour.', 'collections', 'service')
  if (!['en_route', 'collected', 'weighed', 'problem', 'cancelled'].includes(input.status)) fail('Statut de collecte inconnu.')
  statusIn(col.status, ['planned', 'en_route', 'collected', 'weighed', 'problem'], `${col.ref} n’est plus modifiable depuis le terrain (statut actuel : ${col.status}).`)
  const now = db.now()
  const patch: Partial<CollectionRequest> = { status: input.status }
  let label: string
  let note: string | undefined

  if (input.status === 'problem' || input.status === 'cancelled') {
    const why = text(input.problemReason, input.status === 'problem' ? 'Le motif du problème' : 'Le motif d’annulation')
    if (input.status === 'problem') patch.problemReason = why
    else patch.cancelReason = why
    label = input.status === 'problem' ? 'Problème signalé' : 'Collecte annulée'
    note = why
  } else {
    const from = RANK[col.status]
    if (col.status !== 'problem' && from != null && RANK[input.status]! <= from) fail(`${col.ref} est déjà « ${col.status} » : choisissez l’étape suivante.`)
    if (col.status === 'problem') patch.problemReason = undefined
    if (input.recordedKg != null) patch.recordedKg = qtyOf(input.recordedKg, 'Le poids relevé')
    if (input.status === 'collected' && input.proof) patch.proof = { note: text(input.proof.note, 'La note de preuve'), photo: input.proof.photo, at: now }
    if (input.status === 'weighed' && !(patch.recordedKg ?? col.recordedKg)) fail('Saisissez le poids relevé (kg) avant de valider la pesée.')
    label = input.status === 'en_route' ? 'Chauffeur en route' : input.status === 'collected' ? 'Collectée' : 'Pesée enregistrée'
    note = patch.recordedKg != null ? `${patch.recordedKg} kg relevés` : undefined
  }
  patch.history = [...col.history, db.history(label, note)]
  db.update('collections', id, patch, { via: 'collections.driverUpdate' })

  // Tournée : démarrage au premier départ, clôture quand toutes les collectes sont traitées
  const tour = col.tourId ? db.peek('tours', col.tourId) : undefined
  if (tour) {
    if (input.status === 'en_route' && tour.status === 'planned') db.update('tours', tour.id, { status: 'in_progress', startedAt: now }, { via: 'collections.driverUpdate' })
    else if (tour.status !== 'done' && tour.status !== 'cancelled') {
      const all = tour.collectionIds.map((cid) => db.peek('collections', cid)).filter(Boolean) as CollectionRequest[]
      if (all.length && all.every((c) => TERMINAL.includes(c.status))) db.update('tours', tour.id, { status: 'done', endedAt: now }, { via: 'collections.driverUpdate' })
    }
  }

  if (input.status === 'weighed') notifyRoles(db, ['procurement'], { title: 'Collecte pesée', body: `${col.ref} : ${patch.recordedKg ?? col.recordedKg} kg relevés, à réceptionner.`, level: 'info', href: opsHref(col) })
  else if (input.status === 'problem' || input.status === 'cancelled') {
    notifyRoles(db, ['procurement'], { title: input.status === 'problem' ? 'Problème de collecte' : 'Collecte annulée par le chauffeur', body: `${col.ref} : ${note}`, level: 'warning', href: opsHref(col) })
    notifySupplier(db, col.supplierId, { title: input.status === 'problem' ? 'Problème sur votre collecte' : 'Collecte annulée', body: `${col.ref} : ${note}`, level: 'warning', href: collectorHref(col) })
  } else {
    notifySupplier(db, col.supplierId, { title: label, body: `${col.ref} : ${label.toLowerCase()}.`, level: 'info', href: collectorHref(col) })
  }
  return db.peek('collections', id)!
}

export function cancel(db: Db, id: Id, reason: string): CollectionRequest {
  const a = guard(db, 'collections.cancel')
  const col = need(db.peek('collections', id), 'La demande de collecte')
  if (a?.role === 'collector' && a.supplierId !== col.supplierId) throw new PermissionError('Cette demande appartient à un autre collecteur : vous ne pouvez pas l’annuler.', 'collections', 'service')
  const allowed: CollectionStatus[] = a?.role === 'collector' ? ['submitted', 'under_review', 'planned', 'problem'] : ['submitted', 'under_review', 'planned', 'en_route', 'collected', 'problem']
  statusIn(col.status, allowed, `${col.ref} ne peut plus être annulée (statut actuel : ${col.status}).`)
  const why = text(reason, 'Le motif d’annulation')
  const previous = col.status
  detachFromTour(db, 'collections.cancel', col)
  db.update('collections', id, { status: 'cancelled', cancelReason: why, tourId: undefined, history: [...col.history, db.history('Demande annulée', why)] }, { via: 'collections.cancel' })
  if (col.driverUserId && ['planned', 'en_route'].includes(previous)) {
    notifyUser(db, col.driverUserId, { title: 'Collecte annulée', body: `${col.ref} est annulée : ${why}`, level: 'warning', href: fieldHref(col) })
  }
  notifyRoles(db, ['procurement'], { title: 'Collecte annulée', body: `${col.ref} : ${why}`, level: 'info', href: opsHref(col) })
  if (a?.role !== 'collector') notifySupplier(db, col.supplierId, { title: 'Collecte annulée', body: `${col.ref} : ${why}`, level: 'warning', href: collectorHref(col) })
  return db.peek('collections', id)!
}

export const collections = { request, review, plan, driverUpdate, cancel }
