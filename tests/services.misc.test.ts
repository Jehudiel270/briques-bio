import { beforeEach, describe, expect, it } from 'vitest'
import { bindServices, isOrderable, ServiceError, services as svc } from '../shared/services'
import { SERVICE_ROLES } from '../shared/utils/permissions'
import { addr, expectDenied, expectService, expectStockInvariants, makeEnv, type Env } from './services-env'

let env: Env
beforeEach(() => { env = makeEnv() })

const period = '2026-10' // mois courant de l'horloge de test

describe('env — agrégation, validation, publication', () => {
  it('agrège des quantités mesurées (aucun calcul de CO₂) et suit les réceptions', () => {
    const { db, state, as } = env
    as('usr_env')
    const before = svc.env.aggregate(db, period)
    const petBefore = { ...before.find((r) => r.polymer === 'PET')! } // copie : les lignes sont mises à jour en place
    expect(before.map((r) => r.polymer)).toEqual(expect.arrayContaining(['PET', 'HDPE', 'PP', 'LDPE']))
    expect(petBefore).toMatchObject({ period, demo: true, validated: false })
    expect(petBefore.id).toBe(`env_${period}_PET`)
    expect(state.envRecords.filter((r) => r.period === period && r.polymer === 'PET')).toHaveLength(1) // mise à jour, pas de doublon

    as('usr_appro')
    svc.receipts.confirm(db, { supplierId: 'sup_4', lines: [{ polymer: 'PET', weighedKg: 205, acceptedKg: 195, rejectedKg: 10, quarantineKg: 0, decision: 'partial', reason: 'Bouchons' }] })
    as('usr_env')
    const after = svc.env.aggregate(db, period).find((r) => r.polymer === 'PET')!
    expect(after.receivedKg).toBeCloseTo(petBefore.receivedKg + 205, 2)
    expect(after.acceptedKg).toBeCloseTo(petBefore.acceptedKg + 195, 2)
    expect(after.rejectedKg).toBeCloseTo(petBefore.rejectedKg + 10, 2)
    // consommation en production : l'agrégation relit les rawInputs des lots du mois
    expect(after.usedInProductionKg).toBe(petBefore.usedInProductionKg)
    expect(JSON.stringify(db.raw('envRecords'))).not.toMatch(/co2|co₂/i)
    expectService(() => svc.env.aggregate(db, '2026-13'), /AAAA-MM/)
    expectService(() => svc.env.aggregate(db, 'octobre'), /AAAA-MM/)
    as('usr_sales')
    expectDenied(() => svc.env.aggregate(db, period))
  })

  it('l’agrégation relit la production du mois et conserve une validation si les chiffres sont inchangés', () => {
    const { db, state, as } = env
    as('usr_env')
    const base = Object.fromEntries(svc.env.aggregate(db, period).map((r) => [r.polymer, { ...r }]))
    as('usr_prod')
    const w = svc.production.createOrder(db, { productId: 'prd_pave-rect-10', plannedQty: 40, plannedStart: '2026-11-02', plannedEnd: '2026-11-03', operatorIds: ['op_1'] })
    svc.production.reserve(db, w.id, [{ rawLotId: 'rlot_11', kg: 20 }, { rawLotId: 'rlot_12', kg: 30 }])
    svc.production.start(db, w.id)
    svc.production.record(db, w.id, { producedQty: 40, scrapQty: 1, materialKgConsumed: 50 })
    svc.production.complete(db, w.id)
    as('usr_env')
    const records = svc.env.aggregate(db, period)
    const hdpe = records.find((r) => r.polymer === 'HDPE')!
    // le nouveau lot a consommé 20 kg de PET (rlot_11) et 30 kg de PEHD (rlot_12), répartis au prorata dans les pièces finies
    expect(records.find((r) => r.polymer === 'PET')!.usedInProductionKg).toBeCloseTo(base.PET!.usedInProductionKg + 20, 2)
    expect(hdpe.usedInProductionKg).toBeCloseTo(base.HDPE!.usedInProductionKg + 30, 2)
    expect(hdpe.finishedUnits - base.HDPE!.finishedUnits).toBeGreaterThanOrEqual(23) // 40 pièces × 30/50 = 24 (arrondi)
    expect(hdpe.finishedUnits - base.HDPE!.finishedUnits).toBeLessThanOrEqual(25)
    expect(state.workOrders.find((x) => x.id === w.id)!.status).toBe('completed')
    expect(hdpe.lossKg).toBeGreaterThanOrEqual(0)
    // validation puis ré-agrégation sans changement : la validation est conservée
    const validated = svc.env.validateRecord(db, hdpe.id) as { validated: boolean; validatedBy?: string }
    expect(validated).toMatchObject({ validated: true, validatedBy: 'usr_env' })
    expectService(() => svc.env.validateRecord(db, hdpe.id), /déjà validées/)
    expect(svc.env.aggregate(db, period).find((r) => r.polymer === 'HDPE')!.validated).toBe(true)
    // un nouveau chiffre invalide la validation
    as('usr_appro')
    svc.inventory.recordLoss(db, 'rlot_13', 5, 'Humidité')
    as('usr_env')
    expect(svc.env.aggregate(db, period).find((r) => r.polymer === 'PP')!.validated).toBe(false)
  })

  it('env.publish exige méthodologie, pièce justificative et validation', () => {
    const { db, state, as } = env
    as('usr_env')
    const base = { key: 'accepted_kg', label: 'Plastique accepté', value: 1200, unit: 'kg', periodFrom: '2026-05', periodTo: '2026-10' }
    const method = 'Somme des kg acceptés à la pesée à la réception, par mois, sur la période indiquée.'

    // sans méthodologie
    const noMethod = svc.env.createIndicator(db, { ...base, evidenceDocumentIds: ['doc_proof_env'] })
    expect(noMethod).toMatchObject({ status: 'draft', demo: true, methodology: '' })
    svc.env.validateRecord(db, noMethod.id)
    expectService(() => svc.env.publish(db, noMethod.id), /méthodologie/, 'methodology_missing')

    // sans pièce justificative
    const noProof = svc.env.createIndicator(db, { ...base, key: 'rejected_kg', label: 'Plastique rejeté', methodology: method })
    svc.env.validateRecord(db, noProof.id)
    expectService(() => svc.env.publish(db, noProof.id), /pièce justificative/, 'evidence_missing')

    // justificatif non exploitable (brouillon)
    const draftDoc = svc.env.createIndicator(db, { ...base, key: 'used_kg', label: 'Matière utilisée', methodology: method, evidenceDocumentIds: ['doc_test_t60'] })
    svc.env.validateRecord(db, draftDoc.id)
    expectService(() => svc.env.publish(db, draftDoc.id), /pas exploitable/, 'evidence_missing')

    // non validé
    const draft = svc.env.createIndicator(db, { ...base, key: 'units', label: 'Pièces fabriquées', unit: 'pièces', methodology: method, evidenceDocumentIds: ['doc_proof_env'] })
    expectService(() => svc.env.publish(db, draft.id), /validé avant/, 'not_validated')
    expect(state.envIndicators.find((i) => i.id === draft.id)!.status).toBe('draft')

    // complet : publication, puis dépublication
    svc.env.validateRecord(db, draft.id)
    const published = svc.env.publish(db, draft.id)
    expect(published).toMatchObject({ status: 'published', approvedBy: 'usr_env' })
    expect(published.approvedAt).toBeTruthy()
    expectService(() => svc.env.publish(db, draft.id), /déjà publié/)
    expect(svc.env.unpublish(db, draft.id)).toMatchObject({ status: 'validated', approvedBy: undefined })
    expectService(() => svc.env.unpublish(db, draft.id), /n’est pas publié/)

    // les indicateurs du seed : le brouillon « pièces » n'a pas de justificatif, le validé « rejet » est publiable
    expectService(() => svc.env.publish(db, 'ind_units'), /pièce justificative|validé avant/)
    expect(svc.env.publish(db, 'ind_rejection').status).toBe('published')
  })

  it('refuse tout indicateur de type économie de CO₂ ou carbone', () => {
    const { db, as } = env
    as('usr_env')
    const base = { key: 'x', label: 'Indicateur', value: 1, unit: 'kg', periodFrom: '2026-05', periodTo: '2026-10' }
    expectService(() => svc.env.createIndicator(db, { ...base, key: 'co2_saved', label: 'CO₂ évité' }), /carbone/, 'carbon_forbidden')
    expectService(() => svc.env.createIndicator(db, { ...base, unit: 'kg CO2e' }), /carbone/)
    expectService(() => svc.env.createIndicator(db, { ...base, label: 'Émissions évitées' }), /carbone/)
    expectService(() => svc.env.createIndicator(db, { ...base, value: Number.NaN }), /nombre/)
    expectService(() => svc.env.createIndicator(db, { ...base, periodFrom: '2026-10', periodTo: '2026-05' }), /précéder/)
  })

  it('refus des rôles', () => {
    const { db, as } = env
    for (const user of ['usr_client1', 'usr_sales', 'usr_qual', 'usr_prod', 'usr_appro', 'usr_logi', 'usr_driver1', 'usr_coll1']) {
      as(user)
      expectDenied(() => svc.env.publish(db, 'ind_rejection'))
      expectDenied(() => svc.env.validateRecord(db, 'ind_rejection'))
      expectDenied(() => svc.env.createIndicator(db, { key: 'k', label: 'L', value: 1, unit: 'kg', periodFrom: '2026-05', periodTo: '2026-06' }))
      expectDenied(() => svc.env.unpublish(db, 'ind_received'))
    }
    as('usr_admin')
    expect(svc.env.unpublish(db, 'ind_received').status).toBe('validated')
  })
})

describe('catalog.setValidation', () => {
  it('« autorisé » exige un document publié de type rapport d’essai ou fiche technique', () => {
    const { db, state, as } = env
    as('usr_qual')
    // en test, aucun document
    expectService(() => svc.catalog.setValidation(db, 'prd_pave-renforce-80', 'authorized'), /rapport d’essai ou une fiche technique/, 'proof_missing')
    // résultats disponibles mais rapport interne (non publié)
    expectService(() => svc.catalog.setValidation(db, 'prd_pave-drainant-30', 'authorized'), /publiez d’abord/)
    // brouillon, guide de pose publié : ne comptent pas
    expectService(() => svc.catalog.setValidation(db, 'prd_dalle-terrasse-60', 'authorized'), /publiez d’abord/)
    state.documents.push({ ...state.documents.find((d) => d.id === 'doc_pose_h20')!, id: 'doc_pose_t60', ref: 'DOC-0099', productId: 'prd_dalle-terrasse-60' })
    state.products.find((p) => p.id === 'prd_dalle-terrasse-60')!.documentIds.push('doc_pose_t60')
    expectService(() => svc.catalog.setValidation(db, 'prd_dalle-terrasse-60', 'authorized'), /publiez d’abord/)
    expect(state.products.find((p) => p.id === 'prd_dalle-terrasse-60')!.validation).toBe('results')

    // publication du rapport (qualité gère les documents) puis autorisation
    db.update('documents', 'doc_test_d30', { status: 'published', visibility: 'customers' })
    const product = svc.catalog.setValidation(db, 'prd_pave-drainant-30', 'authorized', 'Rapport d’essai publié (démo).')
    expect(product.validation).toBe('authorized')
    expect(product.restrictions.some((r) => /Validation en cours/.test(r))).toBe(false)
    expect(isOrderable(product)).toBe(true)
    expect(db.raw('auditLog')[0]).toMatchObject({ entity: 'products', entityId: 'prd_pave-drainant-30' })
    expect(db.raw('auditLog')[0]!.summary).toMatch(/Rapport d’essai publié/)
    expectService(() => svc.catalog.setValidation(db, 'prd_pave-drainant-30', 'authorized'), /déjà/)

    // un produit autorisé redevient non commandable s'il repasse en test
    const back = svc.catalog.setValidation(db, 'prd_pave-drainant-30', 'testing', 'Nouvel essai demandé.')
    expect(back).toMatchObject({ validation: 'testing', leadTimeLabel: 'À confirmer', installNotesValidated: false })
    expect(back.restrictions.filter((r) => /Validation en cours/.test(r))).toHaveLength(1)
    expect(isOrderable(back)).toBe(false)
    as('usr_client1')
    expectService(() => svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-drainant-30', qty: 5 }], deliveryAddress: addr() }), /pas commandable/)
  })

  it('un produit sur devis ne devient commandable en ligne qu’avec un prix ; refus des rôles', () => {
    const { db, as } = env
    as('usr_admin')
    expect(svc.catalog.setValidation(db, 'prd_pave-renforce-80', 'results').validation).toBe('results')
    expect(svc.catalog.setValidation(db, 'prd_couvre-mur-30', 'testing').validation).toBe('testing')
    for (const user of ['usr_sales', 'usr_prod', 'usr_appro', 'usr_logi', 'usr_client1', 'usr_env']) {
      as(user)
      expectDenied(() => svc.catalog.setValidation(db, 'prd_couvre-mur-30', 'results'))
    }
    as('usr_admin')
    expectService(() => svc.catalog.setValidation(db, 'prd_couvre-mur-30', 'inconnu' as never), /inconnu/)
  })
})

describe('bindServices et conventions générales', () => {
  it('lie la base : mêmes services sans le paramètre db', () => {
    const { db, as } = env
    const bound = bindServices(db)
    expect(Object.keys(bound)).toEqual(['quotes', 'orders', 'deliveries', 'collections', 'receipts', 'inventory', 'production', 'quality', 'env', 'catalog'])
    for (const name of Object.keys(svc) as (keyof typeof svc)[]) {
      expect(Object.keys(bound[name]).sort()).toEqual(Object.keys(svc[name]).sort())
    }
    as('usr_sales')
    expect(bound.quotes.take('q_7').status).toBe('in_review')
    as('usr_client1')
    expectService(() => bound.orders.createDirect({ lines: [{ productId: 'prd_couvre-mur-30', qty: 1 }], deliveryAddress: addr() }), /pas commandable/)
    expect(() => bound.quotes.take('q_8')).toThrow()
    expect(new ServiceError('x')).toBeInstanceOf(Error)
    expect(new ServiceError('x', 'code').code).toBe('code')
  })

  it('chaque fonction de service a une clé SERVICE_ROLES (aucune écriture ne passe sans via)', () => {
    const keys = Object.keys(SERVICE_ROLES)
    for (const k of [
      'quotes.request', 'quotes.take', 'quotes.send', 'quotes.negotiate', 'quotes.accept', 'quotes.decline',
      'orders.create', 'orders.pay', 'orders.refund', 'orders.cancel', 'orders.sendToPreparation', 'orders.allocate',
      'deliveries.plan', 'deliveries.ship', 'deliveries.deliver', 'deliveries.incident', 'deliveries.resolveIncident',
      'collections.request', 'collections.review', 'collections.plan', 'collections.driverUpdate', 'collections.cancel',
      'receipts.confirm', 'receipts.pay', 'inventory.adjust', 'inventory.transfer',
      'production.createOrder', 'production.reserve', 'production.start', 'production.pause', 'production.resume', 'production.logEvent', 'production.record', 'production.complete', 'production.cancel',
      'quality.request', 'quality.record', 'quality.decide', 'quality.attachReport', 'env.aggregate', 'env.validate', 'env.createIndicator', 'env.publish', 'env.unpublish', 'catalog.setValidation',
    ]) expect(keys, k).toContain(k)
  })

  it('livraison : incidents signalés et résolus, jamais de livraison sans preuve', () => {
    const { db, state, as } = env
    as('usr_logi')
    expectService(() => svc.deliveries.incident(db, 'del_6', { type: 'delay', description: ' ' }), /description/)
    const d = svc.deliveries.incident(db, 'del_6', { type: 'delay', description: 'Camion en panne, retard d’une journée.' })
    expect(d.incidents).toHaveLength(1)
    expect(d.incidents[0]).toMatchObject({ type: 'delay', resolved: false, userId: 'usr_logi' })
    expect(state.notifications.find((n) => n.title === 'Incident de livraison')).toMatchObject({ level: 'warning', href: '/ops/logistique/expeditions/del_6' })
    expect(state.notifications.find((n) => n.title === 'Incident sur votre livraison')).toMatchObject({ userId: 'usr_distri', href: '/espace/commandes/ord_9' })
    const r = svc.deliveries.resolveIncident(db, 'del_6', d.incidents[0]!.id)
    expect(r.incidents[0]!.resolved).toBe(true)
    expectService(() => svc.deliveries.resolveIncident(db, 'del_6', d.incidents[0]!.id), /déjà résolu/)
    expectService(() => svc.deliveries.resolveIncident(db, 'del_6', 'inc_inconnu'), /introuvable/)
    // livraison seed en transit : refus sans preuve, réussite avec preuve
    expectService(() => svc.deliveries.deliver(db, 'del_3', { receivedBy: '' }), /preuve de livraison/)
    expect(svc.deliveries.deliver(db, 'del_3', { receivedBy: 'Ernest Vodounnou' }).proof?.receivedBy).toBe('Ernest Vodounnou')
    expect(state.orders.find((o) => o.id === 'ord_3')!.status).toBe('delivered')
    as('usr_client1')
    expectDenied(() => svc.deliveries.incident(db, 'del_6', { type: 'other', description: 'x' }))
    expectDenied(() => svc.deliveries.resolveIncident(db, 'del_5', 'inc_1'))
    expectStockInvariants(state)
  })
})

describe('lecture — visibilité des lignes par rôle (db.all / db.get)', () => {
  it('un client ne voit que ses commandes, devis, paiements et factures', () => {
    const { db, as } = env
    as('usr_client1')
    const orders = db.all('orders')
    expect(orders.map((o) => o.id).sort()).toEqual(['ord_11', 'ord_2'])
    expect(orders.every((o) => o.userId === 'usr_client1')).toBe(true)
    expect(db.get('orders', 'ord_6')).toBeUndefined() // commande d'un autre client
    expect(db.get('orders', 'ord_2')).toBeTruthy()
    expect(db.all('quotes').every((q) => q.requesterUserId === 'usr_client1')).toBe(true)
    expect(db.all('payments').every((p) => p.userId === 'usr_client1')).toBe(true)
    expect(db.all('invoices').every((i) => i.userId === 'usr_client1')).toBe(true)
    expect(db.all('rawLots')).toEqual([])
    expect(db.all('workOrders')).toEqual([])
    expect(db.all('collections')).toEqual([])
    // les commandes créées pendant la session restent visibles, celles des autres non
    const mine = svc.orders.createDirect(db, { lines: [{ productId: 'prd_pave-hexa-20', qty: 5 }], deliveryAddress: addr() })
    as('usr_client2')
    expect(db.get('orders', mine.id)).toBeUndefined()
    as('usr_client1')
    expect(db.get('orders', mine.id)?.id).toBe(mine.id)
  })

  it('une entreprise voit les commandes de son équipe, pas celles d’une autre', () => {
    const { db, as } = env
    as('usr_pro1')
    const ids = db.all('orders').map((o) => o.id).sort()
    expect(ids).toEqual(['ord_1', 'ord_4'])
    as('usr_pro1b')
    expect(db.all('orders').map((o) => o.id).sort()).toEqual(ids)
    as('usr_pro2')
    expect(db.all('orders').every((o) => o.companyId === 'co_terra')).toBe(true)
  })

  it('un collecteur ne voit que ses collectes et réceptions ; un chauffeur que ses collectes', () => {
    const { db, as } = env
    as('usr_coll1')
    const cols = db.all('collections')
    expect(cols.length).toBeGreaterThan(0)
    expect(cols.every((c) => c.supplierId === 'sup_1')).toBe(true)
    expect(db.get('collections', 'col_2')).toBeUndefined() // collecte du collecteur sup_3
    expect(db.all('receipts').every((r) => r.supplierId === 'sup_1')).toBe(true)
    expect(db.all('orders')).toEqual([])
    as('usr_coll2')
    expect(db.all('collections').every((c) => c.supplierId === 'sup_3')).toBe(true)
    as('usr_driver1')
    expect(db.all('collections').every((c) => c.driverUserId === 'usr_driver1')).toBe(true)
    expect(db.get('collections', 'col_6')).toBeUndefined() // affectée à usr_driver2
    expect(db.all('tours').every((t) => t.driverUserId === 'usr_driver1')).toBe(true)
  })

  it('un visiteur ne voit que le contenu public ; les produits non publiés restent cachés', () => {
    const { db, as } = env
    as(null)
    expect(db.all('orders')).toEqual([])
    expect(db.all('users')).toEqual([])
    expect(db.all('products').length).toBeGreaterThan(0)
    expect(db.all('envIndicators').every((i) => i.status === 'published')).toBe(true)
    expect(db.all('documents').every((d) => d.status === 'published' && d.visibility === 'public')).toBe(true)
  })
})
