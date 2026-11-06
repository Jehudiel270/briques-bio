/**
 * Stockage serveur : Neon (Postgres) si DATABASE_URL est défini, sinon mémoire du processus
 * (la démo reste utilisable ; `/api/health` signale `db: 'none'`).
 */
import type { H3Event } from 'h3'
import { buildSeed, SEED_VERSION } from '../../shared/seed'
import * as sql from './sql'
import type { RawState, SqlExec } from './sql'

export interface Store {
  kind: 'neon' | 'memory'
  ensure(): Promise<void>
  /** Vrai si aucune ligne n'est stockée (base vierge) */
  isEmpty(): Promise<boolean>
  loadAll(): Promise<RawState>
  loadCollection(collection: string): Promise<any[]>
  getRow(collection: string, id: string): Promise<any | undefined>
  upsert(collection: string, id: string, data: unknown): Promise<void>
  remove(collection: string, id: string): Promise<boolean>
  getMeta<T = unknown>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
  replaceAll(state: RawState): Promise<number>
}

/** Magasin adossé à un exécuteur SQL (Neon ou PGlite). */
export function sqlStore(exec: SqlExec, kind: Store['kind'] = 'neon'): Store {
  let ensured: Promise<void> | null = null
  return {
    kind,
    ensure: () => (ensured ??= sql.ensureSchema(exec).catch((e) => ((ensured = null), Promise.reject(e)))),
    isEmpty: async () => (await sql.countRecords(exec)) === 0,
    loadAll: () => sql.loadAll(exec),
    loadCollection: (c) => sql.loadCollection(exec, c),
    getRow: (c, id) => sql.getRow(exec, c, id),
    upsert: (c, id, d) => sql.upsertRow(exec, c, id, d),
    remove: (c, id) => sql.removeRow(exec, c, id),
    getMeta: (k) => sql.getMeta(exec, k) as any,
    setMeta: (k, v) => sql.setMeta(exec, k, v),
    replaceAll: (s) => sql.replaceAll(exec, s),
  }
}

/** Magasin en mémoire (repli sans base de données, et tests). */
export function memoryStore(): Store {
  const rows = new Map<string, Map<string, any>>()
  const meta = new Map<string, unknown>()
  const col = (c: string) => rows.get(c) ?? rows.set(c, new Map()).get(c)!
  return {
    kind: 'memory',
    ensure: async () => {},
    isEmpty: async () => [...rows.values()].every((m) => m.size === 0),
    loadAll: async () => Object.fromEntries([...rows].map(([c, m]) => [c, [...m.values()]])),
    loadCollection: async (c) => [...col(c).values()],
    getRow: async (c, id) => col(c).get(id),
    upsert: async (c, id, d) => void col(c).set(id, JSON.parse(JSON.stringify(d))),
    remove: async (c, id) => col(c).delete(id),
    getMeta: async (k) => meta.get(k) as any,
    setMeta: async (k, v) => void meta.set(k, v),
    replaceAll: async (s) => {
      rows.clear()
      let n = 0
      for (const [c, list] of Object.entries(s)) for (const r of list) if (r?.id != null) (col(c).set(String(r.id), JSON.parse(JSON.stringify(r))), n++)
      return n
    },
  }
}

let memory: Store | null = null
let neonCache: { url: string; store: Store } | null = null

/** Choisit le magasin selon l'environnement. `@neondatabase/serverless` n'est chargé que si nécessaire. */
export async function useStore(event?: H3Event): Promise<Store> {
  const url = String((useRuntimeConfig(event) as any).databaseUrl || '')
  if (!url) return (memory ??= memoryStore())
  if (!neonCache || neonCache.url !== url) {
    const { neon } = await import('@neondatabase/serverless')
    const client = neon(url)
    const exec: SqlExec = async (text, params = []) => (await client.query(text, params as any[])) as any[]
    neonCache = { url, store: sqlStore(exec, 'neon') }
  }
  return neonCache.store
}

/** Amorce la base avec le jeu de démonstration si elle est vide ou d'une autre version. */
export async function ensureSeeded(store: Store, opts: { force?: boolean } = {}): Promise<{ seeded: boolean; rows: number }> {
  await store.ensure()
  const version = await store.getMeta<number>('seedVersion')
  if (!opts.force && !(await store.isEmpty()) && version === SEED_VERSION) return { seeded: false, rows: 0 }
  const rows = await store.replaceAll(buildSeed() as unknown as RawState)
  await store.setMeta('seedVersion', SEED_VERSION)
  return { seeded: true, rows }
}
