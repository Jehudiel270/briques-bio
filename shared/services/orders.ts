/**
 * Service commandes : création directe, paiements simulés, remboursement, annulation,
 * envoi en préparation et allocation FIFO des lots de produits finis LIBÉRÉS.
 *
 * Paiements : toujours simulés (`simulated: true`, référence `SIM-…`, factures `FAC-SIM-…`).
 */
import type { Address, Delivery, Id, Invoice, Order, OrderLine, Payment, PaymentMethod, ProductionLot, SaleUnit } from '../types/domain'
import { PermissionError, uid, type Db } from '../utils/db-core'
import { addDays, fcfa } from '../utils/format'
import { NOTICES, PAYMENT_METHOD_LABEL } from '../utils/labels'
import { CLIENT_ROLES } from '../utils/roles'
import { fail } from './errors'
import {
  actorId, addMovement, assertCanBuy, assertOwnsOrStaff, guard, isClientActor, need, notifyRoles, notifyUser, qtyOf, settingsOf, statusIn, text,
} from './helpers'
import { computeTotals, deliveryFeeFor, isOrderable, priceGridFor, unitPriceFor } from './pricing'

// ------------------------------------------------------------------ Création (partagée avec quotes.accept)
export interface NewOrderParams {
  via: string
  quoteRef?: string
  quoteId?: Id
  userId: Id
  companyId?: Id
  lines: { productId: Id; label: string; qty: number; unit: SaleUnit; unitPrice: number; discountPct?: number }[]
  deliveryAddress: Address
  /** Remise globale du devis (en %), répartie sur les lignes de la commande */
  discountPct?: number
  deliveryFee: number
  depositPct: number
  purchaseOrderRef?: string
}

/** Crée la commande (`pending_payment`, `unpaid`) et sa facture fictive `issued`. */
export function createOrderWithInvoice(db: Db, p: NewOrderParams): Order {
  const company = p.companyId ? db.peek('companies', p.companyId) : undefined
  const g = p.discountPct ?? 0
  const totals = computeTotals({ lines: p.lines, discountPct: g, deliveryFee: p.deliveryFee, depositPct: p.depositPct })
  const lines: OrderLine[] = p.lines.map((l) => {
    const eff = Math.round((100 - ((100 - (l.discountPct ?? 0)) * (100 - g)) / 100) * 100) / 100
    return {
      id: uid('ol'), productId: l.productId, label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice,
      discountPct: eff > 0 ? eff : undefined, allocations: [],
    }
  })
  const requiresReleasedLot = p.lines.some((l) => db.peek('products', l.productId)?.requiresReleasedLot !== false)
  const note = p.quoteRef ? `Commande créée depuis le devis ${p.quoteRef}` : 'Commande créée'
  const order = db.create('orders', {
    ref: db.nextRef('orders', 'CMD'), quoteId: p.quoteId, userId: p.userId, companyId: p.companyId, lines,
    deliveryAddress: p.deliveryAddress, status: 'pending_payment', paymentStatus: 'unpaid',
    subtotal: totals.subtotal, discountTotal: totals.discountTotal, deliveryFee: totals.deliveryFee, total: totals.total,
    depositPct: p.depositPct, depositAmount: totals.depositAmount, amountPaid: 0, currency: 'XOF', requiresReleasedLot,
    purchaseOrderRef: p.purchaseOrderRef, resellerOrder: company?.kind === 'distributor' ? true : undefined,
    timeline: [db.history(note, `Total ${fcfa(totals.total)} · acompte ${fcfa(totals.depositAmount)} (simulé)`)],
  }, { via: p.via, summary: `Création · commande depuis ${p.quoteRef ?? 'commande directe'}` }) as Order

  const now = db.now()
  db.create('invoices', {
    ref: db.nextRef('invoices', 'FAC-SIM'), orderId: order.id, userId: p.userId, companyId: p.companyId, amount: totals.total,
    purchaseOrderRef: p.purchaseOrderRef, status: 'issued', issuedAt: now, dueAt: addDays(now, company?.paymentTermsDays ?? 7), simulated: true,
  }, { via: p.via, summary: `Facture fictive · ${order.ref}` })

  notifyRoles(db, ['sales'], {
    title: 'Nouvelle commande', body: `${order.ref} (${fcfa(order.total)}) attend le paiement de l’acompte simulé.`, level: 'info', href: `/ops/commercial/commandes/${order.id}`,
  })
  if (db.actor()?.id !== p.userId) {
    notifyUser(db, p.userId, { title: 'Commande créée', body: `${order.ref} attend votre paiement simulé.`, level: 'info', href: `/espace/commandes/${order.id}` })
  }
  return order
}

export function createDirect(db: Db, input: {
  lines: { productId: Id; qty: number }[]
  deliveryAddress: Address
  companyId?: Id
  purchaseOrderRef?: string
  /** Réservé au personnel (commande saisie pour un client) */
  userId?: Id
}): Order {
  const a = guard(db, 'orders.create')
  assertCanBuy(a)
  if (!a && !input.userId) throw new PermissionError('Connectez-vous avec un compte client pour commander.', 'orders', 'service')
  if (!input.lines?.length) fail('Ajoutez au moins un produit à la commande.')

  let userId: Id
  if (isClientActor(a)) {
    if (input.userId && input.userId !== a!.id) throw new PermissionError('Vous ne pouvez commander que pour votre propre compte.', 'orders', 'service')
    userId = a!.id!
  } else {
    userId = input.userId ?? fail('Indiquez le compte client pour lequel la commande est saisie.')
  }
  const buyer = need(db.peek('users', userId), 'Le compte client')
  if (!CLIENT_ROLES.includes(buyer.role)) fail('Seul un compte client, professionnel ou distributeur peut recevoir une commande.')

  const companyId = input.companyId ?? buyer.companyId
  if (isClientActor(a) && input.companyId && input.companyId !== a!.companyId) {
    throw new PermissionError('Vous ne pouvez commander qu’au nom de votre propre entreprise.', 'orders', 'service')
  }
  const company = companyId ? need(db.peek('companies', companyId), 'L’entreprise') : undefined
  if (company?.status === 'suspended') fail(`Le compte de ${company.name} est suspendu : contactez l’équipe commerciale.`)

  const settings = settingsOf(db)
  const address = input.deliveryAddress
  text(address?.line, 'L’adresse de livraison')
  text(address?.city, 'La ville de livraison')
  const zoneId = address.zone ?? buyer.address?.zone ?? fail('Choisissez une zone de livraison pour calculer les frais.')
  const zone = settings.zones.find((z) => z.id === zoneId)
  if (!zone || !zone.active) fail('La zone de livraison choisie n’est pas desservie : choisissez-en une autre.')

  const merged = new Map<Id, number>()
  for (const l of input.lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + qtyOf(l.qty, 'La quantité'))
  const grid = priceGridFor(db, companyId)
  const lines = [...merged].map(([productId, qty]) => {
    const product = need(db.peek('products', productId), 'Le produit')
    if (!isOrderable(product)) {
      fail(`« ${product.name} » n’est pas commandable en ligne (${product.published ? 'validation en cours' : 'non publié'}) : demandez un devis.`, 'not_orderable')
    }
    const unitPrice = unitPriceFor(product, grid, qty)
    if (unitPrice == null) fail(`« ${product.name} » est vendu sur devis uniquement : demandez un devis.`, 'quote_only')
    if (!product.deliveryZones.includes(zoneId)) fail(`« ${product.name} » n’est pas livré dans la zone ${zone.name}.`)
    return { productId, label: product.name, qty, unit: product.saleUnit, unitPrice }
  })

  return createOrderWithInvoice(db, {
    via: 'orders.create', userId, companyId, lines, deliveryAddress: { ...address, zone: zoneId },
    deliveryFee: deliveryFeeFor(settings, zoneId), depositPct: settings.defaultDepositPct, purchaseOrderRef: input.purchaseOrderRef,
  })
}

// ------------------------------------------------------------------ Paiements simulés
const invoiceOf = (db: Db, orderId: Id) => db.raw('invoices').find((i) => i.orderId === orderId && i.status !== 'cancelled')

export function pay(db: Db, orderId: Id, input: { amount: number; method: PaymentMethod; kind: 'deposit' | 'balance' | 'full' }): Payment {
  const a = guard(db, 'orders.pay')
  const order = need(db.peek('orders', orderId), 'La commande')
  assertOwnsOrStaff(a, order, 'compte', 'orders')
  assertCanBuy(a)
  if (!PAYMENT_METHOD_LABEL[input.method]) fail('Choisissez un mode de paiement simulé (mobile money, virement, espèces ou carte).')
  if (!['deposit', 'balance', 'full'].includes(input.kind)) fail('Type de paiement inconnu : choisissez acompte, solde ou paiement intégral.')
  if (order.status === 'cancelled') fail(`La commande ${order.ref} est annulée : aucun paiement ne peut être enregistré.`)
  const remaining = order.total - order.amountPaid
  if (remaining <= 0) fail(`La commande ${order.ref} est déjà soldée.`)
  const amount = Math.round(qtyOf(input.amount, 'Le montant'))
  if (amount < 1) fail('Le montant doit être d’au moins 1 FCFA.')
  if (amount > remaining) fail(`Le montant (${fcfa(amount)}) dépasse le solde restant (${fcfa(remaining)}).`)

  const depositDue = Math.max(0, order.depositAmount - order.amountPaid)
  if (input.kind === 'deposit') {
    if (depositDue === 0) fail('L’acompte est déjà réglé : enregistrez le solde.')
    if (amount < depositDue) fail(`L’acompte à régler est de ${fcfa(depositDue)} : saisissez au moins ce montant.`)
  } else if (input.kind === 'balance') {
    if (depositDue > 0) fail(`Réglez d’abord l’acompte (${fcfa(depositDue)}) avant le solde.`)
  } else if (amount !== remaining) {
    fail(`Un paiement intégral doit couvrir le solde restant (${fcfa(remaining)}).`)
  }

  const paid = order.amountPaid + amount
  const depositSettled = paid >= order.depositAmount
  const paymentStatus = paid >= order.total ? 'paid' : depositSettled && paid > 0 ? 'deposit_paid' : 'unpaid'
  const confirms = order.status === 'pending_payment' && depositSettled
  const invoice = invoiceOf(db, order.id)
  const now = db.now()

  const payment = db.create('payments', {
    ref: db.nextRef('payments', 'SIM'), orderId: order.id, invoiceId: invoice?.id, userId: order.userId, amount, kind: input.kind,
    method: input.method, status: 'succeeded', simulated: true, note: NOTICES.simulatedPayment, createdAt: now, paidAt: now,
  }, { via: 'orders.pay', summary: `Paiement simulé · ${order.ref} · ${fcfa(amount)}` }) as Payment

  const label = paymentStatus === 'paid'
    ? (input.kind === 'full' ? 'Paiement intégral enregistré (simulé)' : 'Solde réglé (simulé)')
    : input.kind === 'deposit' ? 'Acompte enregistré (simulé)' : 'Paiement partiel enregistré (simulé)'
  db.update('orders', order.id, {
    amountPaid: paid, paymentStatus, status: confirms ? 'confirmed' : order.status,
    timeline: [...order.timeline, db.history(label, `${fcfa(amount)} · ${PAYMENT_METHOD_LABEL[input.method]} · ${payment.ref}`)],
  }, { via: 'orders.pay' })
  if (invoice && paymentStatus === 'paid') db.update('invoices', invoice.id, { status: 'paid', paidAt: now }, { via: 'orders.pay' })

  notifyRoles(db, ['sales'], confirms
    ? { title: 'Commande confirmée', body: `${order.ref} : acompte réglé (simulé). Envoyez-la en préparation.`, level: 'success', href: `/ops/commercial/commandes/${order.id}` }
    : { title: 'Paiement simulé enregistré', body: `${order.ref} : ${fcfa(amount)} (${paymentStatus === 'paid' ? 'commande soldée' : 'solde restant ' + fcfa(order.total - paid)}).`, level: 'info', href: `/ops/commercial/commandes/${order.id}` })
  if (actorId(db) !== order.userId) {
    notifyUser(db, order.userId, { title: 'Paiement simulé enregistré', body: `${fcfa(amount)} enregistrés sur ${order.ref}.`, level: 'success', href: `/espace/commandes/${order.id}` })
  }
  return payment
}

export function refund(db: Db, orderId: Id, amount: number, reason: string): Payment {
  guard(db, 'orders.refund')
  const order = need(db.peek('orders', orderId), 'La commande')
  const why = text(reason, 'Le motif du remboursement')
  const value = Math.round(qtyOf(amount, 'Le montant remboursé'))
  if (value > order.amountPaid) fail(`Le remboursement (${fcfa(value)}) dépasse le montant payé (${fcfa(order.amountPaid)}).`)
  const now = db.now()
  const payment = db.create('payments', {
    ref: db.nextRef('payments', 'SIM'), orderId: order.id, invoiceId: invoiceOf(db, order.id)?.id, userId: order.userId, amount: value,
    kind: 'refund', method: 'bank_transfer', status: 'succeeded', simulated: true, note: `${NOTICES.simulatedPayment} Motif : ${why}`, createdAt: now, paidAt: now,
  }, { via: 'orders.refund', summary: `Remboursement simulé · ${order.ref} · ${fcfa(value)}` }) as Payment
  const left = order.amountPaid - value
  db.update('orders', order.id, {
    amountPaid: left, paymentStatus: left <= 0 ? 'refunded' : 'partially_refunded',
    timeline: [...order.timeline, db.history('Remboursement enregistré (simulé)', `${fcfa(value)} · ${why}`)],
  }, { via: 'orders.refund' })
  const invoice = invoiceOf(db, order.id)
  if (invoice?.status === 'paid' && left < order.total) db.update('invoices', invoice.id, { status: 'issued', paidAt: undefined }, { via: 'orders.refund' })
  notifyUser(db, order.userId, { title: 'Remboursement simulé enregistré', body: `${fcfa(value)} remboursés (simulé) sur ${order.ref}.`, level: 'info', href: `/espace/commandes/${order.id}` })
  return payment
}

// ------------------------------------------------------------------ Annulation
/** Rend au stock vendable les quantités réservées par une commande (lots de produits finis). */
export function releaseAllocations(db: Db, via: string, order: Order) {
  for (const line of order.lines) {
    for (const al of line.allocations) {
      const lot = db.peek('productionLots', al.lotId)
      if (!lot) continue
      const back = Math.min(al.qty, lot.reservedQty)
      db.update('productionLots', lot.id, { reservedQty: lot.reservedQty - back, availableQty: lot.availableQty + back }, { via, silent: true })
      addMovement(db, via, { type: 'release', itemKind: 'finished', itemId: lot.id, qty: back, unit: 'unit', refType: 'order', refId: order.id, note: `Annulation ${order.ref}` })
    }
  }
}

export function cancel(db: Db, orderId: Id, reason: string): Order {
  const a = guard(db, 'orders.cancel')
  const order = need(db.peek('orders', orderId), 'La commande')
  assertOwnsOrStaff(a, order, 'compte', 'orders')
  const why = text(reason, 'Le motif d’annulation')
  const allowed = isClientActor(a) ? ['pending_payment', 'confirmed'] : ['pending_payment', 'confirmed', 'in_preparation', 'ready_to_ship']
  if (!allowed.includes(order.status)) {
    fail(order.status === 'cancelled'
      ? `La commande ${order.ref} est déjà annulée.`
      : isClientActor(a) && ['in_preparation', 'ready_to_ship'].includes(order.status)
        ? `La commande ${order.ref} est en préparation : contactez l’équipe commerciale pour l’annuler.`
        : `La commande ${order.ref} est ${order.status === 'delivered' ? 'livrée' : 'expédiée'} : elle ne peut plus être annulée (ouvrez une réclamation).`)
  }
  releaseAllocations(db, 'orders.cancel', order)
  const lines = order.lines.map((l) => ({ ...l, allocations: [] }))
  db.update('orders', order.id, {
    status: 'cancelled', lines, awaitingStock: false,
    timeline: [...order.timeline, db.history('Commande annulée', why)],
  }, { via: 'orders.cancel' })
  const delivery = order.deliveryId ? db.peek('deliveries', order.deliveryId) : undefined
  if (delivery && !['delivered', 'cancelled'].includes(delivery.status)) {
    db.update('deliveries', delivery.id, { status: 'cancelled', lotIds: [], history: [...delivery.history, db.history('Livraison annulée', `Commande annulée : ${why}`)] }, { via: 'orders.cancel' })
    notifyRoles(db, ['logistics'], { title: 'Livraison annulée', body: `${delivery.ref} : ${order.ref} a été annulée.`, level: 'warning', href: `/ops/logistique/expeditions/${delivery.id}` })
  }
  const invoice = invoiceOf(db, order.id)
  if (invoice && invoice.status !== 'paid') db.update('invoices', invoice.id, { status: 'cancelled' }, { via: 'orders.cancel' })
  notifyRoles(db, ['sales'], {
    title: 'Commande annulée',
    body: `${order.ref} : ${why}${order.amountPaid > 0 ? ` — ${fcfa(order.amountPaid)} à rembourser (simulé).` : ''}`,
    level: 'warning', href: `/ops/commercial/commandes/${order.id}`,
  })
  if (actorId(db) !== order.userId) notifyUser(db, order.userId, { title: 'Commande annulée', body: `${order.ref} a été annulée : ${why}`, level: 'warning', href: `/espace/commandes/${order.id}` })
  return db.peek('orders', order.id)!
}

// ------------------------------------------------------------------ Préparation et allocation FIFO
/**
 * Réserve, ligne par ligne, des lots de produits finis LIBÉRÉS (FIFO : lot le plus ancien d'abord).
 * Tout ou rien au niveau de la commande : si une ligne manque de stock libéré, rien n'est réservé,
 * `awaitingStock` passe à vrai et la production est notifiée.
 */
export function allocateOrder(db: Db, via: string, order: Order): Order {
  const lotsLeft = new Map<Id, number>()
  const fifo = (productId: Id): ProductionLot[] =>
    db.raw('productionLots')
      .filter((l) => l.productId === productId && l.qcStatus === 'released' && l.availableQty > 0)
      .sort((x, y) => x.producedAt.localeCompare(y.producedAt) || x.ref.localeCompare(y.ref))

  const picks: { lineId: Id; lot: ProductionLot; qty: number }[] = []
  const shortages: { label: string; missing: number }[] = []
  for (const line of order.lines) {
    const product = db.peek('products', line.productId)
    if (product && product.requiresReleasedLot === false) continue
    let need_ = line.qty - line.allocations.reduce((s, x) => s + x.qty, 0)
    if (need_ <= 0) continue
    for (const lot of fifo(line.productId)) {
      if (need_ <= 0) break
      const free = lotsLeft.get(lot.id) ?? lot.availableQty
      const take = Math.min(free, need_)
      if (take <= 0) continue
      picks.push({ lineId: line.id, lot, qty: take })
      lotsLeft.set(lot.id, free - take)
      need_ -= take
    }
    if (need_ > 0) shortages.push({ label: line.label, missing: need_ })
  }

  if (shortages.length) {
    const wasWaiting = !!order.awaitingStock
    const detail = shortages.map((s) => `${s.missing} × ${s.label}`).join(', ')
    db.update('orders', order.id, {
      awaitingStock: true,
      timeline: wasWaiting ? order.timeline : [...order.timeline, db.history('En attente de stock libéré', `Lots libérés insuffisants : il manque ${detail}.`)],
    }, { via })
    if (!wasWaiting) {
      notifyRoles(db, ['production'], {
        title: 'Stock libéré insuffisant', body: `${order.ref} attend des lots libérés : il manque ${detail}. Planifiez une fabrication ou un contrôle de lot.`,
        level: 'warning', href: '/ops/production/ordres',
      })
      notifyUser(db, order.userId, {
        title: 'Commande en attente de stock', body: `${order.ref} est confirmée ; la préparation démarre dès que des lots contrôlés sont disponibles.`,
        level: 'info', href: `/espace/commandes/${order.id}`,
      })
    }
    return db.peek('orders', order.id)!
  }

  const lines = order.lines.map((l) => ({ ...l, allocations: l.allocations.map((x) => ({ ...x })) }))
  for (const p of picks) {
    const line = lines.find((l) => l.id === p.lineId)!
    const existing = line.allocations.find((x) => x.lotId === p.lot.id)
    if (existing) existing.qty += p.qty
    else line.allocations.push({ lotId: p.lot.id, qty: p.qty })
    const fresh = db.peek('productionLots', p.lot.id)!
    db.update('productionLots', fresh.id, { availableQty: fresh.availableQty - p.qty, reservedQty: fresh.reservedQty + p.qty }, { via, silent: true })
    addMovement(db, via, { type: 'reservation', itemKind: 'finished', itemId: fresh.id, qty: p.qty, unit: 'unit', refType: 'order', refId: order.id, note: `Réservation FIFO ${order.ref}` })
  }
  const lotRefs = [...new Set(picks.map((p) => p.lot.ref))]
  db.update('orders', order.id, {
    lines, awaitingStock: false,
    timeline: picks.length ? [...order.timeline, db.history('Lots libérés réservés (FIFO)', lotRefs.join(', '))] : order.timeline,
  }, { via })
  const lotIds = [...new Set(lines.flatMap((l) => l.allocations.map((x) => x.lotId)))]
  const delivery = order.deliveryId ? db.peek('deliveries', order.deliveryId) : undefined
  if (delivery && !['delivered', 'cancelled'].includes(delivery.status)) db.update('deliveries', delivery.id, { lotIds }, { via })
  return db.peek('orders', order.id)!
}

export function allocate(db: Db, orderId: Id): Order {
  guard(db, 'orders.allocate')
  const order = need(db.peek('orders', orderId), 'La commande')
  statusIn(order.status, ['confirmed', 'in_preparation', 'ready_to_ship'], `La commande ${order.ref} n’est pas à l’état « confirmée » ou « en préparation » : les lots ne peuvent pas être réservés.`)
  return allocateOrder(db, 'orders.allocate', order)
}

export function sendToPreparation(db: Db, orderId: Id): Order {
  guard(db, 'orders.sendToPreparation')
  const order = need(db.peek('orders', orderId), 'La commande')
  statusIn(order.status, ['confirmed', 'pending_payment'], `La commande ${order.ref} ne peut pas être envoyée en préparation (statut actuel : ${order.status}).`)
  if (order.amountPaid < order.depositAmount) fail(`L’acompte (${fcfa(order.depositAmount)}) n’est pas encore réglé : attendez le paiement simulé avant la préparation.`)

  let delivery = order.deliveryId ? db.peek('deliveries', order.deliveryId) : undefined
  if (!delivery || delivery.status === 'cancelled') {
    delivery = db.create('deliveries', {
      ref: db.nextRef('deliveries', 'LIV'), orderId: order.id, status: 'to_prepare', address: order.deliveryAddress, fee: order.deliveryFee,
      lotIds: [], incidents: [], history: [db.history('Livraison créée', `Commande ${order.ref} envoyée en préparation`)],
    }, { via: 'orders.sendToPreparation', summary: `Création · livraison de ${order.ref}` }) as Delivery
  }
  db.update('orders', order.id, {
    status: 'in_preparation', deliveryId: delivery.id,
    timeline: [...order.timeline, db.history('Envoyée en préparation', `Livraison ${delivery.ref}`)],
  }, { via: 'orders.sendToPreparation' })
  notifyRoles(db, ['logistics'], { title: 'Commande à préparer', body: `${order.ref} → ${delivery.ref} : préparation et planification de la livraison.`, level: 'info', href: `/ops/logistique/expeditions/${delivery.id}` })
  notifyUser(db, order.userId, { title: 'Commande en préparation', body: `${order.ref} est en préparation.`, level: 'info', href: `/espace/commandes/${order.id}` })
  return allocateOrder(db, 'orders.sendToPreparation', db.peek('orders', order.id)!)
}

export const orders = { createDirect, pay, refund, cancel, sendToPreparation, allocate }
