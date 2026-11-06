/**
 * Utilitaires internes partagés par les services (garde de rôle, propriété des lignes,
 * validations, notifications, mouvements de stock). Non exposés dans `services`.
 */
import type { AppSettings, Id, Notification, RoleKey, StockMovement } from '../types/domain'
import { PermissionError, uid, type Db, type DbActor } from '../utils/db-core'
import { serviceAllowed } from '../utils/permissions'
import { CLIENT_ROLES, roleLabel } from '../utils/roles'
import { fail, ServiceError } from './errors'

// ------------------------------------------------------------------ Acteur et droits
export const actorId = (db: Db): Id => db.actor()?.id ?? 'system'
export const actorName = (db: Db): string => db.actor()?.name ?? 'Système'

/**
 * Refuse tôt (avant toute lecture ou écriture) si le rôle courant n'a pas le droit d'exécuter le service.
 * Sans acteur identifié, le contrôle est laissé aux écritures (`via`) du noyau.
 */
export function guard(db: Db, via: string): DbActor | null {
  const a = db.actor()
  if (a && !serviceAllowed(via, a.role)) {
    throw new PermissionError(`Votre rôle (${roleLabel(a.role)}) ne permet pas d’effectuer cette action (${via}).`, via.split('.')[0]!, 'service')
  }
  return a
}

export const isClientActor = (a: DbActor | null): boolean => !!a && CLIENT_ROLES.includes(a.role)

/** La ligne appartient-elle à l'acteur (ou à son entreprise) ? Même règle que `rowVisible`. */
export function ownsRow(a: DbActor | null, row: { userId?: Id; requesterUserId?: Id; companyId?: Id }): boolean {
  if (!a) return false
  return (!!a.id && (row.userId === a.id || row.requesterUserId === a.id)) || (!!a.companyId && row.companyId === a.companyId)
}

/** Un client ne manipule que ses propres lignes (devis, commandes) ; le personnel interne n'est pas limité. */
export function assertOwnsOrStaff(a: DbActor | null, row: { userId?: Id; requesterUserId?: Id; companyId?: Id }, what: string, collection: string) {
  if (isClientActor(a) && !ownsRow(a, row)) {
    throw new PermissionError(`Ce ${what} appartient à un autre compte : vous ne pouvez pas le modifier.`, collection, 'service')
  }
}

/** Un membre « lecture seule » d'une entreprise ne commande ni ne paie. */
export function assertCanBuy(a: DbActor | null) {
  if (a && isClientActor(a) && a.companyRole === 'viewer') {
    throw new PermissionError('Votre rôle d’équipe (lecture seule) ne permet pas de commander, d’accepter un devis ou de payer.', 'orders', 'service')
  }
}

// ------------------------------------------------------------------ Validations
export function need<T>(row: T | undefined | null, label: string): T {
  if (!row) fail(`${label} introuvable : actualisez la page puis réessayez.`, 'not_found')
  return row
}

export function text(v: unknown, label: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) fail(`${label} est obligatoire.`, 'invalid')
  return s
}

export function qtyOf(v: unknown, label: string, opts: { integer?: boolean; allowZero?: boolean } = {}): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || (!opts.allowZero && n === 0)) fail(`${label} doit être un nombre ${opts.allowZero ? 'positif ou nul' : 'strictement positif'}.`, 'invalid')
  if (opts.integer && !Number.isInteger(n)) fail(`${label} doit être un nombre entier.`, 'invalid')
  return n
}

export function pctOf(v: unknown, label: string): number {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n) || n < 0 || n > 100) fail(`${label} doit être compris entre 0 et 100 %.`, 'invalid')
  return n
}

export function dateOf(v: unknown, label: string): Date {
  const d = typeof v === 'string' || typeof v === 'number' || v instanceof Date ? new Date(v) : new Date(NaN)
  if (Number.isNaN(+d)) fail(`${label} : date invalide (format attendu AAAA-MM-JJ ou ISO 8601).`, 'invalid')
  return d
}

/** Jour (AAAA-MM-JJ) d'une date ISO, en UTC */
export const dayOf = (iso: string) => iso.slice(0, 10)
export const periodOf = (iso: string) => iso.slice(0, 7)

export const round2 = (n: number) => Math.round(n * 100) / 100
export const nearly = (a: number, b: number, eps = 0.0005) => Math.abs(a - b) <= eps

export const settingsOf = (db: Db): AppSettings => need(db.raw('settings')[0], 'Les paramètres de la plateforme')

export function statusIn(current: string, allowed: readonly string[], message: string) {
  if (!allowed.includes(current)) fail(message, 'bad_status')
}

// ------------------------------------------------------------------ Notifications
type NotifBody = { title: string; body?: string; level?: Notification['level']; href?: string }

export function notifyRoles(db: Db, roles: RoleKey[], n: NotifBody) {
  return db.notify({ roles, title: n.title, body: n.body, level: n.level ?? 'info', href: n.href })
}

export function notifyUser(db: Db, userId: Id | undefined, n: NotifBody) {
  if (!userId) return undefined
  return db.notify({ userId, title: n.title, body: n.body, level: n.level ?? 'info', href: n.href })
}

/** Utilisateurs rattachés à un fournisseur / collecteur */
export function supplierUserIds(db: Db, supplierId: Id): Id[] {
  const ids = new Set<Id>()
  const supplier = db.peek('suppliers', supplierId)
  if (supplier?.userId) ids.add(supplier.userId)
  for (const u of db.raw('users')) if (u.supplierId === supplierId) ids.add(u.id)
  return [...ids]
}

export function notifySupplier(db: Db, supplierId: Id, n: NotifBody) {
  for (const id of supplierUserIds(db, supplierId)) notifyUser(db, id, n)
}

// ------------------------------------------------------------------ Mouvements de stock
export function addMovement(db: Db, via: string, m: Omit<StockMovement, 'id' | 'at' | 'userId'> & { userId?: Id }) {
  return db.create('stockMovements', { ...m, id: uid('mov'), at: db.now(), userId: m.userId ?? actorId(db) }, { via, silent: true })
}

export { ServiceError }
