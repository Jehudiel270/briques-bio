/**
 * Service devis : demande → prise en charge → envoi → négociation → acceptation (commande + facture
 * fictive) ou refus. Un devis n'est jamais un engagement réel : prototype de démonstration.
 */
import type { Address, Id, Order, Quote, QuoteLine, ThreadMessage } from '../types/domain'
import { PermissionError, uid, type Db } from '../utils/db-core'
import { fdate } from '../utils/format'
import { fail } from './errors'
import {
  actorId, actorName, assertCanBuy, assertOwnsOrStaff, dateOf, guard, isClientActor, need, notifyRoles, notifyUser, pctOf, qtyOf, settingsOf, statusIn, text,
} from './helpers'
import { createOrderWithInvoice } from './orders'
import { canRequestQuote, deliveryFeeFor, isOrderable, priceGridFor } from './pricing'

const OPEN: Quote['status'][] = ['requested', 'in_review', 'sent']

const quoteHref = (q: Quote) => `/espace/devis/${q.id}`
const opsHref = (q: Quote) => `/ops/commercial/devis/${q.id}`

export function request(db: Db, input: {
  contact: { name: string; email: string; phone?: string }
  deliveryAddress: Address
  lines: { productId: Id; qty: number }[]
  customerNotes?: string
  companyId?: Id
}): Quote {
  const a = guard(db, 'quotes.request')
  const name = text(input.contact?.name, 'Le nom du contact')
  const email = text(input.contact?.email, 'L’adresse e-mail du contact')
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('L’adresse e-mail du contact n’est pas valide : vérifiez-la.')
  text(input.deliveryAddress?.line, 'L’adresse de livraison')
  text(input.deliveryAddress?.city, 'La ville de livraison')
  if (!input.lines?.length) fail('Ajoutez au moins un produit à la demande de devis.')

  const companyId = input.companyId ?? a?.companyId
  if (isClientActor(a) && input.companyId && input.companyId !== a!.companyId) {
    throw new PermissionError('Vous ne pouvez demander un devis qu’au nom de votre propre entreprise.', 'quotes', 'service')
  }
  if (companyId) need(db.peek('companies', companyId), 'L’entreprise')

  const merged = new Map<Id, number>()
  for (const l of input.lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + qtyOf(l.qty, 'La quantité'))
  const lines: QuoteLine[] = [...merged].map(([productId, qty]) => {
    const product = need(db.peek('products', productId), 'Le produit')
    if (!product.published) fail(`« ${product.name} » n’est pas publié : retirez-le de la demande.`)
    if (!canRequestQuote(product)) fail(`« ${product.name} » est en développement : il ne peut pas encore faire l’objet d’un devis. Retirez-le de la demande.`, 'in_development')
    return { id: uid('ql'), productId, label: product.name, qty, unit: product.saleUnit, unitPrice: null }
  })

  const settings = settingsOf(db)
  const grid = priceGridFor(db, companyId)
  const quote = db.create('quotes', {
    ref: db.nextRef('quotes', 'DV'), requesterUserId: a?.id, companyId, contact: { name, email, phone: input.contact.phone?.trim() || undefined },
    deliveryAddress: input.deliveryAddress, lines, customerNotes: input.customerNotes?.trim() || undefined, status: 'requested',
    discountPct: grid?.defaultDiscountPct ?? 0, deliveryFee: deliveryFeeFor(settings, input.deliveryAddress.zone), depositPct: settings.defaultDepositPct,
    currency: 'XOF', negotiation: [], history: [db.history('Demande de devis reçue', `${lines.length} produit(s)`)],
  }, { via: 'quotes.request', summary: 'Demande de devis' }) as Quote
  notifyRoles(db, ['sales'], { title: 'Nouvelle demande de devis', body: `${quote.ref} (${name}) attend une prise en charge.`, level: 'info', href: opsHref(quote) })
  return quote
}

export function take(db: Db, id: Id): Quote {
  const a = guard(db, 'quotes.take')
  const quote = need(db.peek('quotes', id), 'Le devis')
  if (quote.status !== 'requested') {
    fail(quote.status === 'in_review' ? `${quote.ref} est déjà pris en charge${quote.assignedTo ? ` par ${db.peek('users', quote.assignedTo)?.name ?? 'un collègue'}` : ''}.` : `${quote.ref} n’est plus à l’état « demande reçue » : rien à prendre en charge.`)
  }
  db.update('quotes', id, { status: 'in_review', assignedTo: a?.id ?? actorId(db), history: [...quote.history, db.history('Prise en charge', 'Chiffrage en cours')] }, { via: 'quotes.take' })
  notifyUser(db, quote.requesterUserId, { title: 'Devis en cours de chiffrage', body: `${quote.ref} est pris en charge par notre équipe commerciale.`, level: 'info', href: quoteHref(quote) })
  return db.peek('quotes', id)!
}

export function send(db: Db, id: Id, body: {
  lines: { id?: Id; productId: Id; qty: number; unitPrice: number; discountPct?: number }[]
  discountPct: number
  deliveryFee: number
  depositPct: number
  validUntil: string
  internalNotes?: string
}): Quote {
  const a = guard(db, 'quotes.send')
  const quote = need(db.peek('quotes', id), 'Le devis')
  statusIn(quote.status, ['requested', 'in_review', 'sent'], `${quote.ref} ne peut plus être modifié (statut actuel : ${quote.status}).`)
  if (!body.lines?.length) fail('Le devis doit contenir au moins une ligne.')
  const lines: QuoteLine[] = body.lines.map((l) => {
    const product = need(db.peek('products', l.productId), 'Le produit')
    if (!canRequestQuote(product)) fail(`« ${product.name} » ne peut pas être chiffré (${product.published ? 'produit en développement' : 'produit non publié'}).`)
    if (l.unitPrice == null || !Number.isFinite(Number(l.unitPrice)) || Number(l.unitPrice) < 0) fail(`Renseignez le prix unitaire de « ${product.name} ».`)
    const previous = quote.lines.find((q) => q.id === l.id)
    return {
      id: l.id && previous ? l.id : uid('ql'), productId: l.productId, label: product.name, qty: qtyOf(l.qty, `La quantité de « ${product.name} »`),
      unit: product.saleUnit, unitPrice: Math.round(Number(l.unitPrice)), discountPct: l.discountPct ? pctOf(l.discountPct, `La remise de « ${product.name} »`) : undefined,
    }
  })
  const discountPct = pctOf(body.discountPct, 'La remise globale')
  const depositPct = pctOf(body.depositPct, 'Le pourcentage d’acompte')
  const deliveryFee = Math.round(qtyOf(body.deliveryFee ?? 0, 'Les frais de livraison', { allowZero: true }))
  const validUntil = dateOf(body.validUntil, 'La date de validité')
  if (+validUntil <= Date.parse(db.now())) fail('La date de validité du devis doit être dans le futur : choisissez une date ultérieure.')

  const patch: Partial<Quote> = {
    status: 'sent', lines, discountPct, depositPct, deliveryFee, validUntil: validUntil.toISOString(), internalNotes: body.internalNotes?.trim() || quote.internalNotes,
    history: [...quote.history, ...(quote.status === 'requested' ? [db.history('Prise en charge')] : []), db.history(quote.status === 'sent' ? 'Devis révisé et renvoyé' : 'Devis envoyé', `Valable jusqu’au ${fdate(validUntil)}`)],
  }
  if (quote.status === 'requested') patch.assignedTo = a?.id ?? actorId(db)
  db.update('quotes', id, patch, { via: 'quotes.send' })
  notifyUser(db, quote.requesterUserId, { title: 'Devis disponible', body: `Votre devis ${quote.ref} est prêt (valable jusqu’au ${fdate(validUntil)}).`, level: 'success', href: quoteHref(quote) })
  return db.peek('quotes', id)!
}

export function negotiate(db: Db, id: Id, body: string | { body: string }): Quote {
  const a = guard(db, 'quotes.negotiate')
  const quote = need(db.peek('quotes', id), 'Le devis')
  assertOwnsOrStaff(a, quote, 'devis', 'quotes')
  statusIn(quote.status, OPEN, `${quote.ref} est clos : la négociation n’est plus possible.`)
  const message = text(typeof body === 'string' ? body : body?.body, 'Le message')
  const entry: ThreadMessage = { id: uid('msg'), userId: a?.id, userName: actorName(db), at: db.now(), body: message }
  db.update('quotes', id, { negotiation: [...quote.negotiation, entry], history: [...quote.history, db.history('Message de négociation', message.slice(0, 120))] }, { via: 'quotes.negotiate' })
  if (isClientActor(a)) {
    notifyUser(db, quote.assignedTo, { title: 'Message du client', body: `${quote.ref} : ${message.slice(0, 100)}`, level: 'info', href: opsHref(quote) })
    if (!quote.assignedTo) notifyRoles(db, ['sales'], { title: 'Message du client', body: `${quote.ref} : ${message.slice(0, 100)}`, level: 'info', href: opsHref(quote) })
  } else {
    notifyUser(db, quote.requesterUserId, { title: 'Message sur votre devis', body: `${quote.ref} : ${message.slice(0, 100)}`, level: 'info', href: quoteHref(quote) })
  }
  return db.peek('quotes', id)!
}

export function accept(db: Db, id: Id): Order {
  const a = guard(db, 'quotes.accept')
  const quote = need(db.peek('quotes', id), 'Le devis')
  assertOwnsOrStaff(a, quote, 'devis', 'quotes')
  assertCanBuy(a)
  if (quote.status === 'converted') fail(`${quote.ref} est déjà converti en commande.`)
  if (quote.status !== 'sent') fail(`${quote.ref} ne peut pas être accepté : il n’a pas encore été envoyé par notre équipe commerciale (statut actuel : ${quote.status}).`)
  if (quote.validUntil && +new Date(quote.validUntil) < Date.parse(db.now())) {
    db.update('quotes', id, { status: 'expired', history: [...quote.history, db.history('Devis expiré', `Validité dépassée (${fdate(quote.validUntil)})`)] }, { via: 'quotes.accept' })
    fail(`${quote.ref} a expiré le ${fdate(quote.validUntil)} : demandez une nouvelle version à l’équipe commerciale.`, 'expired')
  }
  const userId = quote.requesterUserId ?? fail('Ce devis a été demandé sans compte : rattachez-le à un compte client avant de le convertir en commande.')
  const lines = quote.lines.map((l) => {
    const product = need(db.peek('products', l.productId), 'Le produit')
    if (!isOrderable(product)) {
      fail(`« ${product.name} » n’est pas encore autorisé à la commercialisation : ${quote.ref} ne peut pas être converti en commande avant la fin de sa validation.`, 'not_orderable')
    }
    if (l.unitPrice == null) fail(`La ligne « ${l.label} » n’a pas de prix : demandez une version chiffrée du devis.`)
    return { productId: l.productId, label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountPct: l.discountPct }
  })
  const order = createOrderWithInvoice(db, {
    via: 'quotes.accept', quoteId: quote.id, quoteRef: quote.ref, userId, companyId: quote.companyId, lines,
    deliveryAddress: quote.deliveryAddress, discountPct: quote.discountPct, deliveryFee: quote.deliveryFee, depositPct: quote.depositPct,
  })
  db.update('quotes', id, {
    status: 'converted', orderId: order.id,
    history: [...quote.history, db.history('Accepté (simulation)', actorName(db)), db.history('Converti en commande', order.ref)],
  }, { via: 'quotes.accept' })
  return order
}

export function decline(db: Db, id: Id, reason: string): Quote {
  const a = guard(db, 'quotes.decline')
  const quote = need(db.peek('quotes', id), 'Le devis')
  assertOwnsOrStaff(a, quote, 'devis', 'quotes')
  statusIn(quote.status, OPEN, `${quote.ref} est déjà clos (statut actuel : ${quote.status}).`)
  const why = text(reason, 'Le motif du refus')
  db.update('quotes', id, { status: 'declined', declineReason: why, history: [...quote.history, db.history('Devis refusé', why)] }, { via: 'quotes.decline' })
  if (isClientActor(a)) {
    notifyUser(db, quote.assignedTo, { title: 'Devis refusé par le client', body: `${quote.ref} : ${why}`, level: 'warning', href: opsHref(quote) })
    if (!quote.assignedTo) notifyRoles(db, ['sales'], { title: 'Devis refusé par le client', body: `${quote.ref} : ${why}`, level: 'warning', href: opsHref(quote) })
  } else {
    notifyUser(db, quote.requesterUserId, { title: 'Devis clos', body: `${quote.ref} a été clos par notre équipe : ${why}`, level: 'info', href: quoteHref(quote) })
  }
  return db.peek('quotes', id)!
}

export const quotes = { request, take, send, negotiate, accept, decline }
