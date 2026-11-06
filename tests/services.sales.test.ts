import { beforeEach, describe, expect, it } from 'vitest'
import { canRequestQuote, computeTotals, deliveryFeeFor, isOrderable, productStock, services as svc, unitPriceFor } from '../shared/services'
import { addr, expectDenied, expectService, expectStockInvariants, makeEnv, notificationsFor, type Env } from './services-env'

let env: Env
beforeEach(() => { env = makeEnv() })

describe('pricing — helpers purs', () => {
  it('isOrderable / canRequestQuote suivent la validation du produit', () => {
    const p = (id: string) => env.state.products.find((x) => x.id === id)!
    expect(isOrderable(p('prd_pave-hexa-20'))).toBe(true)
    expect(isOrderable(p('prd_pave-renforce-80'))).toBe(false)
    expect(canRequestQuote(p('prd_pave-renforce-80'))).toBe(true)
    expect(canRequestQuote(p('prd_couvre-mur-30'))).toBe(false)
    expect(isOrderable({ ...p('prd_pave-hexa-20'), published: false })).toBe(false)
    expect(canRequestQuote({ ...p('prd_pave-hexa-20'), published: false })).toBe(false)
  })

  it('unitPriceFor : null = sur devis, paliers et remise de grille', () => {
    const p = (id: string) => env.state.products.find((x) => x.id === id)!
    const grid = env.state.priceGrids.find((g) => g.id === 'pg_pro')!
    expect(unitPriceFor(p('prd_pave-renforce-80'), undefined, 10)).toBeNull()
    expect(unitPriceFor(p('prd_pave-hexa-20'), undefined, 10)).toBe(450)
    expect(unitPriceFor(p('prd_pave-hexa-20'), grid, 10)).toBe(423) // 450 − 6 %
    expect(unitPriceFor(p('prd_pave-hexa-20'), grid, 1000)).toBe(405) // palier de volume
    expect(unitPriceFor(p('prd_pave-hexa-20'), { ...grid, active: false }, 1000)).toBe(450)
  })

  it('computeTotals : remises de ligne et globale, acompte, TVA incluse en option', () => {
    const t = computeTotals({ lines: [{ qty: 50, unitPrice: 450 }, { qty: 10, unitPrice: 3200 }], discountPct: 6, deliveryFee: 15000, depositPct: 30 })
    expect(t).toEqual({ subtotal: 54500, discountTotal: 3270, deliveryFee: 15000, total: 66230, depositAmount: 19869 })
    const l = computeTotals({ lines: [{ qty: 10, unitPrice: 1000, discountPct: 10 }], discountPct: 0, deliveryFee: 0, depositPct: 50, vatRatePct: 18 })
    expect(l.discountTotal).toBe(1000)
    expect(l.total).toBe(9000)
    expect(l.depositAmount).toBe(4500)
    expect(l.vatIncluded).toBe(1373)
  })

  it('deliveryFeeFor : frais de zone, 0 si inconnue', () => {
    const settings = env.state.settings[0]!
    expect(deliveryFeeFor(settings, 'z_calavi')).toBe(18000)
    expect(deliveryFeeFor(settings, 'z_inconnue')).toBe(0)
  })

  it('productStock : seuls les lots libérés sont vendables', () => {
    const hexa = productStock(env.db, 'prd_pave-hexa-20')
    expect(hexa).toMatchObject({ released: 168, reserved: 60, availableToSell: 108, pendingQc: 0, total: 168 })
    const dalle = productStock(env.db, 'prd_dalle-allee-40') // lot_3 en contrôle
    expect(dalle).toMatchObject({ released: 0, availableToSell: 0, pendingQc: 70, total: 70 })
    expect(productStock(env.db, 'prd_pave-renforce-80')).toMatchObject({ availableToSell: 0, pendingQc: 0, total: 38 }) // lot_4 en quarantaine
  })
})

describe('Workflow A — devis → commande → paiement → préparation → livraison', () => {
  it('parcourt tout le circuit avec lots libérés, FIFO et preuve de livraison', () => {
    const { db, state, as } = env
    const lot1 = () => state.productionLots.find((l) => l.id === 'lot_1')!
    const lot2 = () => state.productionLots.find((l) => l.id === 'lot_2')!

    // 1. demande de devis par un client professionnel
    as('usr_pro1')
    const quote = svc.quotes.request(db, {
      contact: { name: 'Désiré Akpo', email: 'pro@ecobloc.demo' }, deliveryAddress: addr(),
      lines: [{ productId: 'prd_pave-hexa-20', qty: 50 }, { productId: 'prd_bordure-jardin-100', qty: 10 }], companyId: 'co_batiplus', customerNotes: 'Livraison sur chantier.',
    })
    expect(quote.status).toBe('requested')
    expect(quote.ref).toMatch(/^DV-\d{4}-\d{4}$/)
    expect(quote.requesterUserId).toBe('usr_pro1')
    expect(quote.lines.every((l) => l.unitPrice === null)).toBe(true)
    expect(quote.history.length).toBeGreaterThan(0)
    const salesNotif = notificationsFor(db, (n) => !!n.roles?.includes('sales') && n.href === `/ops/commercial/devis/${quote.id}`)
    expect(salesNotif).toHaveLength(1)

    // 2. prise en charge
    as('usr_sales')
    const taken = svc.quotes.take(db, quote.id)
    expect(taken.status).toBe('in_review')
    expect(taken.assignedTo).toBe('usr_sales')
    expectService(() => svc.quotes.take(db, quote.id), /déjà pris en charge/)

    // 3. envoi du devis chiffré
    const sent = svc.quotes.send(db, quote.id, {
      lines: [{ productId: 'prd_pave-hexa-20', qty: 50, unitPrice: 450 }, { productId: 'prd_bordure-jardin-100', qty: 10, unitPrice: 3200 }],
      discountPct: 6, deliveryFee: 15000, depositPct: 30, validUntil: '2026-12-15', internalNotes: 'Client fidèle (démo).',
    })
    expect(sent.status).toBe('sent')
    expect(sent.lines.every((l) => typeof l.unitPrice === 'number')).toBe(true)
    expect(notificationsFor(db, (n) => n.userId === 'usr_pro1' && n.href === `/espace/devis/${quote.id}`).length).toBeGreaterThan(0)

    // 4. négociation puis acceptation → commande + facture fictive
    as('usr_pro1')
    expect(svc.quotes.negotiate(db, quote.id, 'Pouvez-vous livrer avant vendredi ?').negotiation).toHaveLength(1)
    const order = svc.quotes.accept(db, quote.id)
    expect(order.status).toBe('pending_payment')
    expect(order.paymentStatus).toBe('unpaid')
    expect(order.ref).toMatch(/^CMD-\d{4}-\d{4}$/)
    expect(order).toMatchObject({ subtotal: 54500, discountTotal: 3270, deliveryFee: 15000, total: 66230, depositAmount: 19869, amountPaid: 0, quoteId: quote.id, userId: 'usr_pro1', companyId: 'co_batiplus' })
    const invoice = state.invoices.find((i) => i.orderId === order.id)!
    expect(invoice).toMatchObject({ status: 'issued', simulated: true, amount: 66230 })
    expect(invoice.ref).toMatch(/^FAC-SIM-\d{4}-\d{4}$/)
    expect(state.quotes.find((q) => q.id === quote.id)).toMatchObject({ status: 'converted', orderId: order.id })
    expectService(() => svc.quotes.accept(db, quote.id), /déjà converti/)

    // 5. paiements simulés : acompte insuffisant refusé, puis acompte et solde
    expectService(() => svc.orders.pay(db, order.id, { amount: 1000, method: 'mobile_money', kind: 'deposit' }), /acompte à régler/)
    expectService(() => svc.orders.pay(db, order.id, { amount: 40000, method: 'mobile_money', kind: 'balance' }), /acompte/)
    const deposit = svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'mobile_money', kind: 'deposit' })
    expect(deposit).toMatchObject({ simulated: true, status: 'succeeded', kind: 'deposit', amount: 19869, orderId: order.id })
    expect(deposit.ref).toMatch(/^SIM-/)
    let o = state.orders.find((x) => x.id === order.id)!
    expect(o).toMatchObject({ status: 'confirmed', paymentStatus: 'deposit_paid', amountPaid: 19869 })
    expectService(() => svc.orders.pay(db, order.id, { amount: 70000, method: 'bank_transfer', kind: 'balance' }), /dépasse le solde/)
    const balance = svc.orders.pay(db, order.id, { amount: 66230 - 19869, method: 'bank_transfer', kind: 'balance' })
    expect(balance.ref).toMatch(/^SIM-/)
    expect(balance.ref).not.toBe(deposit.ref)
    o = state.orders.find((x) => x.id === order.id)!
    expect(o).toMatchObject({ paymentStatus: 'paid', amountPaid: 66230 })
    expect(state.invoices.find((i) => i.id === invoice.id)!.status).toBe('paid')
    expectService(() => svc.orders.pay(db, order.id, { amount: 1, method: 'cash', kind: 'balance' }), /déjà soldée/)

    // 6. préparation + allocation sur lots LIBÉRÉS uniquement
    as('usr_sales')
    const before1 = { available: lot1().availableQty, reserved: lot1().reservedQty }
    const prepared = svc.orders.sendToPreparation(db, order.id)
    expect(prepared.status).toBe('in_preparation')
    expect(prepared.awaitingStock).toBe(false)
    expect(prepared.lines[0]!.allocations).toEqual([{ lotId: 'lot_1', qty: 50 }])
    expect(prepared.lines[1]!.allocations).toEqual([{ lotId: 'lot_2', qty: 10 }])
    expect(lot1()).toMatchObject({ availableQty: before1.available - 50, reservedQty: before1.reserved + 50 })
    expect(lot2().reservedQty).toBe(14 + 10)
    const delivery = state.deliveries.find((d) => d.id === prepared.deliveryId)!
    expect(delivery).toMatchObject({ status: 'to_prepare', orderId: order.id, fee: 15000 })
    expect(delivery.ref).toMatch(/^LIV-\d{4}-\d{4}$/)
    expect(delivery.lotIds.sort()).toEqual(['lot_1', 'lot_2'])
    expect(state.stockMovements.filter((m) => m.refType === 'order' && m.refId === order.id && m.type === 'reservation')).toHaveLength(2)
    expect(notificationsFor(db, (n) => !!n.roles?.includes('logistics') && n.href === `/ops/logistique/expeditions/${delivery.id}`)).toHaveLength(1)
    expectStockInvariants(state)

    // 7. planification (logistique), expédition, livraison avec preuve
    as('usr_logi')
    expectService(() => svc.deliveries.plan(db, delivery.id, { carrierId: 'car_3', plannedDate: '2020-01-01' }), /passé/)
    expectService(() => svc.deliveries.plan(db, delivery.id, { carrierId: 'car_inconnu', plannedDate: '2026-11-03' }), /introuvable/)
    const planned = svc.deliveries.plan(db, delivery.id, { carrierId: 'car_3', plannedDate: '2026-11-03' })
    expect(planned.status).toBe('planned')
    expect(state.orders.find((x) => x.id === order.id)!.status).toBe('ready_to_ship')
    expectService(() => svc.deliveries.deliver(db, delivery.id, { receivedBy: 'Désiré Akpo' }), /pas en transit/)
    const shipped = svc.deliveries.ship(db, delivery.id)
    expect(shipped.status).toBe('in_transit')
    expect(shipped.shippedAt).toBeTruthy()
    expect(state.orders.find((x) => x.id === order.id)!.status).toBe('shipped')
    expect(lot1()).toMatchObject({ reservedQty: before1.reserved, shippedQty: 220 + 50 })
    expect(lot2().shippedQty).toBe(30 + 10)
    expect(state.stockMovements.filter((m) => m.refType === 'order' && m.refId === order.id && m.type === 'out')).toHaveLength(2)
    expectService(() => svc.deliveries.deliver(db, delivery.id, { receivedBy: '   ' }), /preuve de livraison/)
    expect(state.deliveries.find((d) => d.id === delivery.id)!.status).toBe('in_transit')
    const delivered = svc.deliveries.deliver(db, delivery.id, { receivedBy: 'Désiré Akpo', note: 'Palettes conformes au bon de livraison.' })
    expect(delivered.status).toBe('delivered')
    expect(delivered.proof).toMatchObject({ receivedBy: 'Désiré Akpo' })
    expect(state.orders.find((x) => x.id === order.id)!.status).toBe('delivered')
    expect(state.orders.find((x) => x.id === order.id)!.timeline.map((h) => h.action)).toEqual(expect.arrayContaining(['Commande créée depuis le devis ' + quote.ref, 'Acompte enregistré (simulé)', 'Envoyée en préparation', 'Expédiée', 'Livrée']))
    expect(notificationsFor(db, (n) => n.userId === 'usr_pro1' && n.href === `/espace/commandes/${order.id}`).length).toBeGreaterThanOrEqual(4)
    expectStockInvariants(state)
    expect(db.raw('auditLog').some((a) => a.entity === 'orders' && a.entityId === order.id)).toBe(true)
  })

  it('alloue en FIFO : le lot libéré le plus ancien d’abord, puis le suivant', () => {
    const { db, state, as } = env
    const base = state.productionLots.find((l) => l.id === 'lot_1')!
    state.productionLots.push({ ...base, id: 'lot_extra', ref: 'LOT-2026-0099', producedAt: '2026-10-25T16:00:00.000Z', availableQty: 100, reservedQty: 0, shippedQty: 0, producedQty: 100, releasedAt: '2026-10-25T18:00:00.000Z', inspectionIds: [] })
    state.productionLots.push({ ...base, id: 'lot_old', ref: 'LOT-2026-0098', producedAt: '2026-10-01T16:00:00.000Z', availableQty: 20, reservedQty: 0, shippedQty: 0, producedQty: 20, inspectionIds: [] })
    as('usr_client1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 150 }], deliveryAddress: addr() })
    as('usr_client1')
    svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'card', kind: 'deposit' })
    as('usr_sales')
    const prepared = svc.orders.sendToPreparation(db, order.id)
    // lot_old (20), puis lot_1 (108), puis lot_extra (22)
    expect(prepared.lines[0]!.allocations).toEqual([{ lotId: 'lot_old', qty: 20 }, { lotId: 'lot_1', qty: 108 }, { lotId: 'lot_extra', qty: 22 }])
    expect(state.productionLots.find((l) => l.id === 'lot_1')!.availableQty).toBe(0)
    expect(prepared.awaitingStock).toBe(false)
  })

  it('refuse l’expédition si un lot n’est plus libéré ou si la réservation est insuffisante (jamais de stock négatif)', () => {
    const { db, state, as } = env
    as('usr_client1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 10 }], deliveryAddress: addr() })
    svc.orders.pay(db, order.id, { amount: order.total, method: 'cash', kind: 'full' })
    as('usr_sales')
    const prepared = svc.orders.sendToPreparation(db, order.id)
    as('usr_logi')
    svc.deliveries.plan(db, prepared.deliveryId!, { carrierId: 'car_3', plannedDate: '2026-11-04' })
    const lot = state.productionLots.find((l) => l.id === 'lot_1')!
    const reserved = lot.reservedQty
    lot.reservedQty = 3 // incohérence provoquée : moins de pièces réservées que la commande n'en expédie (10)
    expectService(() => svc.deliveries.ship(db, prepared.deliveryId!), /réservée/)
    lot.reservedQty = reserved
    lot.qcStatus = 'quarantine'
    expectService(() => svc.deliveries.ship(db, prepared.deliveryId!), /plus libéré/)
    lot.qcStatus = 'released'
    expect(state.deliveries.find((d) => d.id === prepared.deliveryId)!.status).toBe('planned')
    expect(svc.deliveries.ship(db, prepared.deliveryId!).status).toBe('in_transit')
    expectStockInvariants(state)
  })

  it('annulation : libère les réservations, annule livraison et facture, notifie', () => {
    const { db, state, as } = env
    as('usr_client1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_bordure-jardin-100', qty: 5 }], deliveryAddress: addr() })
    svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'mobile_money', kind: 'deposit' })
    as('usr_sales')
    svc.orders.sendToPreparation(db, order.id)
    const lot2 = state.productionLots.find((l) => l.id === 'lot_2')!
    expect(lot2.reservedQty).toBe(14 + 5)
    as('usr_client1')
    expectService(() => svc.orders.cancel(db, order.id, 'Changement de projet'), /en préparation/) // un client ne peut plus annuler
    as('usr_sales')
    svc.orders.cancel(db, order.id, 'Changement de projet')
    expect(lot2.reservedQty).toBe(14)
    expect(lot2.availableQty).toBe(30)
    const o = state.orders.find((x) => x.id === order.id)!
    expect(o.status).toBe('cancelled')
    expect(o.lines[0]!.allocations).toEqual([])
    expect(state.deliveries.find((d) => d.id === o.deliveryId)!.status).toBe('cancelled')
    expect(state.invoices.find((i) => i.orderId === order.id)!.status).toBe('cancelled')
    expectService(() => svc.orders.cancel(db, order.id, 'encore'), /déjà annulée/)
    // remboursement simulé de l'acompte
    const refund = svc.orders.refund(db, order.id, order.depositAmount, 'Annulation client')
    expect(refund).toMatchObject({ kind: 'refund', simulated: true })
    expect(refund.ref).toMatch(/^SIM-/)
    expect(state.orders.find((x) => x.id === order.id)).toMatchObject({ paymentStatus: 'refunded', amountPaid: 0 })
    expectService(() => svc.orders.refund(db, order.id, 1, 'trop'), /dépasse le montant payé/)
    expectStockInvariants(state)
  })

  it('refus : devis expiré, produit non autorisé, devis demandé sans compte', () => {
    const { db, state, as } = env
    // devis seed q_5 (produit en test) : l'acceptation est refusée tant que le produit n'est pas autorisé
    as('usr_pro2')
    expectService(() => svc.quotes.accept(db, 'q_5'), /pas encore autorisé/, 'not_orderable')
    expect(state.quotes.find((q) => q.id === 'q_5')!.status).toBe('sent')

    // expiration constatée à l'acceptation
    as('usr_pro1')
    const q = svc.quotes.request(db, { contact: { name: 'Désiré Akpo', email: 'pro@ecobloc.demo' }, deliveryAddress: addr(), lines: [{ productId: 'prd_pave-hexa-20', qty: 20 }] })
    as('usr_sales')
    svc.quotes.send(db, q.id, { lines: [{ productId: 'prd_pave-hexa-20', qty: 20, unitPrice: 450 }], discountPct: 0, deliveryFee: 15000, depositPct: 30, validUntil: '2026-11-30' })
    expectService(() => svc.quotes.send(db, q.id, { lines: [{ productId: 'prd_pave-hexa-20', qty: 20, unitPrice: 450 }], discountPct: 0, deliveryFee: 0, depositPct: 30, validUntil: '2020-01-01' }), /dans le futur/)
    state.quotes.find((x) => x.id === q.id)!.validUntil = '2026-10-01T00:00:00.000Z'
    as('usr_pro1')
    expectService(() => svc.quotes.accept(db, q.id), /a expiré/, 'expired')
    expect(state.quotes.find((x) => x.id === q.id)!.status).toBe('expired')

    // un devis de visiteur (sans compte) ne peut pas être converti
    as(null)
    const visitor = svc.quotes.request(db, { contact: { name: 'Prosper', email: 'prosper@exemple.demo' }, deliveryAddress: addr(), lines: [{ productId: 'prd_bordure-jardin-100', qty: 5 }] })
    expect(visitor.requesterUserId).toBeUndefined()
    as('usr_sales')
    svc.quotes.send(db, visitor.id, { lines: [{ productId: 'prd_bordure-jardin-100', qty: 5, unitPrice: 3200 }], discountPct: 0, deliveryFee: 15000, depositPct: 30, validUntil: '2026-11-30' })
    expectService(() => svc.quotes.accept(db, visitor.id), /sans compte/)
  })

  it('refus du devis (decline) par le client, avec motif', () => {
    const { db, state, as } = env
    as('usr_pro2')
    expectService(() => svc.quotes.decline(db, 'q_5', '  '), /motif/)
    svc.quotes.decline(db, 'q_5', 'Budget gelé')
    expect(state.quotes.find((q) => q.id === 'q_5')).toMatchObject({ status: 'declined', declineReason: 'Budget gelé' })
    expectService(() => svc.quotes.decline(db, 'q_5', 'encore'), /déjà clos/)
  })
})

describe('Stock libéré insuffisant — commande en attente', () => {
  it('marque awaitingStock, notifie la production et ne réserve aucun lot non libéré', () => {
    const { db, state, as } = env
    as('usr_client1')
    // le lot de dalles 40×40 est en contrôle (non libéré) : aucun stock vendable
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_dalle-allee-40', qty: 40 }], deliveryAddress: addr() })
    svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'mobile_money', kind: 'deposit' })
    as('usr_sales')
    const prepared = svc.orders.sendToPreparation(db, order.id)
    expect(prepared.status).toBe('in_preparation')
    expect(prepared.awaitingStock).toBe(true)
    expect(prepared.lines[0]!.allocations).toEqual([])
    const lot3 = state.productionLots.find((l) => l.id === 'lot_3')!
    expect(lot3).toMatchObject({ availableQty: 70, reservedQty: 0, qcStatus: 'in_qc' })
    const n = notificationsFor(db, (x) => !!x.roles?.includes('production') && x.title === 'Stock libéré insuffisant')
    expect(n).toHaveLength(1)
    expect(n[0]!.body).toMatch(/40 × Dalle Allée 40×40/)
    expect(n[0]!.level).toBe('warning')
    // la livraison existe mais ne peut pas être planifiée sans lots réservés
    as('usr_logi')
    expectService(() => svc.deliveries.plan(db, prepared.deliveryId!, { carrierId: 'car_3', plannedDate: '2026-11-03' }), /lots libérés/, 'awaiting_stock')
    // relancer l'allocation ne duplique pas l'alerte et ne réserve toujours rien
    svc.orders.allocate(db, order.id)
    expect(notificationsFor(db, (x) => x.title === 'Stock libéré insuffisant')).toHaveLength(1)
    expect(state.orders.find((o) => o.id === order.id)!.awaitingStock).toBe(true)
    expectStockInvariants(state)
  })

  it('tout ou rien : une commande de deux lignes dont une manque de stock ne réserve rien', () => {
    const { db, state, as } = env
    as('usr_pro1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 10 }, { productId: 'prd_pave-hexa-20', qty: 400 }], deliveryAddress: addr(), companyId: 'co_batiplus' })
    expect(order.lines).toHaveLength(1) // lignes d'un même produit regroupées
    expect(order.lines[0]!.qty).toBe(410)
    svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'bank_transfer', kind: 'deposit' })
    as('usr_sales')
    const prepared = svc.orders.sendToPreparation(db, order.id)
    expect(prepared.awaitingStock).toBe(true)
    expect(state.productionLots.find((l) => l.id === 'lot_1')).toMatchObject({ availableQty: 108, reservedQty: 60 })
    expectStockInvariants(state)
  })
})

describe('Règles de commande et de devis', () => {
  it('un produit en développement est refusé en devis ; un produit non autorisé n’est pas commandable directement', () => {
    const { db, as } = env
    as('usr_pro1')
    expectService(() => svc.quotes.request(db, { contact: { name: 'D. Akpo', email: 'pro@ecobloc.demo' }, deliveryAddress: addr(), lines: [{ productId: 'prd_couvre-mur-30', qty: 10 }] }), /en développement/, 'in_development')
    expectService(() => svc.quotes.request(db, { contact: { name: 'D. Akpo', email: 'pro@ecobloc.demo' }, deliveryAddress: addr(), lines: [{ productId: 'prd_pave-hexa-20', qty: 10 }, { productId: 'prd_caillebotis-50', qty: 5 }] }), /en développement/)
    // en test : devis possible…
    const q = svc.quotes.request(db, { contact: { name: 'D. Akpo', email: 'pro@ecobloc.demo' }, deliveryAddress: addr(), lines: [{ productId: 'prd_pave-renforce-80', qty: 100 }] })
    expect(q.status).toBe('requested')
    // …mais commande directe refusée (en test, résultats disponibles, ou prix sur devis)
    for (const pid of ['prd_pave-renforce-80', 'prd_pave-drainant-30', 'prd_dalle-terrasse-60', 'prd_couvre-mur-30']) {
      expectService(() => svc.orders.createDirect(db, { lines: [{ productId: pid, qty: 10 }], deliveryAddress: addr() }), /pas commandable/, 'not_orderable')
    }
    expect(env.state.orders.length).toBe(12) // rien créé
  })

  it('createDirect : zone, adresse et quantités sont validées', () => {
    const { db, as } = env
    as('usr_client1')
    expectService(() => svc.orders.createDirect(db, { lines: [], deliveryAddress: addr() }), /au moins un produit/)
    expectService(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 0 }], deliveryAddress: addr() }), /strictement positif/)
    expectService(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: { line: '', city: 'Cotonou', zone: 'z_cotonou' } }), /adresse/)
    expectService(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr('z_inconnue') }), /zone de livraison/)
    const ok = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr('z_calavi', 'Abomey-Calavi'), purchaseOrderRef: 'BC-1' })
    expect(ok).toMatchObject({ deliveryFee: 18000, subtotal: 2250, total: 20250, purchaseOrderRef: 'BC-1' })
    expect(env.state.invoices.find((i) => i.orderId === ok.id)).toMatchObject({ purchaseOrderRef: 'BC-1', simulated: true })
  })

  it('applique la grille tarifaire de l’entreprise sur une commande directe', () => {
    const { db, as } = env
    as('usr_pro1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 100 }], deliveryAddress: addr() })
    expect(order.lines[0]!.unitPrice).toBe(423)
    expect(order.companyId).toBe('co_batiplus')
  })
})

describe('Droits — ventes', () => {
  it('un client ne peut pas payer, annuler ou accepter pour un autre compte', () => {
    const { db, state, as } = env
    as('usr_client1')
    // ord_6 appartient à usr_client2
    expectDenied(() => svc.orders.pay(db, 'ord_6', { amount: 1000, method: 'cash', kind: 'deposit' }))
    expectDenied(() => svc.orders.cancel(db, 'ord_6', 'test'))
    expectDenied(() => svc.quotes.accept(db, 'q_5')) // devis de usr_pro2
    expectDenied(() => svc.quotes.negotiate(db, 'q_5', 'bonjour'))
    expect(state.orders.find((o) => o.id === 'ord_6')!.amountPaid).toBe(0)
    expect(state.payments.filter((p) => p.orderId === 'ord_6')).toHaveLength(0)
  })

  it('un membre de la même entreprise peut payer ; un membre en lecture seule non', () => {
    const { db, state, as } = env
    as('usr_pro1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 10 }], deliveryAddress: addr() })
    as('usr_pro1b', { companyRole: 'viewer' })
    expectDenied(() => svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'card', kind: 'deposit' }))
    as('usr_pro1b')
    expect(svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'card', kind: 'deposit' }).simulated).toBe(true)
    expect(state.orders.find((o) => o.id === order.id)!.status).toBe('confirmed')
    as('usr_pro2') // autre entreprise
    expectDenied(() => svc.orders.pay(db, order.id, { amount: 100, method: 'card', kind: 'balance' }))
  })

  it('refus des rôles : chauffeur, collecteur, commercial, client, visiteur', () => {
    const { db, as } = env
    as('usr_driver1')
    expectDenied(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr() }))
    expectDenied(() => svc.quotes.request(db, { contact: { name: 'X', email: 'x@y.zz' }, deliveryAddress: addr(), lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }] }))
    as('usr_coll1')
    expectDenied(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr() }))
    as(null)
    expectDenied(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr() }))
    as('usr_client1')
    expectDenied(() => svc.quotes.take(db, 'q_7'))
    expectDenied(() => svc.orders.refund(db, 'ord_2', 1000, 'test'))
    expectDenied(() => svc.orders.sendToPreparation(db, 'ord_6'))
    expectDenied(() => svc.deliveries.ship(db, 'del_6'))
    as('usr_logi')
    expectDenied(() => svc.quotes.send(db, 'q_6', { lines: [], discountPct: 0, deliveryFee: 0, depositPct: 30, validUntil: '2026-12-01' }))
    expectDenied(() => svc.orders.refund(db, 'ord_2', 1000, 'test'))
    as('usr_prod')
    expectDenied(() => svc.orders.allocate(db, 'ord_5'))
    expectDenied(() => svc.deliveries.deliver(db, 'del_3', { receivedBy: 'X' }))
  })
})
