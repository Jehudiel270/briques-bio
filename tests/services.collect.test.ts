import { beforeEach, describe, expect, it } from 'vitest'
import { rawStockByPolymer, services as svc } from '../shared/services'
import { expectDenied, expectService, expectStockInvariants, makeEnv, notificationsFor, type Env } from './services-env'

let env: Env
beforeEach(() => { env = makeEnv() })

const pickup = { line: 'Dépôt de la coopérative', city: 'Abomey-Calavi', label: 'Dépôt de la coopérative' }

describe('Workflow B — collecte → réception → lots de matière → rémunération simulée', () => {
  it('parcourt tout le circuit : demande, examen, planification, chauffeur, réception, paiement simulé', () => {
    const { db, state, as } = env

    // 1. demande par le collecteur (sup_1 : coopérative approuvée)
    as('usr_coll1')
    const col = svc.collections.request(db, { polymers: [{ code: 'PET', estimatedKg: 200 }, { code: 'HDPE', estimatedKg: 100 }], pickupPoint: pickup, preferredSlots: ['Matin'], notes: 'Sacs de 20 kg.' })
    expect(col).toMatchObject({ status: 'submitted', supplierId: 'sup_1', estimatedTotalKg: 300 })
    expect(col.ref).toMatch(/^COL-\d{4}-\d{4}$/)
    expect(notificationsFor(db, (n) => !!n.roles?.includes('procurement') && n.href === `/ops/appro/demandes/${col.id}`)).toHaveLength(1)

    // 2. examen puis planification avec chauffeur (une tournée est créée)
    as('usr_appro')
    const reviewed = svc.collections.review(db, col.id, { accept: true, proposedSlots: ['2026-11-03T09:00:00.000Z'] })
    expect(reviewed.status).toBe('under_review')
    expect(reviewed.proposedSlots).toHaveLength(1)
    expect(notificationsFor(db, (n) => n.userId === 'usr_coll1' && n.title === 'Demande de collecte acceptée')).toHaveLength(1)
    expectService(() => svc.collections.plan(db, col.id, { scheduledAt: '2026-11-03T09:00:00.000Z', driverUserId: 'usr_sales' }), /pas un chauffeur/)
    expectService(() => svc.collections.plan(db, col.id, { scheduledAt: '2020-01-01T09:00:00.000Z', driverUserId: 'usr_driver1' }), /passé/)
    const planned = svc.collections.plan(db, col.id, { scheduledAt: '2026-11-03T09:00:00.000Z', driverUserId: 'usr_driver1' })
    expect(planned).toMatchObject({ status: 'planned', driverUserId: 'usr_driver1' })
    const tour = state.tours.find((t) => t.id === planned.tourId)!
    expect(tour).toMatchObject({ driverUserId: 'usr_driver1', status: 'planned', collectionIds: [col.id], carrierId: 'car_3' })
    expect(tour.ref).toMatch(/^TRN-\d{4}-\d{4}$/)
    expect(notificationsFor(db, (n) => n.userId === 'usr_driver1' && n.href === `/terrain/collectes/${col.id}`)).toHaveLength(1)

    // une seconde collecte le même jour pour le même chauffeur complète la tournée existante
    as('usr_coll1')
    const col2 = svc.collections.request(db, { polymers: [{ code: 'PP', estimatedKg: 80 }], pickupPoint: pickup, preferredSlots: [] })
    as('usr_appro')
    const planned2 = svc.collections.plan(db, col2.id, { scheduledAt: '2026-11-03T14:00:00.000Z', driverUserId: 'usr_driver1' })
    expect(planned2.tourId).toBe(tour.id)
    expect(state.tours.find((t) => t.id === tour.id)!.collectionIds).toEqual([col.id, col2.id])

    // 3. mises à jour du chauffeur (seul le chauffeur assigné)
    as('usr_driver2')
    expectDenied(() => svc.collections.driverUpdate(db, col.id, { status: 'en_route' }))
    as('usr_driver1')
    expect(svc.collections.driverUpdate(db, col.id, { status: 'en_route' }).status).toBe('en_route')
    expect(state.tours.find((t) => t.id === tour.id)).toMatchObject({ status: 'in_progress' })
    expectService(() => svc.collections.driverUpdate(db, col.id, { status: 'en_route' }), /déjà/)
    expectService(() => svc.collections.driverUpdate(db, col.id, { status: 'problem' }), /motif/)
    const collected = svc.collections.driverUpdate(db, col.id, { status: 'collected', proof: { note: '15 sacs fermés.' }, recordedKg: 308 })
    expect(collected.proof).toMatchObject({ note: '15 sacs fermés.' })
    expectService(() => svc.collections.driverUpdate(db, col2.id, { status: 'weighed' }), /poids relevé/)
    const weighed = svc.collections.driverUpdate(db, col.id, { status: 'weighed', recordedKg: 310 })
    expect(weighed).toMatchObject({ status: 'weighed', recordedKg: 310 })
    expect(notificationsFor(db, (n) => !!n.roles?.includes('procurement') && n.title === 'Collecte pesée')).toHaveLength(1)
    expect(weighed.history.map((h) => h.action)).toEqual(expect.arrayContaining(['Chauffeur en route', 'Collectée', 'Pesée enregistrée']))

    // 4. réception pesée : acceptés / rejetés / quarantaine
    as('usr_appro')
    const lotsBefore = state.rawLots.length
    const pet = rawStockByPolymer(db).PET
    expectService(() => svc.receipts.confirm(db, { collectionId: col.id, supplierId: 'sup_1', lines: [{ polymer: 'PET', weighedKg: 205, acceptedKg: 190, rejectedKg: 5, quarantineKg: 5, decision: 'partial' }] }), /doit égaler/)
    expectService(() => svc.receipts.confirm(db, { collectionId: col2.id, supplierId: 'sup_1', lines: [{ polymer: 'PP', weighedKg: 80, acceptedKg: 80, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }), /doit d’abord être enlevée/)
    const receipt = svc.receipts.confirm(db, {
      collectionId: col.id, supplierId: 'sup_1', notes: 'Pesée à la bascule 1.',
      lines: [
        { polymer: 'PET', weighedKg: 205, acceptedKg: 195, rejectedKg: 5, quarantineKg: 5, contaminationPct: 4.1, decision: 'partial', reason: 'Étiquettes et un sac à contrôler' },
        { polymer: 'HDPE', weighedKg: 105, acceptedKg: 105, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' },
      ],
    })
    expect(receipt.ref).toMatch(/^RCP-\d{4}-\d{4}$/)
    expect(receipt).toMatchObject({ weighedKg: 310, declaredKg: 300, status: 'closed', collectionId: col.id })
    expect(receipt.lines.map((l) => l.decision)).toEqual(['partial', 'accepted'])

    // lots de matière : acceptés (available) et quarantaine, jamais pour les rejetés
    const lots = state.rawLots.filter((l) => l.receiptId === receipt.id)
    expect(state.rawLots.length).toBe(lotsBefore + 3)
    expect(lots.map((l) => `${l.polymer}:${l.status}:${l.kgInitial}`).sort()).toEqual(['HDPE:available:105', 'PET:available:195', 'PET:quarantine:5'])
    expect(lots.reduce((s, l) => s + l.kgInitial, 0)).toBe(205 + 105 - 5) // 5 kg rejetés : aucun lot
    for (const l of lots) expect(l.kgAvailable).toBe(l.kgInitial)
    expect(lots.find((l) => l.status === 'quarantine')!.locationId).toBe('loc_quar')
    expect(lots.find((l) => l.polymer === 'PET' && l.status === 'available')!.locationId).toBe('loc_raw_a')
    expect(state.stockMovements.filter((m) => m.refType === 'receipt' && m.refId === receipt.id && m.type === 'in')).toHaveLength(3)
    expect(rawStockByPolymer(db).PET.available).toBe(pet.available + 195)
    expect(rawStockByPolymer(db).PET.quarantine).toBe(pet.quarantine + 5)
    expect(state.collections.find((c) => c.id === col.id)).toMatchObject({ status: 'received', receiptId: receipt.id })
    expectService(() => svc.receipts.confirm(db, { collectionId: col.id, supplierId: 'sup_1', lines: [{ polymer: 'PET', weighedKg: 1, acceptedKg: 1, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }), /déjà été réceptionnée/)
    expect(state.tours.find((t) => t.id === tour.id)!.status).toBe('in_progress') // col2 pas encore traitée

    // 5. rémunération simulée : seuls les kg acceptés sont rémunérés, au prix du polymère
    expect(receipt.payout).toEqual({ amount: 195 * 90 + 105 * 120, status: 'pending' })
    as('usr_coll1')
    expectDenied(() => svc.receipts.pay(db, receipt.id))
    as('usr_appro')
    const paid = svc.receipts.pay(db, receipt.id)
    expect(paid.payout).toMatchObject({ status: 'paid_simulated', amount: 30150 })
    expect(paid.payout!.ref).toMatch(/^SIM-/)
    expect(paid.payout!.paidAt).toBeTruthy()
    expectService(() => svc.receipts.pay(db, receipt.id), /déjà versée/)
    expect(notificationsFor(db, (n) => n.userId === 'usr_coll1' && n.title === 'Rémunération simulée versée')).toHaveLength(1)
    expectStockInvariants(state)
  })

  it('pas de rémunération pour un fournisseur non rémunéré, ni si la fonctionnalité est désactivée', () => {
    const { db, state, as } = env
    as('usr_appro')
    const r = svc.receipts.confirm(db, { supplierId: 'sup_4', lines: [{ polymer: 'PET', weighedKg: 100, acceptedKg: 100, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] })
    expect(r.payout).toBeUndefined() // paymentModel: none
    expect(r.declaredKg).toBe(100)
    expectService(() => svc.receipts.pay(db, r.id), /pas de rémunération/)
    state.settings[0]!.features.collectorPayouts = false
    const r2 = svc.receipts.confirm(db, { supplierId: 'sup_1', lines: [{ polymer: 'PP', weighedKg: 50, acceptedKg: 50, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] })
    expect(r2.payout).toBeUndefined()
  })

  it('un lot 100 % rejeté ou 100 % en quarantaine ne crée pas de lot disponible ni de rémunération', () => {
    const { db, state, as } = env
    as('usr_appro')
    const n = state.rawLots.length
    const r = svc.receipts.confirm(db, {
      supplierId: 'sup_3', lines: [
        { polymer: 'PET', weighedKg: 40, acceptedKg: 0, rejectedKg: 40, quarantineKg: 0, decision: 'rejected', reason: 'PVC mélangé' },
        { polymer: 'PP', weighedKg: 30, acceptedKg: 0, rejectedKg: 0, quarantineKg: 30, decision: 'quarantine', reason: 'Odeur suspecte' },
      ],
    })
    expect(r.lines.map((l) => l.decision)).toEqual(['rejected', 'quarantine'])
    expect(r.payout).toBeUndefined()
    const created = state.rawLots.slice(0, state.rawLots.length - n)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ polymer: 'PP', status: 'quarantine', kgInitial: 30 })
  })

  it('refuse les polymères non acceptés (demande et réception)', () => {
    const { db, as } = env
    as('usr_coll1')
    expectService(() => svc.collections.request(db, { polymers: [{ code: 'PVC', estimatedKg: 100 }], pickupPoint: pickup, preferredSlots: [] }), /PVC \(3\) n’est pas accepté/, 'polymer_refused')
    expectService(() => svc.collections.request(db, { polymers: [{ code: 'PET', estimatedKg: 50 }, { code: 'PS', estimatedKg: 10 }], pickupPoint: pickup, preferredSlots: [] }), /PS \(6\) n’est pas accepté/)
    expectService(() => svc.collections.request(db, { polymers: [], pickupPoint: pickup, preferredSlots: [] }), /au moins un type/)
    expectService(() => svc.collections.request(db, { polymers: [{ code: 'PET', estimatedKg: 0 }], pickupPoint: pickup, preferredSlots: [] }), /strictement positif/)
    expect(env.state.collections).toHaveLength(12)
    as('usr_appro')
    expectService(() => svc.receipts.confirm(db, { supplierId: 'sup_1', lines: [{ polymer: 'PVC', weighedKg: 20, acceptedKg: 20, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }), /n’est pas accepté/, 'polymer_refused')
    // le PVC peut en revanche être rejeté à la réception
    const ok = svc.receipts.confirm(db, { supplierId: 'sup_1', lines: [{ polymer: 'PVC', weighedKg: 20, acceptedKg: 0, rejectedKg: 20, quarantineKg: 0, decision: 'rejected', reason: 'Non accepté' }] })
    expect(ok.lines[0]!.decision).toBe('rejected')
  })

  it('refuse un fournisseur en attente de validation et une collecte d’un autre fournisseur', () => {
    const { db, state, as } = env
    as('usr_appro')
    expectService(() => svc.receipts.confirm(db, { supplierId: 'sup_6', lines: [{ polymer: 'PET', weighedKg: 10, acceptedKg: 10, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }), /n’est pas un fournisseur approuvé/)
    expectService(() => svc.receipts.confirm(db, { collectionId: 'col_3', supplierId: 'sup_1', lines: [{ polymer: 'HDPE', weighedKg: 10, acceptedKg: 10, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }), /autre fournisseur/)
    expectService(() => svc.collections.request(db, { supplierId: 'sup_6', polymers: [{ code: 'PET', estimatedKg: 10 }], pickupPoint: pickup, preferredSlots: [] }), /en attente de validation/)
    // les collectes seed pesées se réceptionnent normalement
    const r = svc.receipts.confirm(db, { collectionId: 'col_3', supplierId: 'sup_5', lines: [{ polymer: 'HDPE', weighedKg: 312, acceptedKg: 312, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] })
    expect(state.collections.find((c) => c.id === 'col_3')).toMatchObject({ status: 'received', receiptId: r.id })
    expect(state.tours.find((t) => t.id === 'trn_2')!.status).toBe('in_progress')
  })

  it('examen : refus motivé, annulation par le collecteur (et pas par un autre)', () => {
    const { db, state, as } = env
    as('usr_appro')
    expectService(() => svc.collections.review(db, 'col_9', { accept: false }), /motif/)
    const rejected = svc.collections.review(db, 'col_9', { accept: false, reason: 'Zone non desservie cette semaine.' })
    expect(rejected).toMatchObject({ status: 'rejected', problemReason: 'Zone non desservie cette semaine.' })
    expect(notificationsFor(db, (n) => n.userId === 'usr_coll1' && n.title === 'Demande de collecte refusée')).toHaveLength(1)
    expectService(() => svc.collections.review(db, 'col_9', { accept: true }), /déjà été traitée/)

    // col_6 planifiée (sup_1, tournée trn_3 avec col_7) : un autre collecteur ne peut pas l'annuler
    as('usr_coll2')
    expectDenied(() => svc.collections.cancel(db, 'col_6', 'test'))
    as('usr_coll1')
    expectService(() => svc.collections.cancel(db, 'col_6', ' '), /motif/)
    svc.collections.cancel(db, 'col_6', 'Quantité insuffisante')
    expect(state.collections.find((c) => c.id === 'col_6')).toMatchObject({ status: 'cancelled', cancelReason: 'Quantité insuffisante' })
    expect(state.tours.find((t) => t.id === 'trn_3')!.collectionIds).toEqual(['col_7'])
    expect(notificationsFor(db, (n) => n.userId === 'usr_driver2' && n.title === 'Collecte annulée')).toHaveLength(1)
    // en cours de route : le collecteur ne peut plus annuler
    as('usr_coll2')
    expectService(() => svc.collections.cancel(db, 'col_5', 'Plus de plastique'), /ne peut plus être annulée/) // col_5 est en route
  })

  it('problème signalé par le chauffeur puis replanification', () => {
    const { db, state, as } = env
    as('usr_driver1')
    svc.collections.driverUpdate(db, 'col_5', { status: 'problem', problemReason: 'Point de collecte fermé.' })
    expect(state.collections.find((c) => c.id === 'col_5')).toMatchObject({ status: 'problem', problemReason: 'Point de collecte fermé.' })
    expect(notificationsFor(db, (n) => n.userId === 'usr_coll2' && n.title === 'Problème sur votre collecte')).toHaveLength(1)
    as('usr_appro')
    const replanned = svc.collections.plan(db, 'col_5', { scheduledAt: '2026-11-05T09:00:00.000Z', driverUserId: 'usr_driver1' })
    expect(replanned).toMatchObject({ status: 'planned', problemReason: undefined })
    expect(state.tours.find((t) => t.id === 'trn_2')!.collectionIds).not.toContain('col_5')
  })
})

describe('Droits — collecte', () => {
  it('refus des rôles', () => {
    const { db, as } = env
    as('usr_coll1')
    expectDenied(() => svc.collections.plan(db, 'col_9', { scheduledAt: '2026-11-03T09:00:00.000Z', driverUserId: 'usr_driver1' }))
    expectDenied(() => svc.collections.review(db, 'col_9', { accept: true }))
    expectDenied(() => svc.collections.driverUpdate(db, 'col_5', { status: 'en_route' }))
    expectDenied(() => svc.receipts.confirm(db, { supplierId: 'sup_1', lines: [{ polymer: 'PET', weighedKg: 1, acceptedKg: 1, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }))
    // un collecteur ne déclare que pour son propre profil
    expectDenied(() => svc.collections.request(db, { supplierId: 'sup_3', polymers: [{ code: 'PET', estimatedKg: 10 }], pickupPoint: pickup, preferredSlots: [] }))
    as('usr_driver1')
    expectDenied(() => svc.collections.plan(db, 'col_9', { scheduledAt: '2026-11-03T09:00:00.000Z', driverUserId: 'usr_driver1' }))
    expectDenied(() => svc.receipts.confirm(db, { supplierId: 'sup_1', lines: [{ polymer: 'PET', weighedKg: 1, acceptedKg: 1, rejectedKg: 0, quarantineKg: 0, decision: 'accepted' }] }))
    expectDenied(() => svc.collections.request(db, { supplierId: 'sup_1', polymers: [{ code: 'PET', estimatedKg: 10 }], pickupPoint: pickup, preferredSlots: [] }))
    as('usr_client1')
    expectDenied(() => svc.collections.request(db, { supplierId: 'sup_1', polymers: [{ code: 'PET', estimatedKg: 10 }], pickupPoint: pickup, preferredSlots: [] }))
    as('usr_sales')
    expectDenied(() => svc.receipts.pay(db, 'rcp_3'))
  })
})
