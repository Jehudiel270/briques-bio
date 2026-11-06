/**
 * Service livraisons : planification, expédition (lots réservés → expédiés), livraison avec preuve
 * obligatoire, incidents.
 */
import type { Delivery, Id, Incident, MediaRef } from '../types/domain'
import { uid, type Db } from '../utils/db-core'
import { fdate } from '../utils/format'
import { fail } from './errors'
import { actorId, addMovement, dateOf, dayOf, guard, need, notifyRoles, notifyUser, qtyOf, statusIn, text } from './helpers'

const opsHref = (d: Delivery) => `/ops/logistique/expeditions/${d.id}`

/** Lots et quantités réservés par la commande (lignes soumises à lot libéré) */
function allocationsOf(db: Db, d: Delivery) {
  const order = need(db.peek('orders', d.orderId), 'La commande liée')
  const flat = order.lines.flatMap((l) => l.allocations.map((a) => ({ ...a, label: l.label })))
  return { order, flat }
}

export function plan(db: Db, id: Id, input: { carrierId: Id; plannedDate: string; fee?: number }): Delivery {
  guard(db, 'deliveries.plan')
  const delivery = need(db.peek('deliveries', id), 'La livraison')
  statusIn(delivery.status, ['to_prepare', 'preparing', 'planned'], `${delivery.ref} ne peut plus être planifiée (statut actuel : ${delivery.status}).`)
  const { order, flat } = allocationsOf(db, delivery)
  statusIn(order.status, ['in_preparation', 'ready_to_ship'], `La commande ${order.ref} doit être en préparation pour planifier sa livraison.`)
  const requiresLots = order.lines.some((l) => db.peek('products', l.productId)?.requiresReleasedLot !== false)
  const covered = order.lines.every((l) => db.peek('products', l.productId)?.requiresReleasedLot === false || l.allocations.reduce((s, x) => s + x.qty, 0) >= l.qty)
  if (order.awaitingStock || (requiresLots && !covered)) {
    fail(`${order.ref} attend des lots libérés : réservez-les (allocation) avant de planifier la livraison.`, 'awaiting_stock')
  }
  const carrier = need(db.peek('carriers', input.carrierId), 'Le transporteur')
  if (carrier.status !== 'active') fail(`Le transporteur ${carrier.name} est inactif : choisissez-en un autre.`)
  const zone = delivery.address.zone
  if (zone && carrier.zones.length && !carrier.zones.includes(zone)) {
    fail(`${carrier.name} ne dessert pas la zone de livraison de ${order.ref} : choisissez un autre transporteur.`)
  }
  const date = dateOf(input.plannedDate, 'La date de livraison')
  if (dayOf(date.toISOString()) < dayOf(db.now())) fail('La date de livraison ne peut pas être dans le passé : choisissez une date à partir d’aujourd’hui.')
  const fee = input.fee == null ? delivery.fee : Math.round(qtyOf(input.fee, 'Les frais de livraison', { allowZero: true }))

  db.update('deliveries', id, {
    carrierId: carrier.id, driverName: carrier.contactName ?? carrier.name, plannedDate: date.toISOString(), fee, status: 'planned',
    lotIds: [...new Set(flat.map((x) => x.lotId))], history: [...delivery.history, db.history('Livraison planifiée', `${carrier.name} · ${fdate(date)}`)],
  }, { via: 'deliveries.plan' })
  db.update('orders', order.id, { status: 'ready_to_ship', timeline: [...order.timeline, db.history('Prête à expédier', `Livraison ${delivery.ref} le ${fdate(date)}`)] }, { via: 'deliveries.plan' })
  notifyUser(db, order.userId, { title: 'Livraison planifiée', body: `${order.ref} sera livrée le ${fdate(date)} (délai à confirmer).`, level: 'info', href: `/espace/commandes/${order.id}` })
  notifyRoles(db, ['sales'], { title: 'Livraison planifiée', body: `${order.ref} : ${carrier.name}, le ${fdate(date)}.`, level: 'info', href: `/ops/commercial/commandes/${order.id}` })
  return db.peek('deliveries', id)!
}

export function ship(db: Db, id: Id): Delivery {
  guard(db, 'deliveries.ship')
  const delivery = need(db.peek('deliveries', id), 'La livraison')
  statusIn(delivery.status, ['planned'], `${delivery.ref} doit être planifiée avant d’être expédiée (statut actuel : ${delivery.status}).`)
  const { order, flat } = allocationsOf(db, delivery)
  statusIn(order.status, ['ready_to_ship'], `La commande ${order.ref} n’est pas prête à expédier.`)

  // Contrôles avant toute écriture : lots toujours libérés, quantités réservées suffisantes (jamais de stock négatif).
  const byLot = new Map<Id, number>()
  for (const x of flat) byLot.set(x.lotId, (byLot.get(x.lotId) ?? 0) + x.qty)
  for (const [lotId, qty] of byLot) {
    const lot = need(db.peek('productionLots', lotId), 'Le lot')
    if (lot.qcStatus !== 'released') fail(`Le lot ${lot.ref} n’est plus libéré par la qualité : il ne peut pas être expédié.`)
    if (lot.reservedQty < qty) fail(`Le lot ${lot.ref} n’a que ${lot.reservedQty} pièce(s) réservée(s) pour ${qty} à expédier : relancez l’allocation.`)
  }
  for (const [lotId, qty] of byLot) {
    const lot = db.peek('productionLots', lotId)!
    db.update('productionLots', lotId, { reservedQty: lot.reservedQty - qty, shippedQty: lot.shippedQty + qty }, { via: 'deliveries.ship', silent: true })
    addMovement(db, 'deliveries.ship', { type: 'out', itemKind: 'finished', itemId: lotId, qty, unit: 'unit', refType: 'order', refId: order.id, note: `Expédition ${delivery.ref}` })
  }
  const now = db.now()
  db.update('deliveries', id, { status: 'in_transit', shippedAt: now, lotIds: [...byLot.keys()], history: [...delivery.history, db.history('Expédiée')] }, { via: 'deliveries.ship' })
  db.update('orders', order.id, { status: 'shipped', timeline: [...order.timeline, db.history('Expédiée', delivery.ref)] }, { via: 'deliveries.ship' })
  notifyUser(db, order.userId, { title: 'Commande expédiée', body: `${order.ref} est en transit.`, level: 'info', href: `/espace/commandes/${order.id}` })
  return db.peek('deliveries', id)!
}

export function deliver(db: Db, id: Id, input: { receivedBy: string; note?: string; photo?: MediaRef }): Delivery {
  guard(db, 'deliveries.deliver')
  const delivery = need(db.peek('deliveries', id), 'La livraison')
  statusIn(delivery.status, ['in_transit'], `${delivery.ref} n’est pas en transit (statut actuel : ${delivery.status}) : expédiez-la avant de la marquer livrée.`)
  const receivedBy = text(input?.receivedBy, 'Le nom de la personne qui a réceptionné la livraison (preuve de livraison)')
  const order = need(db.peek('orders', delivery.orderId), 'La commande liée')
  const now = db.now()
  db.update('deliveries', id, {
    status: 'delivered', deliveredAt: now, proof: { receivedBy, note: input.note?.trim() || undefined, photo: input.photo, at: now },
    history: [...delivery.history, db.history('Livrée', `Réceptionnée par ${receivedBy}`)],
  }, { via: 'deliveries.deliver' })
  db.update('orders', order.id, { status: 'delivered', timeline: [...order.timeline, db.history('Livrée', `Réceptionnée par ${receivedBy}`)] }, { via: 'deliveries.deliver' })
  notifyUser(db, order.userId, { title: 'Commande livrée', body: `${order.ref} a été livrée (réceptionnée par ${receivedBy}).`, level: 'success', href: `/espace/commandes/${order.id}` })
  notifyRoles(db, ['sales'], { title: 'Commande livrée', body: `${order.ref} : preuve de livraison enregistrée.`, level: 'success', href: `/ops/commercial/commandes/${order.id}` })
  return db.peek('deliveries', id)!
}

export function incident(db: Db, id: Id, input: { type: Incident['type']; description: string }): Delivery {
  guard(db, 'deliveries.incident')
  const delivery = need(db.peek('deliveries', id), 'La livraison')
  if (delivery.status === 'cancelled') fail(`${delivery.ref} est annulée : aucun incident ne peut être ajouté.`)
  if (!['delay', 'damage', 'absent', 'address', 'vehicle', 'other'].includes(input.type)) fail('Choisissez le type d’incident (retard, casse, absent, adresse, véhicule ou autre).')
  const description = text(input.description, 'La description de l’incident')
  const entry: Incident = { id: uid('inc'), at: db.now(), type: input.type, description, resolved: false, userId: actorId(db) }
  db.update('deliveries', id, { incidents: [...delivery.incidents, entry], history: [...delivery.history, db.history('Incident signalé', description)] }, { via: 'deliveries.incident' })
  const order = db.peek('orders', delivery.orderId)
  notifyRoles(db, ['sales'], { title: 'Incident de livraison', body: `${delivery.ref}${order ? ` (${order.ref})` : ''} : ${description}`, level: 'warning', href: opsHref(delivery) })
  if (order) notifyUser(db, order.userId, { title: 'Incident sur votre livraison', body: `${order.ref} : ${description}`, level: 'warning', href: `/espace/commandes/${order.id}` })
  return db.peek('deliveries', id)!
}

export function resolveIncident(db: Db, id: Id, incidentId: Id): Delivery {
  guard(db, 'deliveries.resolveIncident')
  const delivery = need(db.peek('deliveries', id), 'La livraison')
  const target = delivery.incidents.find((i) => i.id === incidentId) ?? fail('Incident introuvable sur cette livraison.')
  if (target.resolved) fail('Cet incident est déjà résolu.')
  db.update('deliveries', id, {
    incidents: delivery.incidents.map((i) => (i.id === incidentId ? { ...i, resolved: true } : i)),
    history: [...delivery.history, db.history('Incident résolu', target.description)],
  }, { via: 'deliveries.resolveIncident' })
  return db.peek('deliveries', id)!
}

export const deliveries = { plan, ship, deliver, incident, resolveIncident }
