import { describe, expect, it } from 'vitest'
import { authorizeWrite, filterStateFor, HttpError } from '../server/utils/rbac'
import type { Actor } from '../server/utils/session'
import { buildSeed } from '../shared/seed'
import type { RawState } from '../server/utils/sql'

const seed = buildSeed() as unknown as RawState
const user = (id: string): Actor => {
  const u = seed.users!.find((x: any) => x.id === id)!
  return { id: u.id, name: u.name, role: u.role, companyId: u.companyId, supplierId: u.supplierId, companyRole: u.companyRole, user: u, mode: 'demo' }
}
const visitor: Actor = { name: 'Visiteur', role: 'visitor', mode: 'visitor' }
const all = (c: string) => (seed[c] ?? []) as any[]
const put = (actor: Actor, collection: string, row: any, via?: string) => {
  const existing = all(collection).find((r) => r.id === row.id) ?? null
  return authorizeWrite({ collection, id: row.id, op: 'put', body: row, actor, existing, via, all: all as any })
}
const status = (fn: () => unknown) => {
  try {
    fn()
    return 200
  } catch (e) {
    return e instanceof HttpError ? e.statusCode : -1
  }
}

describe('serveur — lecture filtrée', () => {
  it('un client ne reçoit que ses commandes, devis et paiements', () => {
    const s = filterStateFor(seed, user('usr_client1'))
    expect(s.orders!.length).toBeGreaterThan(0)
    expect(s.orders!.every((o: any) => o.userId === 'usr_client1')).toBe(true)
    expect(s.quotes!.every((q: any) => q.requesterUserId === 'usr_client1')).toBe(true)
    expect(s.workOrders).toEqual([])
    expect(s.auditLog).toEqual([])
    expect(s.prospects).toEqual([])
  })

  it('un collecteur ne voit que ses collectes et réceptions', () => {
    const me = user('usr_coll1')
    const s = filterStateFor(seed, me)
    expect(s.collections!.length).toBeGreaterThan(0)
    expect(s.collections!.every((c: any) => c.supplierId === me.supplierId)).toBe(true)
    expect(s.receipts!.every((r: any) => r.supplierId === me.supplierId)).toBe(true)
    expect(s.orders).toEqual([])
  })

  it('un visiteur ne lit que le contenu public publié', () => {
    const s = filterStateFor(seed, visitor)
    expect(s.products!.length).toBeGreaterThan(0)
    expect(s.products!.every((p: any) => p.published !== false)).toBe(true)
    expect(s.documents!.every((d: any) => d.status === 'published' && d.visibility === 'public')).toBe(true)
    for (const c of ['users', 'orders', 'quotes', 'payments', 'rawLots', 'workOrders', 'auditLog', 'prospects']) expect(s[c], c).toEqual([])
    expect(s.envIndicators!.every((i: any) => i.status === 'published')).toBe(true)
  })

  it('l’administrateur voit tout', () => {
    const s = filterStateFor(seed, user('usr_admin'))
    expect(s.orders).toHaveLength(seed.orders!.length)
    expect(s.workOrders).toHaveLength(seed.workOrders!.length)
  })
})

describe('serveur — écritures', () => {
  it('un client ne peut pas écrire dans le catalogue ni libérer un lot', () => {
    const p = { ...all('products')[0] }
    expect(status(() => put(user('usr_client1'), 'products', { ...p, name: 'X' }))).toBe(403)
    const lot = { ...all('productionLots')[2], qcStatus: 'released' }
    expect(status(() => put(user('usr_client1'), 'productionLots', lot))).toBe(403)
    expect(status(() => put(user('usr_prod'), 'productionLots', lot))).toBe(403) // la production ne libère jamais un lot
    expect(status(() => put(user('usr_prod'), 'productionLots', { id: 'lot_new', qcStatus: 'released' }))).toBe(403)
    expect(status(() => put(user('usr_prod'), 'productionLots', { id: 'lot_new', qcStatus: 'pending_qc' }))).toBe(200)
  })

  it('le technicien qualité peut modifier uniquement les champs de décision d’un lot', () => {
    const lot = all('productionLots').find((l) => l.qcStatus === 'in_qc')!
    expect(status(() => put(user('usr_qual'), 'productionLots', { ...lot, qcStatus: 'released', releasedBy: 'usr_qual' }))).toBe(200)
    expect(status(() => put(user('usr_qual'), 'productionLots', { ...lot, availableQty: 9999 }))).toBe(403)
  })

  it('un x-service hors du rôle est refusé, un service autorisé est accepté', () => {
    const order = all('orders')[0]
    expect(status(() => put(user('usr_driver1'), 'orders', { ...order, status: 'delivered' }, 'orders.pay'))).toBe(403)
    expect(status(() => put(user('usr_client1'), 'orders', { ...order, status: 'delivered' }, 'nimportequoi'))).toBe(403)
    expect(status(() => put(user('usr_pro1'), 'orders', { ...order }, 'orders.pay'))).toBe(200)
  })

  it('un service ne peut jamais écrire les utilisateurs ni les paramètres', () => {
    expect(status(() => put(user('usr_admin'), 'users', { ...all('users')[0], role: 'admin' }, 'orders.pay'))).toBe(403)
    expect(status(() => put(user('usr_admin'), 'settings', { ...all('settings')[0] }, 'orders.pay'))).toBe(403)
  })

  it('un utilisateur ne peut pas changer son propre rôle', () => {
    const me = all('users').find((u) => u.id === 'usr_client1')
    expect(status(() => put(user('usr_client1'), 'users', { ...me, role: 'admin' }))).toBe(403)
    expect(status(() => put(user('usr_client1'), 'users', { ...me, name: 'Nouveau nom' }))).toBe(200)
  })

  it('un visiteur peut déposer un prospect mais pas modifier une commande', () => {
    expect(status(() => put(visitor, 'prospects', { id: 'pro_new', name: 'X', source: 'site', status: 'new', createdAt: 'x' }))).toBe(200)
    expect(status(() => put(visitor, 'orders', { ...all('orders')[0] }))).toBe(403)
  })

  it('l’id du corps doit correspondre à l’adresse', () => {
    expect(status(() => authorizeWrite({ collection: 'faqs', id: 'a', op: 'put', body: { id: 'b' }, actor: user('usr_admin'), existing: null, all: all as any }))).toBe(422)
  })

  it('collection inconnue → 404', () => {
    expect(status(() => authorizeWrite({ collection: 'nope', id: 'a', op: 'put', body: { id: 'a' }, actor: user('usr_admin'), existing: null, all: all as any }))).toBe(404)
  })

  it('journal d’audit : ajout seul, identité de l’appelant imposée', () => {
    const a = user('usr_sales')
    const created = authorizeWrite({ collection: 'auditLog', id: 'aud_1', op: 'put', body: { id: 'aud_1', userName: 'Pirate', role: 'admin', summary: 's' }, actor: a, existing: null, all: all as any })
    expect(created.row.userName).toBe(a.name)
    expect(created.row.role).toBe('sales')
    expect(status(() => authorizeWrite({ collection: 'auditLog', id: 'aud_1', op: 'put', body: { id: 'aud_1' }, actor: user('usr_admin'), existing: { id: 'aud_1' }, all: all as any }))).toBe(403)
    expect(status(() => authorizeWrite({ collection: 'auditLog', id: 'aud_1', op: 'delete', actor: user('usr_admin'), existing: { id: 'aud_1' }, all: all as any }))).toBe(403)
  })

  it('notifications : seul l’état « lu » est modifiable', () => {
    const n = all('notifications')[0]
    const a = user(n.userId ?? 'usr_admin')
    expect(status(() => authorizeWrite({ collection: 'notifications', id: n.id, op: 'put', body: { ...n, read: true }, actor: a, existing: n, all: all as any }))).toBe(200)
    expect(status(() => authorizeWrite({ collection: 'notifications', id: n.id, op: 'put', body: { ...n, title: 'x' }, actor: a, existing: n, all: all as any }))).toBe(403)
  })
})
