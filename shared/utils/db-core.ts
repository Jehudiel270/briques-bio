/**
 * Noyau de la base de données EcoBloc (sans dépendance Vue ni Nuxt).
 *
 * - Opère sur un objet d'état `{ collection: ligne[] }`. L'application lui passe un
 *   objet `reactive()` ; les tests et le serveur lui passent un objet ordinaire.
 * - Applique les permissions (collection, champs, propriété des lignes) et alimente
 *   le journal d'audit.
 * - Les adaptateurs de persistance (localStorage, Neon) se branchent via `hooks.onWrite`.
 */
import type { AuditEntry, CollectionName, CollectionMap, Id, Notification, RoleKey, Row } from '../types/domain'
import { ACCESS, allowedFields, canCreate, canRead, canRemove, canUpdate, filterRows, rowVisible, rowWritable, serviceAllowed } from './permissions'

export type DbState = { [C in CollectionName]: Row<C>[] }

export interface DbActor {
  id?: Id
  name: string
  role: RoleKey
  companyId?: Id
  supplierId?: Id
  companyRole?: 'owner' | 'buyer' | 'accountant' | 'viewer'
}

export interface WriteOpts {
  /** Nom du service métier (voir SERVICE_ROLES) : autorise les effets de bord inter-rôles */
  via?: string
  /** Résumé lisible pour le journal d'audit */
  summary?: string
  /** N'écrit pas dans le journal (réservé au bruit technique) */
  silent?: boolean
}

export class PermissionError extends Error {
  collection: string
  action: string
  constructor(message: string, collection: string, action: string) {
    super(message)
    this.name = 'PermissionError'
    this.collection = collection
    this.action = action
  }
}

export type WriteOp = 'create' | 'update' | 'remove'
export interface DbHooks {
  onWrite?: (collection: CollectionName, op: WriteOp, row: any, o?: WriteOpts) => void
}

export interface DbOptions {
  getActor: () => DbActor | null
  hooks?: DbHooks
  now?: () => string
  /** Désactive les contrôles (amorçage, migrations, tests d'intégration serveur de confiance) */
  enforce?: boolean
}

export const COLLECTION_NAMES = Object.keys(ACCESS) as CollectionName[]

export function emptyState(): DbState {
  return Object.fromEntries(COLLECTION_NAMES.map((c) => [c, []])) as unknown as DbState
}

export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9)
      : Math.random().toString(36).slice(2, 11)
  return `${prefix}_${rnd}`
}

const labelOf = (row: any): string => row?.ref ?? row?.name ?? row?.title ?? row?.subject ?? row?.id ?? ''

export function createDb(state: DbState, opts: DbOptions) {
  const enforce = opts.enforce !== false
  const now = opts.now ?? (() => new Date().toISOString())
  const actor = () => opts.getActor()
  const ctx = { all: <T = any>(c: CollectionName) => (state[c] as unknown as T[]) }

  function authorize(c: CollectionName, action: 'create' | 'update' | 'remove', o?: WriteOpts) {
    if (!enforce) return
    const a = actor()
    const role = a?.role
    if (o?.via) {
      if (!serviceAllowed(o.via, role)) {
        throw new PermissionError(`Le rôle « ${role ?? 'visiteur'} » ne peut pas exécuter l'action « ${o.via} ».`, c, action)
      }
      return
    }
    const ok = action === 'create' ? canCreate(role, c) : action === 'update' ? canUpdate(role, c) : canRemove(role, c)
    if (!ok) throw new PermissionError(`Action « ${action} » non autorisée sur « ${c} » pour ce rôle.`, c, action)
  }

  function audit(entry: Omit<AuditEntry, 'id' | 'at' | 'userName'> & Partial<Pick<AuditEntry, 'userName' | 'at'>>) {
    const a = actor()
    const row: AuditEntry = {
      id: uid('aud'),
      at: entry.at ?? now(),
      userId: entry.userId ?? a?.id,
      userName: entry.userName ?? a?.name ?? 'Système',
      role: entry.role ?? a?.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      summary: entry.summary,
      before: entry.before,
      after: entry.after,
    }
    state.auditLog.unshift(row)
    if (state.auditLog.length > 1500) state.auditLog.length = 1500
    opts.hooks?.onWrite?.('auditLog', 'create', row)
    return row
  }

  /** Lignes visibles par l'acteur courant */
  function all<C extends CollectionName>(c: C): Row<C>[] {
    if (!enforce) return state[c]
    const a = actor()
    if (!canRead(a?.role, c)) return []
    return filterRows(a, c, state[c], ctx) as Row<C>[]
  }

  /** Toutes les lignes, sans filtrage — réservé aux services et au serveur de confiance */
  function raw<C extends CollectionName>(c: C): Row<C>[] {
    return state[c]
  }

  function get<C extends CollectionName>(c: C, id: Id | undefined | null): Row<C> | undefined {
    if (!id) return undefined
    const row = (state[c] as any[]).find((r) => r.id === id)
    if (!row) return undefined
    if (enforce && !rowVisible(actor(), c, row, ctx)) return undefined
    return row
  }

  /** Lecture sans filtrage d'une ligne précise (pour les jointures d'affichage : nom d'un produit, etc.) */
  function peek<C extends CollectionName>(c: C, id: Id | undefined | null): Row<C> | undefined {
    if (!id) return undefined
    return (state[c] as any[]).find((r) => r.id === id)
  }

  function create<C extends CollectionName>(c: C, data: Partial<Row<C>> & Record<string, any>, o?: WriteOpts): Row<C> {
    authorize(c, 'create', o)
    const row: any = { ...data }
    if (!row.id) row.id = uid(c.slice(0, 3))
    const stamp = now()
    if ('createdAt' in row === false && hasTimestamp(c, 'createdAt')) row.createdAt = stamp
    if ('updatedAt' in row === false && hasTimestamp(c, 'updatedAt')) row.updatedAt = stamp
    ;(state[c] as any[]).unshift(row)
    opts.hooks?.onWrite?.(c, 'create', row, o)
    if (!o?.silent && c !== 'auditLog') {
      audit({ action: 'create', entity: c, entityId: row.id, summary: o?.summary ?? `Création · ${labelOf(row)}` })
    }
    return row
  }

  function update<C extends CollectionName>(c: C, id: Id, patch: Partial<Row<C>> & Record<string, any>, o?: WriteOpts): Row<C> {
    const row: any = (state[c] as any[]).find((r) => r.id === id)
    if (!row) throw new Error(`Introuvable : ${c}/${id}`)
    authorize(c, 'update', o)
    if (enforce && !o?.via) {
      const a = actor()
      if (!rowWritable(a, c, row, ctx)) throw new PermissionError('Vous ne pouvez modifier que vos propres données.', c, 'update')
      const fields = allowedFields(a?.role, c)
      if (fields) {
        const forbidden = Object.keys(patch).filter((k) => !fields.includes(k))
        if (forbidden.length) throw new PermissionError(`Champs non modifiables pour ce rôle : ${forbidden.join(', ')}.`, c, 'update')
      }
    }
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) {
      const next = (patch as any)[k]
      if (JSON.stringify(row[k]) !== JSON.stringify(next)) {
        before[k] = row[k]
        after[k] = next
      }
    }
    Object.assign(row, patch)
    if ('updatedAt' in row && !('updatedAt' in patch)) row.updatedAt = now()
    opts.hooks?.onWrite?.(c, 'update', row, o)
    if (!o?.silent && Object.keys(after).length) {
      const keys = Object.keys(after)
      const statusChanged = keys.includes('status')
      audit({
        action: statusChanged ? 'status' : 'update',
        entity: c,
        entityId: id,
        summary: o?.summary ?? (statusChanged ? `Statut · ${labelOf(row)} → ${String(after.status)}` : `Modification · ${labelOf(row)} (${keys.slice(0, 4).join(', ')})`),
        before: trimForAudit(before),
        after: trimForAudit(after),
      })
    }
    return row
  }

  function remove<C extends CollectionName>(c: C, id: Id, o?: WriteOpts): boolean {
    const arr = state[c] as any[]
    const i = arr.findIndex((r) => r.id === id)
    if (i < 0) return false
    authorize(c, 'remove', o)
    const [row] = arr.splice(i, 1)
    opts.hooks?.onWrite?.(c, 'remove', row, o)
    if (!o?.silent) audit({ action: 'delete', entity: c, entityId: id, summary: o?.summary ?? `Suppression · ${labelOf(row)}`, before: trimForAudit(row) })
    return true
  }

  /** Prochaine référence lisible, ex. nextRef('quotes', 'DV') → « DV-2026-0013 » */
  function nextRef(c: CollectionName, prefix: string): string {
    const year = new Date(now()).getFullYear()
    const re = new RegExp(`^${prefix}-(?:SIM-)?${year}-(\\d+)$`)
    let max = 0
    for (const r of state[c] as any[]) {
      const m = typeof r.ref === 'string' ? re.exec(r.ref) : null
      if (m) max = Math.max(max, Number(m[1]))
    }
    return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`
  }

  function notify(n: Omit<Notification, 'id' | 'at' | 'read'> & Partial<Pick<Notification, 'read'>>) {
    const row: Notification = { id: uid('not'), at: now(), read: false, ...n }
    state.notifications.unshift(row)
    if (state.notifications.length > 600) state.notifications.length = 600
    opts.hooks?.onWrite?.('notifications', 'create', row)
    return row
  }

  function history(action: string, note?: string) {
    const a = actor()
    return { id: uid('his'), at: now(), userId: a?.id, userName: a?.name ?? 'Système', action, note }
  }

  return { state, all, raw, get, peek, create, update, remove, nextRef, audit, notify, history, now, actor, enforce }
}

export type Db = ReturnType<typeof createDb>

const TIMESTAMPED: Partial<Record<CollectionName, ('createdAt' | 'updatedAt')[]>> = {
  users: ['createdAt'], companies: ['createdAt'], products: ['createdAt', 'updatedAt'], quotes: ['createdAt', 'updatedAt'],
  orders: ['createdAt', 'updatedAt'], payments: ['createdAt'], invoices: ['createdAt'], suppliers: ['createdAt'],
  collections: ['createdAt', 'updatedAt'], workOrders: ['createdAt'], documents: ['createdAt', 'updatedAt'],
  claims: ['createdAt', 'updatedAt'], prospects: ['createdAt'], favorites: ['createdAt'], contentBlocks: ['updatedAt'],
}
function hasTimestamp(c: CollectionName, key: 'createdAt' | 'updatedAt') {
  return !!TIMESTAMPED[c]?.includes(key)
}

function trimForAudit(v: unknown): unknown {
  try {
    const s = JSON.stringify(v)
    if (s && s.length > 1800) return { _tronqué: true, aperçu: s.slice(0, 600) }
  } catch { /* ignore */ }
  return v
}

