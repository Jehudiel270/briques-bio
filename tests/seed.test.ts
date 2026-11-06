import { describe, expect, it } from 'vitest'
import { buildSeed, DEMO_ACCOUNTS, SEED_ANCHOR } from '../shared/seed'
import { COLLECTION_NAMES } from '../shared/utils/db-core'
import { ROLE_KEYS } from '../shared/utils/roles'

const seed = buildSeed()
const ids = (c: keyof typeof seed) => new Set((seed[c] as any[]).map((r) => r.id))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('seed — structure', () => {
  it('contient toutes les collections', () => {
    for (const c of COLLECTION_NAMES) expect(Array.isArray(seed[c]), c).toBe(true)
  })

  it('est déterministe', () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(seed))
  })

  it('a des identifiants uniques par collection', () => {
    for (const c of COLLECTION_NAMES) {
      const all = (seed[c] as any[]).map((r) => r.id)
      expect(new Set(all).size, `ids dupliqués dans ${c}`).toBe(all.length)
    }
  })

  it('a des références lisibles uniques', () => {
    for (const c of COLLECTION_NAMES) {
      const refs = (seed[c] as any[]).map((r) => r.ref).filter(Boolean)
      expect(new Set(refs).size, `refs dupliquées dans ${c}`).toBe(refs.length)
    }
  })

  it('respecte les volumes demandés', () => {
    expect(seed.products.length).toBeGreaterThanOrEqual(12)
    expect(seed.companies.filter((c) => c.kind === 'client').length + seed.users.filter((u) => u.role === 'client').length).toBeGreaterThanOrEqual(8)
    expect(seed.suppliers.length).toBeGreaterThanOrEqual(6)
    expect(seed.collections.length).toBeGreaterThanOrEqual(10)
    expect(seed.workOrders.length).toBeGreaterThanOrEqual(6)
    expect(seed.orders.length).toBeGreaterThanOrEqual(12)
    expect(seed.quotes.length).toBeGreaterThanOrEqual(8)
    expect(seed.qcInspections.length).toBeGreaterThanOrEqual(4)
  })
})

describe('seed — comptes de démonstration', () => {
  it('couvre tous les rôles connectables', () => {
    const roles = new Set(DEMO_ACCOUNTS.map((a) => a.role))
    for (const r of ROLE_KEYS.filter((r) => r !== 'visitor')) expect(roles.has(r), r).toBe(true)
  })
  it('référence des utilisateurs existants et actifs', () => {
    const users = new Map(seed.users.map((u) => [u.id, u]))
    for (const a of DEMO_ACCOUNTS) {
      const u = users.get(a.userId)
      expect(u, a.userId).toBeTruthy()
      expect(u!.role).toBe(a.role)
      expect(u!.active).toBe(true)
      expect(u!.email).toMatch(/@ecobloc\.demo$/)
    }
  })
})

describe('seed — intégrité référentielle', () => {
  const zoneIds = new Set(seed.settings[0]!.zones.map((z) => z.id))
  const fk = (c: keyof typeof seed, getter: (r: any) => (string | undefined)[], target: Set<string> | keyof typeof seed, label?: string) => {
    const t = typeof target === 'string' ? ids(target) : target
    for (const r of seed[c] as any[]) for (const v of getter(r)) if (v) expect(t.has(v), `${c}.${r.id} → ${label ?? String(target)}.${v}`).toBe(true)
  }
  it('catalogue', () => {
    fk('products', (p) => [p.categoryId], 'categories')
    fk('products', (p) => p.documentIds, 'documents')
    fk('products', (p) => p.deliveryZones, zoneIds, 'zones')
    fk('documents', (d) => [d.productId], 'products')
    fk('priceGrids', (g) => g.tiers.map((t: any) => t.productId), 'products')
    fk('qcTemplates', (t) => [t.productId], 'products')
  })
  it('utilisateurs et entreprises', () => {
    fk('users', (u) => [u.companyId], 'companies')
    fk('users', (u) => [u.supplierId], 'suppliers')
    fk('users', (u) => [u.carrierId], 'carriers')
    fk('companies', (c) => [c.priceGridId], 'priceGrids')
    fk('companies', (c) => c.contacts.map((x: any) => x.userId), 'users')
    fk('suppliers', (s) => [s.userId], 'users')
  })
  it('devis, commandes, paiements, factures', () => {
    fk('quotes', (q) => [q.requesterUserId, q.assignedTo], 'users')
    fk('quotes', (q) => [q.companyId], 'companies')
    fk('quotes', (q) => [q.orderId], 'orders')
    fk('quotes', (q) => q.lines.map((l: any) => l.productId), 'products')
    fk('orders', (o) => [o.userId], 'users')
    fk('orders', (o) => [o.companyId], 'companies')
    fk('orders', (o) => [o.quoteId], 'quotes')
    fk('orders', (o) => [o.deliveryId], 'deliveries')
    fk('orders', (o) => o.lines.map((l: any) => l.productId), 'products')
    fk('orders', (o) => o.lines.flatMap((l: any) => l.allocations.map((a: any) => a.lotId)), 'productionLots')
    fk('payments', (p) => [p.orderId], 'orders')
    fk('payments', (p) => [p.invoiceId], 'invoices')
    fk('invoices', (i) => [i.orderId], 'orders')
    fk('claims', (c) => [c.orderId], 'orders')
    fk('claims', (c) => [c.deliveryId], 'deliveries')
    fk('claims', (c) => [c.userId, c.assignedTo], 'users')
  })
  it('collecte, réception, stock', () => {
    fk('collections', (c) => [c.supplierId], 'suppliers')
    fk('collections', (c) => [c.tourId], 'tours')
    fk('collections', (c) => [c.driverUserId], 'users')
    fk('collections', (c) => [c.receiptId], 'receipts')
    fk('tours', (t) => t.collectionIds, 'collections')
    fk('tours', (t) => [t.driverUserId], 'users')
    fk('tours', (t) => [t.carrierId], 'carriers')
    fk('receipts', (r) => [r.supplierId], 'suppliers')
    fk('receipts', (r) => [r.collectionId], 'collections')
    fk('receipts', (r) => [r.receivedBy], 'users')
    fk('rawLots', (l) => [l.receiptId], 'receipts')
    fk('rawLots', (l) => [l.supplierId], 'suppliers')
    fk('rawLots', (l) => [l.locationId], 'stockLocations')
    fk('stockMovements', (m) => [m.userId], 'users')
    fk('stockMovements', (m) => [m.fromLocationId, m.toLocationId], 'stockLocations')
  })
  it('production, qualité', () => {
    fk('workOrders', (w) => [w.productId], 'products')
    fk('workOrders', (w) => w.reservations.map((r: any) => r.rawLotId), 'rawLots')
    fk('workOrders', (w) => w.operatorIds, 'operators')
    fk('workOrders', (w) => [w.lotId], 'productionLots')
    fk('productionEvents', (e) => [e.workOrderId], 'workOrders')
    fk('productionLots', (l) => [l.workOrderId], 'workOrders')
    fk('productionLots', (l) => [l.productId], 'products')
    fk('productionLots', (l) => l.rawInputs.map((r: any) => r.rawLotId), 'rawLots')
    fk('productionLots', (l) => l.inspectionIds, 'qcInspections')
    fk('qcInspections', (q) => [q.lotId], 'productionLots')
    fk('qcInspections', (q) => q.results.map((r: any) => r.templateId), 'qcTemplates')
    fk('qcInspections', (q) => [q.reportDocumentId], 'documents')
  })
  it('livraison, environnement, notifications', () => {
    fk('deliveries', (d) => [d.orderId], 'orders')
    fk('deliveries', (d) => [d.carrierId], 'carriers')
    fk('deliveries', (d) => d.lotIds, 'productionLots')
    fk('envIndicators', (i) => i.evidenceDocumentIds, 'documents')
    fk('favorites', (f) => [f.userId], 'users')
    fk('favorites', (f) => [f.productId], 'products')
    fk('notifications', (n) => [n.userId], 'users')
  })
})

describe('seed — invariants métier', () => {
  const rawLotsByReceipt = (id: string) => seed.rawLots.filter((l) => l.receiptId === id)

  it('lots de matière : kgInitial = disponible + réservé + consommé (hors rejeté)', () => {
    for (const l of seed.rawLots) {
      expect(l.kgAvailable, l.ref).toBeGreaterThanOrEqual(0)
      expect(l.kgReserved, l.ref).toBeGreaterThanOrEqual(0)
      expect(l.kgConsumed, l.ref).toBeGreaterThanOrEqual(0)
      if (l.status !== 'rejected') expect(l.kgAvailable + l.kgReserved + l.kgConsumed, l.ref).toBeCloseTo(l.kgInitial, 3)
    }
  })

  it('les réservations des ordres de fabrication actifs correspondent au réservé des lots', () => {
    const active = seed.workOrders.filter((w) => ['materials_reserved', 'in_progress', 'paused'].includes(w.status))
    for (const l of seed.rawLots) {
      const reserved = sum(active.flatMap((w) => w.reservations.filter((r) => r.rawLotId === l.id).map((r) => r.kg)))
      expect(reserved, `réservé ${l.ref}`).toBeCloseTo(l.kgReserved, 3)
    }
  })

  it('la consommation des ordres terminés est tracée dans le lot fini', () => {
    for (const w of seed.workOrders.filter((w) => w.status === 'completed')) {
      const lot = seed.productionLots.find((l) => l.workOrderId === w.id)
      expect(lot, w.ref).toBeTruthy()
      expect(w.lotId).toBe(lot!.id)
      expect(sum(lot!.rawInputs.map((r) => r.kg)), w.ref).toBeCloseTo(w.materialKgConsumed, 3)
      expect(lot!.producedQty).toBe(w.producedQty)
    }
    for (const l of seed.productionLots) {
      expect(l.availableQty + l.reservedQty + l.shippedQty, l.ref).toBeLessThanOrEqual(l.producedQty)
      expect(l.availableQty).toBeGreaterThanOrEqual(0)
    }
  })

  it('la consommation matière par lot est cohérente avec les lots finis', () => {
    for (const l of seed.rawLots) {
      const used = sum(seed.productionLots.flatMap((p) => p.rawInputs.filter((r) => r.rawLotId === l.id).map((r) => r.kg)))
      expect(used, `consommé ${l.ref}`).toBeLessThanOrEqual(l.kgConsumed + 0.001)
    }
  })

  it('réception : somme des lignes = pesée, accepté + rejeté + quarantaine = pesé', () => {
    for (const r of seed.receipts) {
      expect(sum(r.lines.map((x) => x.weighedKg)), r.ref).toBeCloseTo(r.weighedKg, 3)
      for (const line of r.lines) expect(line.acceptedKg + line.rejectedKg + line.quarantineKg, `${r.ref} ${line.polymer}`).toBeCloseTo(line.weighedKg, 3)
      const lotKg = sum(rawLotsByReceipt(r.id).map((l) => l.kgInitial))
      const acceptedOrQuarantine = sum(r.lines.map((x) => x.acceptedKg + x.quarantineKg))
      expect(lotKg, `lots de ${r.ref}`).toBeCloseTo(acceptedOrQuarantine, 3)
    }
  })

  it('la rémunération est toujours simulée', () => {
    for (const r of seed.receipts) if (r.payout) expect(['pending', 'paid_simulated']).toContain(r.payout.status)
  })

  it('les polymères refusés par les paramètres ne produisent pas de lots disponibles', () => {
    const refused = new Set(seed.settings[0]!.polymers.filter((p) => !p.accepted).map((p) => p.code))
    for (const l of seed.rawLots) if (refused.has(l.polymer)) expect(['rejected', 'quarantine'], l.ref).toContain(l.status)
  })

  it('lots finis libérés : inspection terminée et acceptée ; seuls les lots libérés sont alloués', () => {
    const insp = new Map(seed.qcInspections.map((q) => [q.id, q]))
    for (const l of seed.productionLots) {
      if (l.qcStatus === 'released') {
        const ok = l.inspectionIds.map((i) => insp.get(i)!).find((q) => q.status === 'completed' && q.decision === 'accepted')
        expect(ok, `libération ${l.ref}`).toBeTruthy()
        expect(l.releasedAt).toBeTruthy()
      } else {
        expect(l.reservedQty, `${l.ref} non libéré mais réservé`).toBe(0)
        expect(l.shippedQty, `${l.ref} non libéré mais expédié`).toBe(0)
      }
    }
    const lots = new Map(seed.productionLots.map((l) => [l.id, l]))
    const products = new Map(seed.products.map((p) => [p.id, p]))
    for (const o of seed.orders) {
      for (const line of o.lines) for (const a of line.allocations) {
        const lot = lots.get(a.lotId)!
        expect(lot.qcStatus, `${o.ref} alloue ${lot.ref}`).toBe('released')
        expect(lot.productId).toBe(line.productId)
        expect(products.get(line.productId)!.validation, `${o.ref} produit`).toBe('authorized')
      }
    }
  })

  it('stock fini : réservé et expédié = allocations des commandes', () => {
    for (const l of seed.productionLots) {
      const alloc = (o: any) => sum(o.lines.flatMap((x: any) => x.allocations.filter((a: any) => a.lotId === l.id).map((a: any) => a.qty)))
      const reserved = sum(seed.orders.filter((o) => ['in_preparation', 'ready_to_ship'].includes(o.status)).map(alloc))
      const shipped = sum(seed.orders.filter((o) => ['shipped', 'delivered', 'disputed'].includes(o.status)).map(alloc))
      expect(reserved, `réservé ${l.ref}`).toBe(l.reservedQty)
      expect(shipped, `expédié ${l.ref}`).toBe(l.shippedQty)
    }
  })

  it('totaux des commandes', () => {
    for (const o of seed.orders) {
      const sub = sum(o.lines.map((l) => l.qty * l.unitPrice))
      expect(o.subtotal, o.ref).toBe(sub)
      expect(o.total, o.ref).toBe(o.subtotal - o.discountTotal + o.deliveryFee)
      expect(o.amountPaid, o.ref).toBeGreaterThanOrEqual(0)
      expect(o.amountPaid, o.ref).toBeLessThanOrEqual(o.total)
      expect(o.depositAmount).toBeLessThanOrEqual(o.total)
    }
  })

  it('paiements : simulés, cohérents avec le montant payé', () => {
    for (const p of seed.payments) {
      expect(p.simulated).toBe(true)
      expect(p.ref).toMatch(/^SIM-/)
    }
    for (const o of seed.orders) {
      const net = sum(seed.payments.filter((p) => p.orderId === o.id && p.status === 'succeeded').map((p) => (p.kind === 'refund' ? -p.amount : p.amount)))
      expect(net, `paiements ${o.ref}`).toBe(o.amountPaid)
    }
    for (const i of seed.invoices) {
      expect(i.simulated).toBe(true)
      expect(i.ref).toMatch(/^FAC-SIM-/)
    }
  })

  it('commandes livrées : livraison livrée avec preuve ; expédiées : en transit', () => {
    for (const o of seed.orders.filter((o) => o.status === 'delivered')) {
      const d = seed.deliveries.find((x) => x.orderId === o.id)
      expect(d, o.ref).toBeTruthy()
      expect(d!.status).toBe('delivered')
      expect(d!.proof?.receivedBy, `preuve ${o.ref}`).toBeTruthy()
    }
    for (const o of seed.orders.filter((o) => o.status === 'shipped')) {
      expect(seed.deliveries.find((x) => x.orderId === o.id)?.status).toBe('in_transit')
    }
    for (const d of seed.deliveries.filter((d) => d.status === 'delivered')) expect(d.proof, d.ref).toBeTruthy()
  })

  it('commandes : produits commandables seulement', () => {
    const products = new Map(seed.products.map((p) => [p.id, p]))
    for (const o of seed.orders) for (const l of o.lines) {
      const p = products.get(l.productId)!
      expect(p.published, `${o.ref} ${p.ref}`).toBe(true)
      expect(p.validation, `${o.ref} ${p.ref}`).toBe('authorized')
    }
  })

  it('devis convertis pointent vers une commande qui pointe vers eux', () => {
    for (const q of seed.quotes.filter((q) => q.status === 'converted')) {
      const o = seed.orders.find((x) => x.id === q.orderId)
      expect(o, q.ref).toBeTruthy()
      expect(o!.quoteId).toBe(q.id)
    }
  })

  it('collectes : statuts cohérents avec réceptions et tournées', () => {
    for (const c of seed.collections) {
      if (c.status === 'received') {
        expect(c.receiptId, c.ref).toBeTruthy()
        expect(seed.receipts.find((r) => r.id === c.receiptId)?.collectionId).toBe(c.id)
      }
      if (['planned', 'en_route', 'collected', 'weighed'].includes(c.status)) expect(c.driverUserId, c.ref).toBeTruthy()
      expect(c.estimatedTotalKg, c.ref).toBe(sum(c.polymers.map((p) => p.estimatedKg)))
    }
  })

  it('qualité : seuils de démonstration marqués ; décisions cohérentes avec les lots', () => {
    for (const t of seed.qcTemplates) expect(t.demoValues).toBe(true)
    const lots = new Map(seed.productionLots.map((l) => [l.id, l]))
    const map = { accepted: 'released', rejected: 'rejected', quarantine: 'quarantine' } as const
    for (const q of seed.qcInspections.filter((q) => q.status === 'completed')) {
      expect(lots.get(q.lotId)!.qcStatus, q.ref).toBe(map[q.decision!])
    }
  })

  it('la publication d’un indicateur exige méthodologie et justificatif', () => {
    for (const i of seed.envIndicators.filter((i) => i.status === 'published')) {
      expect(i.methodology.length, i.key).toBeGreaterThan(40)
      expect(i.evidenceDocumentIds.length, i.key).toBeGreaterThan(0)
      expect(i.approvedBy).toBeTruthy()
    }
  })
})

describe('seed — crédibilité des allégations', () => {
  const FORBIDDEN = [
    /plus (résistant|solide|dur)s? que le béton/i,
    /ignifug/i,
    /sans danger/i,
    /certifié/i,
    /conforme (à|aux) (la |l['’]|les )?norme/i,
    /(économi[es]+|évit[eé]s?|réduction)[^.]{0,40}co2/i,
    /garanti[es]? à vie/i,
  ]
  const publicText = (): string[] => {
    const out: string[] = []
    const walk = (v: unknown) => {
      if (typeof v === 'string') out.push(v)
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    for (const c of ['products', 'categories', 'documents', 'faqs', 'caseStudies', 'contentBlocks', 'envIndicators', 'settings'] as const) walk(seed[c])
    return out
  }
  it('aucune formule interdite (hors formules de prudence)', () => {
    const offenders = publicText().filter((t) => FORBIDDEN.some((re) => re.test(t)))
    const real = offenders.filter((t) => !/\?\s*$/.test(t) && !/(non|pas|aucun[e]?|sans|jamais|ni|avant)[^.]{0,60}(certifi|conform|sans danger|co2)/i.test(t))
    expect(real, real.join('\n---\n')).toEqual([])
  })
  it('tous les produits portent une restriction d’usage non structurel', () => {
    for (const p of seed.products) expect(p.restrictions.join(' ').toLowerCase(), p.ref).toMatch(/structur|porteur/)
  })
  it('les produits non autorisés affichent un délai à confirmer', () => {
    for (const p of seed.products.filter((p) => p.validation !== 'authorized')) expect(p.leadTimeLabel.toLowerCase(), p.ref).toMatch(/confirmer|indicatif/)
  })
  it('les documents sont tous marqués non officiels', () => {
    for (const d of seed.documents) expect(d.demoNotice.length, d.ref).toBeGreaterThan(20)
  })
  it('les données sont ancrées dans le temps de démonstration', () => {
    expect(SEED_ANCHOR).toMatch(/^2026-/)
  })
})
