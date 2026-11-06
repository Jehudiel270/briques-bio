/**
 * Environnement commun des tests de services : base amorcée par `buildSeed()`, contrôles de droits actifs,
 * acteur modifiable et horloge déterministe. (Fichier utilitaire : pas de `.test.` dans le nom.)
 */
import { expect } from 'vitest'
import { buildSeed, SEED_ANCHOR } from '../shared/seed'
import { createDb, PermissionError, type Db, type DbActor, type DbState } from '../shared/utils/db-core'
import { ServiceError } from '../shared/services'

export function makeEnv() {
  const state = buildSeed()
  let current: DbActor | null = null
  let tick = 0
  // 2 jours après l'ancre de la démo (28 octobre 2026), une seconde par appel d'horloge
  const t0 = Date.parse(SEED_ANCHOR) + 2 * 86400000
  const db = createDb(state, { getActor: () => current, enforce: true, now: () => new Date(t0 + tick++ * 1000).toISOString() })

  /** Change l'acteur courant (null = visiteur non connecté) */
  const as = (userId: string | null, overrides: Partial<DbActor> = {}) => {
    if (!userId) {
      current = null
      return null
    }
    const u = state.users.find((x) => x.id === userId)
    if (!u) throw new Error(`utilisateur de démo inconnu : ${userId}`)
    current = { id: u.id, name: u.name, role: u.role, companyId: u.companyId, supplierId: u.supplierId, companyRole: u.companyRole, ...overrides }
    return current
  }
  return { db, state, as }
}

export type Env = ReturnType<typeof makeEnv>

export const addr = (zone = 'z_cotonou', city = 'Cotonou') => ({ line: 'Chantier de démonstration', city, zone, country: 'Bénin' })

export function expectService(fn: () => unknown, message?: RegExp, code?: string) {
  let err: unknown
  try { fn() } catch (e) { err = e }
  expect(err, 'une ServiceError était attendue').toBeInstanceOf(ServiceError)
  if (message) expect((err as Error).message).toMatch(message)
  if (code) expect((err as ServiceError).code).toBe(code)
}

export function expectDenied(fn: () => unknown) {
  expect(fn).toThrow(PermissionError)
}

/** Invariants de stock qui doivent rester vrais après n'importe quel enchaînement de services. */
export function expectStockInvariants(state: DbState) {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  for (const l of state.rawLots) {
    expect(l.kgAvailable, `${l.ref} disponible`).toBeGreaterThanOrEqual(0)
    expect(l.kgReserved, `${l.ref} réservé`).toBeGreaterThanOrEqual(0)
    expect(l.kgConsumed, `${l.ref} consommé`).toBeGreaterThanOrEqual(0)
    if (l.status !== 'rejected') expect(l.kgAvailable + l.kgReserved + l.kgConsumed, `${l.ref} initial`).toBeCloseTo(l.kgInitial, 2)
  }
  const active = state.workOrders.filter((w) => ['materials_reserved', 'in_progress', 'paused'].includes(w.status))
  for (const l of state.rawLots) {
    expect(sum(active.flatMap((w) => w.reservations.filter((r) => r.rawLotId === l.id).map((r) => r.kg))), `réservations ${l.ref}`).toBeCloseTo(l.kgReserved, 2)
  }
  for (const l of state.productionLots) {
    expect(l.availableQty, `${l.ref} disponible`).toBeGreaterThanOrEqual(0)
    expect(l.reservedQty, `${l.ref} réservé`).toBeGreaterThanOrEqual(0)
    expect(l.shippedQty, `${l.ref} expédié`).toBeGreaterThanOrEqual(0)
    expect(l.availableQty + l.reservedQty + l.shippedQty, `${l.ref} total`).toBeLessThanOrEqual(l.producedQty)
    if (l.qcStatus !== 'released') {
      expect(l.reservedQty, `${l.ref} non libéré mais réservé`).toBe(0)
      expect(l.shippedQty, `${l.ref} non libéré mais expédié`).toBe(0)
    }
    const alloc = (statuses: string[]) => sum(state.orders.filter((o) => statuses.includes(o.status)).flatMap((o) => o.lines.flatMap((x) => x.allocations.filter((a) => a.lotId === l.id).map((a) => a.qty))))
    expect(alloc(['confirmed', 'in_preparation', 'ready_to_ship']), `réservé ${l.ref} = allocations`).toBe(l.reservedQty)
    expect(alloc(['shipped', 'delivered', 'disputed']), `expédié ${l.ref} = allocations`).toBe(l.shippedQty)
  }
  for (const p of state.payments) {
    expect(p.simulated).toBe(true)
    expect(p.ref).toMatch(/^SIM-/)
  }
  for (const i of state.invoices) {
    expect(i.simulated).toBe(true)
    expect(i.ref).toMatch(/^FAC-SIM-/)
  }
}

export const notificationsFor = (db: Db, pred: (n: DbState['notifications'][number]) => boolean) => db.raw('notifications').filter(pred)
