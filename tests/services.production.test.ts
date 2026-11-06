import { beforeEach, describe, expect, it } from 'vitest'
import { productStock, rawStockByPolymer, services as svc } from '../shared/services'
import { addr, expectDenied, expectService, expectStockInvariants, makeEnv, notificationsFor, type Env } from './services-env'

let env: Env
beforeEach(() => { env = makeEnv() })

const wo = (n = 50) => ({ productId: 'prd_pave-rect-10', plannedQty: n, plannedStart: '2026-11-02', plannedEnd: '2026-11-04', operatorIds: ['op_1', 'op_2'], internalRecipeNote: 'Note interne de démonstration.' })

/** Saisit tous les résultats conformes d'un contrôle */
const passingResults = (flex = 5.2) => [
  { templateId: 'qct_dim', value: 0.8 }, { templateId: 'qct_aspect', passed: true }, { templateId: 'qct_water', value: 3.1 },
  { templateId: 'qct_flex', value: flex }, { templateId: 'qct_mass', value: 1.2 },
]

describe('Workflow C — fabrication → contrôle qualité → libération → vente', () => {
  it('parcourt tout le circuit ; seul le lot libéré peut alimenter une commande', () => {
    const { db, state, as } = env

    // Une commande de pavés 10×20 attend du stock libéré (aucun lot libéré pour ce produit)
    as('usr_client1')
    const order = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-rect-10', qty: 30 }], deliveryAddress: addr() })
    svc.orders.pay(db, order.id, { amount: order.depositAmount, method: 'mobile_money', kind: 'deposit' })
    as('usr_sales')
    expect(svc.orders.sendToPreparation(db, order.id).awaitingStock).toBe(true)

    // 1. ordre de fabrication
    as('usr_prod')
    const w = svc.production.createOrder(db, wo(50))
    expect(w).toMatchObject({ status: 'planned', plannedQty: 50, producedQty: 0, materialKgPlanned: 63, reservations: [] })
    expect(w.ref).toMatch(/^OF-\d{4}-\d{4}$/)
    expect(notificationsFor(db, (n) => !!n.roles?.includes('procurement') && n.title === 'Matière à prévoir')).toHaveLength(1)
    expectService(() => svc.production.start(db, w.id), /Réservez la matière/, 'materials_missing')

    // 2. réservation FIFO de matière disponible uniquement (quarantaine exclue)
    expectService(() => svc.production.reserve(db, w.id, [{ rawLotId: 'rlot_9', kg: 10 }]), /quarantaine/, 'lot_unavailable')
    expectService(() => svc.production.reserve(db, w.id, [{ rawLotId: 'rlot_11', kg: 100 }]), /disponibles/, 'stock_insufficient')
    const reserved = svc.production.reserve(db, w.id)
    expect(reserved.status).toBe('materials_reserved')
    expect(reserved.reservations).toEqual([{ rawLotId: 'rlot_11', kg: 20 }, { rawLotId: 'rlot_12', kg: 43 }]) // FIFO par date de réception
    expect(state.rawLots.find((l) => l.id === 'rlot_11')).toMatchObject({ kgAvailable: 0, kgReserved: 120 })
    expect(state.rawLots.find((l) => l.id === 'rlot_12')).toMatchObject({ kgAvailable: 17, kgReserved: 393 })
    expect(state.rawLots.find((l) => l.id === 'rlot_9')).toMatchObject({ status: 'quarantine', kgReserved: 0 }) // intact
    expect(state.stockMovements.filter((m) => m.refType === 'work_order' && m.refId === w.id && m.type === 'reservation')).toHaveLength(2)
    expectStockInvariants(state)
    expectService(() => svc.production.reserve(db, w.id), /déjà toute sa matière/)

    // 3. démarrage, pause, reprise, événements
    expect(svc.production.start(db, w.id).status).toBe('in_progress')
    expectService(() => svc.production.start(db, w.id), /ne peut pas être démarré/)
    expect(svc.production.pause(db, w.id).status).toBe('paused')
    expect(svc.production.resume(db, w.id).status).toBe('in_progress')
    const ev = svc.production.logEvent(db, w.id, { type: 'stop', severity: 'high', description: 'Panne du broyeur.', durationMin: 45 })
    expect(ev).toMatchObject({ workOrderId: w.id, resolved: false, durationMin: 45 })
    expect(notificationsFor(db, (n) => !!n.roles?.includes('quality') && n.title === 'Arrêt de production')).toHaveLength(1)
    expectService(() => svc.production.logEvent(db, w.id, { type: 'note', severity: 'low', description: ' ' }), /description/)

    // 4. enregistrement et clôture → lot pending_qc avec traçabilité amont
    expectService(() => svc.production.complete(db, w.id), /Enregistrez la production/)
    expectService(() => svc.production.record(db, w.id, { producedQty: 48, scrapQty: 2, materialKgConsumed: 70 }), /dépasse la matière réservée/, 'over_reserved')
    svc.production.record(db, w.id, { producedQty: 48, scrapQty: 2, materialKgConsumed: 60 })
    expect(state.workOrders.find((x) => x.id === w.id)).toMatchObject({ producedQty: 48, scrapQty: 2, materialKgConsumed: 60 })
    const lot = svc.production.complete(db, w.id)
    expect(lot).toMatchObject({ qcStatus: 'pending_qc', producedQty: 48, scrapQty: 2, availableQty: 48, reservedQty: 0, shippedQty: 0, workOrderId: w.id, productId: 'prd_pave-rect-10' })
    expect(lot.ref).toMatch(/^LOT-\d{4}-\d{4}$/)
    expect(lot.rawInputs).toEqual([{ rawLotId: 'rlot_11', kg: 20 }, { rawLotId: 'rlot_12', kg: 40 }])
    expect(state.workOrders.find((x) => x.id === w.id)).toMatchObject({ status: 'completed', lotId: lot.id, reservations: [] })
    // les réservations sont consommées ; le non-consommé (3 kg) retourne au disponible
    expect(state.rawLots.find((l) => l.id === 'rlot_11')).toMatchObject({ kgReserved: 100, kgConsumed: 420, kgAvailable: 0 })
    expect(state.rawLots.find((l) => l.id === 'rlot_12')).toMatchObject({ kgReserved: 350, kgConsumed: 110, kgAvailable: 20 })
    expectStockInvariants(state)
    expect(lot.rawInputs.reduce((s, r) => s + r.kg, 0)).toBe(60)
    expect(state.stockMovements.some((m) => m.itemId === lot.id && m.type === 'in' && m.qty === 48)).toBe(true)
    expect(notificationsFor(db, (n) => !!n.roles?.includes('quality') && n.title === 'Lot en attente de contrôle' && (n.body ?? '').includes(lot.ref))).toHaveLength(1)
    // non vendable tant qu'il n'est pas libéré
    expect(productStock(db, 'prd_pave-rect-10')).toMatchObject({ availableToSell: 0, pendingQc: 48, total: 48 })
    as('usr_sales')
    expect(svc.orders.allocate(db, order.id).awaitingStock).toBe(true)
    expect(state.productionLots.find((l) => l.id === lot.id)!.reservedQty).toBe(0)

    // 5. contrôle qualité
    as('usr_prod')
    const insp = svc.quality.request(db, lot.id)
    expect(insp).toMatchObject({ status: 'pending', lotId: lot.id, assignedTo: 'usr_qual' })
    expect(insp.ref).toMatch(/^QC-\d{4}-\d{4}$/)
    expect(insp.results.map((r) => r.templateId)).toEqual(['qct_dim', 'qct_aspect', 'qct_water', 'qct_flex', 'qct_mass'])
    expect(state.productionLots.find((l) => l.id === lot.id)).toMatchObject({ qcStatus: 'in_qc', inspectionIds: [insp.id] })
    expectService(() => svc.quality.request(db, lot.id), /déjà en cours/)
    expectDenied(() => svc.quality.record(db, insp.id, passingResults()))
    expectDenied(() => svc.quality.decide(db, insp.id, { decision: 'accepted', reason: 'ok' }))

    as('usr_qual')
    // aucun résultat saisi : libération refusée
    expectService(() => svc.quality.decide(db, insp.id, { decision: 'accepted', reason: 'Tout est bon.' }), /n’est pas saisi/, 'criteria_not_met')
    expectService(() => svc.quality.decide(db, insp.id, { decision: 'accepted', reason: ' ' }), /motif/)
    // résultats partiels : flexion (requise) manquante
    const partial = svc.quality.record(db, insp.id, passingResults().filter((r) => r.templateId !== 'qct_flex'))
    expect(partial.status).toBe('in_progress')
    expectService(() => svc.quality.decide(db, insp.id, { decision: 'accepted', reason: 'Presque.' }), /Résistance en flexion \(indicative\)» n’est pas saisi|Résistance en flexion \(indicative\) » n’est pas saisi|flexion/)
    // hors critère : 3,5 MPa < 4 MPa → refus, et `passed` est calculé par le service (pas fourni par l'appelant)
    const failing = svc.quality.record(db, insp.id, [{ templateId: 'qct_flex', value: 3.5, passed: true }])
    expect(failing.results.find((r) => r.templateId === 'qct_flex')).toMatchObject({ value: 3.5, passed: false })
    expectService(() => svc.quality.decide(db, insp.id, { decision: 'accepted', reason: 'On passe quand même.' }), /hors critère/)
    expect(state.productionLots.find((l) => l.id === lot.id)!.qcStatus).toBe('in_qc')
    expectService(() => svc.quality.record(db, insp.id, [{ templateId: 'qct_flex', passed: true }]), /valeur mesurée/)
    expectService(() => svc.quality.record(db, insp.id, [{ templateId: 'qct_inconnu', value: 1 }]), /référentiel/)
    // un test non requis hors critère ne bloque pas (écart de masse)
    svc.quality.record(db, insp.id, [{ templateId: 'qct_flex', value: 5.2 }, { templateId: 'qct_mass', value: 9 }])
    const done = svc.quality.decide(db, insp.id, { decision: 'accepted', reason: 'Tous les tests requis sont conformes (valeurs de démonstration).' })
    expect(done).toMatchObject({ status: 'completed', decision: 'accepted', decidedBy: 'usr_qual' })
    expect(done.decidedAt).toBeTruthy()
    const released = state.productionLots.find((l) => l.id === lot.id)!
    expect(released).toMatchObject({ qcStatus: 'released', releasedBy: 'usr_qual' })
    expect(released.releasedAt).toBeTruthy()
    expectService(() => svc.quality.decide(db, insp.id, { decision: 'rejected', reason: 'Trop tard.' }), /déjà clôturé/)
    expectService(() => svc.quality.request(db, lot.id), /déjà libéré/)
    expect(productStock(db, 'prd_pave-rect-10')).toMatchObject({ released: 48, availableToSell: 48, pendingQc: 0 })
    expect(notificationsFor(db, (n) => !!n.roles?.includes('production') && n.title === 'Lot libéré' && n.href === `/ops/production/lots/${lot.id}`)).toHaveLength(1)
    expect(notificationsFor(db, (n) => !!n.roles?.includes('sales') && n.title === 'Lot libéré : commandes en attente')).toHaveLength(1)

    // 6. seul ce lot libéré alimente maintenant la commande en attente
    as('usr_sales')
    const allocated = svc.orders.allocate(db, order.id)
    expect(allocated.awaitingStock).toBe(false)
    expect(allocated.lines[0]!.allocations).toEqual([{ lotId: lot.id, qty: 30 }])
    expect(state.productionLots.find((l) => l.id === lot.id)).toMatchObject({ availableQty: 18, reservedQty: 30 })
    // les lots non libérés du seed n'ont jamais été touchés
    for (const id of ['lot_3', 'lot_4', 'lot_5', 'lot_6']) expect(state.productionLots.find((l) => l.id === id)!.reservedQty).toBe(0)
    expectStockInvariants(state)
  })

  it('annulation d’un ordre : libère les réservations de matière ; refus s’il a déjà consommé', () => {
    const { db, state, as } = env
    as('usr_prod')
    const w = svc.production.createOrder(db, wo(40))
    svc.production.reserve(db, w.id)
    expect(state.rawLots.find((l) => l.id === 'rlot_11')!.kgReserved).toBe(120)
    expectService(() => svc.production.cancel(db, w.id, ' '), /motif/)
    const cancelled = svc.production.cancel(db, w.id, 'Commande annulée')
    expect(cancelled).toMatchObject({ status: 'cancelled', reservations: [] })
    expect(state.rawLots.find((l) => l.id === 'rlot_11')).toMatchObject({ kgReserved: 100, kgAvailable: 20 })
    expect(notificationsFor(db, (n) => n.title === 'Matière libérée')).toHaveLength(1)
    expectService(() => svc.production.cancel(db, w.id, 'encore'), /déjà annulé/)
    expectStockInvariants(state)

    const w2 = svc.production.createOrder(db, wo(40))
    svc.production.reserve(db, w2.id)
    svc.production.start(db, w2.id)
    svc.production.record(db, w2.id, { producedQty: 10, scrapQty: 0, materialKgConsumed: 12 })
    expectService(() => svc.production.cancel(db, w2.id, 'Annulation tardive'), /clôturez l’ordre/)
  })

  it('refuse de réserver plus de matière disponible que le stock (jamais de stock négatif)', () => {
    const { db, state, as } = env
    as('usr_prod')
    const big = svc.production.createOrder(db, wo(200)) // 252 kg > 110 kg disponibles
    expectService(() => svc.production.reserve(db, big.id), /Matière disponible insuffisante.*il manque 142 kg/, 'stock_insufficient')
    expect(state.workOrders.find((w) => w.id === big.id)!.reservations).toEqual([])
    expect(state.rawLots.find((l) => l.id === 'rlot_12')).toMatchObject({ kgAvailable: 60, kgReserved: 350 })
    // réservation explicite supérieure au disponible d'un lot
    expectService(() => svc.production.reserve(db, big.id, [{ rawLotId: 'rlot_13', kg: 31 }]), /30 kg disponibles/)
    // la réservation explicite fonctionne dans la limite du disponible, et on ne consomme que du réservé
    svc.production.reserve(db, big.id, [{ rawLotId: 'rlot_13', kg: 30 }])
    expect(state.rawLots.find((l) => l.id === 'rlot_13')).toMatchObject({ kgAvailable: 0, kgReserved: 250 })
    expectStockInvariants(state)
  })

  it('alerte la production et l’appro quand le disponible d’un polymère passe sous son seuil', () => {
    const { db, state, as } = env
    // dans le seed, tous les polymères sont déjà sous leur seuil : on réceptionne 600 kg de PET (seuil 500)
    as('usr_appro')
    const receipt = svc.receipts.confirm(db, { supplierId: 'sup_4', lines: [{ polymer: 'PET', weighedKg: 600, acceptedKg: 600, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] })
    const newLot = state.rawLots.find((l) => l.receiptId === receipt.id)!
    expect(rawStockByPolymer(db).PET).toMatchObject({ available: 620, belowThreshold: false, thresholdKg: 500 })
    const before = notificationsFor(db, (n) => n.title === 'Stock matière à surveiller').length
    as('usr_prod')
    const w = svc.production.createOrder(db, wo(10))
    svc.production.reserve(db, w.id, [{ rawLotId: 'rlot_13', kg: 5 }]) // PP déjà sous le seuil : pas de nouvelle alerte
    expect(notificationsFor(db, (n) => n.title === 'Stock matière à surveiller')).toHaveLength(before)
    svc.production.reserve(db, w.id, [{ rawLotId: newLot.id, kg: 200 }]) // PET : 620 → 420 < 500
    const alerts = notificationsFor(db, (n) => n.title === 'Stock matière à surveiller')
    expect(alerts).toHaveLength(before + 1)
    expect(alerts[0]!.body).toMatch(/PET \(420 kg\).*500 kg/)
    expect(alerts[0]!.roles).toEqual(['procurement', 'production'])
  })

  it('rejet et quarantaine d’un lot : jamais vendable', () => {
    const { db, state, as } = env
    // rejet : lot_5 (dalles terrasse), contrôle qc_5 déjà demandé dans le seed ; demander un second contrôle est refusé
    as('usr_prod')
    expectService(() => svc.quality.request(db, 'lot_5'), /déjà en cours/)
    as('usr_qual')
    const i5 = { id: 'qc_5' }
    svc.quality.record(db, i5.id, [{ templateId: 'qct_water', value: 9.2 }, { templateId: 'qct_aspect', passed: false }])
    expectService(() => svc.quality.decide(db, i5.id, { decision: 'accepted', reason: 'Essai.' }), /hors critère/)
    const rejected = svc.quality.decide(db, i5.id, { decision: 'rejected', reason: 'Absorption d’eau et aspect hors critères.' })
    expect(rejected).toMatchObject({ status: 'completed', decision: 'rejected' })
    expect(state.productionLots.find((l) => l.id === 'lot_5')).toMatchObject({ qcStatus: 'rejected', availableQty: 12, reservedQty: 0 })
    expect(state.productionLots.find((l) => l.id === 'lot_5')!.releasedAt).toBeUndefined()
    expect(productStock(db, 'prd_dalle-terrasse-60')).toMatchObject({ availableToSell: 0, released: 0, total: 12 })
    as('usr_prod')
    expectService(() => svc.quality.request(db, 'lot_5'), /rejeté/)

    // quarantaine : lot_3 (inspection seed en cours, résultats incomplets)
    as('usr_qual')
    expectService(() => svc.quality.decide(db, 'qc_3', { decision: 'accepted', reason: 'Essai.' }), /flexion/)
    const q = svc.quality.decide(db, 'qc_3', { decision: 'quarantine', reason: 'Résultat de flexion manquant : nouveaux essais demandés.' })
    expect(q.decision).toBe('quarantine')
    expect(state.productionLots.find((l) => l.id === 'lot_3')).toMatchObject({ qcStatus: 'quarantine', availableQty: 70 })
    expect(productStock(db, 'prd_dalle-allee-40').availableToSell).toBe(0)
    // un lot en quarantaine peut être recontrôlé, puis libéré une fois tous les critères respectés
    as('usr_prod')
    const again = svc.quality.request(db, 'lot_3')
    as('usr_qual')
    svc.quality.record(db, again.id, passingResults())
    svc.quality.decide(db, again.id, { decision: 'accepted', reason: 'Nouveaux essais conformes (démonstration).' })
    expect(productStock(db, 'prd_dalle-allee-40').availableToSell).toBe(70)
    expect(state.productionLots.find((l) => l.id === 'lot_3')!.inspectionIds).toEqual(['qc_3', again.id])
    expectStockInvariants(state)
  })

  it('rattache un rapport d’essai à un contrôle (type test_report uniquement)', () => {
    const { db, state, as } = env
    as('usr_qual')
    expectService(() => svc.quality.attachReport(db, 'qc_3', 'doc_cgv'), /pas un rapport d’essai/)
    expectService(() => svc.quality.attachReport(db, 'qc_3', 'doc_inconnu'), /introuvable/)
    svc.quality.attachReport(db, 'qc_3', 'doc_test_a40')
    expect(state.qcInspections.find((q) => q.id === 'qc_3')!.reportDocumentId).toBe('doc_test_a40')
    as('usr_sales')
    expectDenied(() => svc.quality.attachReport(db, 'qc_3', 'doc_test_a40'))
  })

  it('refus des rôles : un client ne libère pas, un commercial ne décide pas de qualité', () => {
    const { db, state, as } = env
    for (const user of ['usr_client1', 'usr_pro1', 'usr_sales', 'usr_logi', 'usr_appro', 'usr_driver1', 'usr_coll1', 'usr_env']) {
      as(user)
      expectDenied(() => svc.quality.decide(db, 'qc_3', { decision: 'accepted', reason: 'Je libère.' }))
      expectDenied(() => svc.quality.record(db, 'qc_3', [{ templateId: 'qct_flex', value: 6 }]))
    }
    for (const user of ['usr_client1', 'usr_sales', 'usr_logi', 'usr_appro', 'usr_driver1', 'usr_coll1', 'usr_qual']) {
      as(user)
      expectDenied(() => svc.production.createOrder(db, wo()))
      expectDenied(() => svc.production.reserve(db, 'of_4'))
      expectDenied(() => svc.production.complete(db, 'of_5'))
    }
    as('usr_prod') // la production demande des contrôles mais ne décide pas
    expectDenied(() => svc.quality.decide(db, 'qc_3', { decision: 'accepted', reason: 'Je libère.' }))
    expect(state.productionLots.find((l) => l.id === 'lot_3')!.qcStatus).toBe('in_qc')
    as('usr_logi')
    expectDenied(() => svc.quality.request(db, 'lot_5'))
  })
})

describe('Stock — ajustements, pertes, transferts', () => {
  it('ajuste un lot de matière sans jamais descendre sous le réservé', () => {
    const { db, state, as } = env
    as('usr_appro')
    // rlot_12 : 60 disponibles + 350 réservés = 410 kg physiques
    expectService(() => svc.inventory.adjustRaw(db, 'rlot_12', 300, 'Comptage'), /inférieure au réservé/, 'below_reserved')
    expectService(() => svc.inventory.adjustRaw(db, 'rlot_12', 400, ' '), /motif/)
    expectService(() => svc.inventory.adjustRaw(db, 'rlot_12', 410, 'Comptage'), /identique/)
    const lot = svc.inventory.adjustRaw(db, 'rlot_12', 400, 'Comptage physique : sacs manquants')
    expect(lot).toMatchObject({ kgAvailable: 50, kgReserved: 350, kgInitial: 470 })
    expect(state.stockMovements.find((m) => m.type === 'adjustment' && m.itemId === 'rlot_12')).toMatchObject({ qty: -10, unit: 'kg' })
    expectService(() => svc.inventory.adjustRaw(db, 'rlot_12', -5, 'x'), /positif/)
    // vidé puis retrouvé
    expect(svc.inventory.adjustRaw(db, 'rlot_13', 220, 'Comptage')).toMatchObject({ kgAvailable: 0, status: 'available' })
    expectStockInvariants(state)
    as('usr_logi')
    expectDenied(() => svc.inventory.adjustRaw(db, 'rlot_12', 400, 'Comptage'))
    as('usr_sales')
    expectDenied(() => svc.inventory.recordLoss(db, 'rlot_12', 1, 'x'))
  })

  it('enregistre une perte, bornée au disponible (jamais de stock négatif)', () => {
    const { db, state, as } = env
    as('usr_appro')
    expectService(() => svc.inventory.recordLoss(db, 'rlot_13', 40, 'Humidité'), /dépasse le stock disponible/, 'stock_insufficient')
    const lot = svc.inventory.recordLoss(db, 'rlot_13', 30, 'Humidité : sacs détrempés')
    expect(lot).toMatchObject({ kgAvailable: 0, kgReserved: 220, kgInitial: 270, status: 'available' })
    expect(state.stockMovements.find((m) => m.type === 'loss' && m.itemId === 'rlot_13' && m.qty === 30)).toBeTruthy()
    expectStockInvariants(state)
  })

  it('ajuste un lot de produits finis : ni sous le réservé, ni au-delà de ce qui a été produit', () => {
    const { db, state, as } = env
    as('usr_prod')
    // lot_1 : 108 disponibles + 60 réservés = 168 ; produit 388, expédié 220 → maximum 168
    expectService(() => svc.inventory.adjustFinished(db, 'lot_1', 50, 'Casse constatée'), /inférieure aux pièces réservées/, 'below_reserved')
    expectService(() => svc.inventory.adjustFinished(db, 'lot_1', 200, 'Trouvé'), /dépasse/)
    expectService(() => svc.inventory.adjustFinished(db, 'lot_1', 168, 'Comptage'), /identique/)
    const lot = svc.inventory.adjustFinished(db, 'lot_1', 160, 'Casse constatée lors du comptage')
    expect(lot).toMatchObject({ availableQty: 100, reservedQty: 60 })
    expect(productStock(db, 'prd_pave-hexa-20').availableToSell).toBe(100)
    expectStockInvariants(state)
  })

  it('transfère un lot entier vers un emplacement compatible', () => {
    const { db, state, as } = env
    as('usr_appro')
    expectService(() => svc.inventory.transfer(db, { itemKind: 'raw', itemId: 'rlot_11', toLocationId: 'loc_quar' }), /ne peut aller que vers un emplacement de matière/)
    expectService(() => svc.inventory.transfer(db, { itemKind: 'raw', itemId: 'rlot_9', toLocationId: 'loc_raw_a' }), /quarantaine/)
    expectService(() => svc.inventory.transfer(db, { itemKind: 'raw', itemId: 'rlot_11', toLocationId: 'loc_raw_a' }), /déjà à l’emplacement/)
    expectService(() => svc.inventory.transfer(db, { itemKind: 'raw', itemId: 'rlot_11', toLocationId: 'loc_raw_b', qty: 5 }), /partiel/)
    const moved = svc.inventory.transfer(db, { itemKind: 'raw', itemId: 'rlot_11', toLocationId: 'loc_raw_b' })
    expect(moved).toMatchObject({ locationId: 'loc_raw_b' })
    expect(state.stockMovements.find((m) => m.type === 'transfer' && m.itemId === 'rlot_11')).toMatchObject({ fromLocationId: 'loc_raw_a', toLocationId: 'loc_raw_b' })
    as('usr_logi')
    expectService(() => svc.inventory.transfer(db, { itemKind: 'finished', itemId: 'lot_1', toLocationId: 'loc_raw_a' }), /aire de produits finis/)
    expect(svc.inventory.transfer(db, { itemKind: 'finished', itemId: 'lot_1', toLocationId: 'loc_fin_2' })).toMatchObject({ locationId: 'loc_fin_2' })
    as('usr_client1')
    expectDenied(() => svc.inventory.transfer(db, { itemKind: 'finished', itemId: 'lot_1', toLocationId: 'loc_fin_1' }))
  })
})
