/**
 * Adaptateur localStorage : toute la base de démonstration vit dans une seule clé
 * `ecobloc:db:v<SEED_VERSION>`. Sauvegarde différée (debounce) déclenchée par `onWrite`,
 * réamorçage automatique si la version du jeu de données change ou si le contenu est illisible.
 */
import type { CollectionName } from '../../../shared/types/domain'
import { buildSeed as defaultBuildSeed, SEED_VERSION } from '../../../shared/seed'
import { COLLECTION_NAMES, emptyState, type DbState, type WriteOp, type WriteOpts } from '../../../shared/utils/db-core'
import type { LoadResult, PersistenceAdapter } from './index'

export const LOCAL_DB_PREFIX = 'ecobloc:db:v'
export const localKey = (version: number = SEED_VERSION) => `${LOCAL_DB_PREFIX}${version}`

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key?(index: number): string | null
  readonly length?: number
}

export interface LocalAdapterOptions {
  /** `null` : pas de stockage (la base reste en mémoire). Par défaut : window.localStorage si disponible. */
  storage?: StorageLike | null
  seedVersion?: number
  buildSeed?: () => DbState
  /** Délai de sauvegarde après la dernière écriture (ms) */
  debounceMs?: number
  /** Délai maximal avant une sauvegarde forcée si les écritures s'enchaînent (ms) */
  maxWaitMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  now?: () => number
  onError?: (error: unknown) => void
  onPendingChange?: (pending: number) => void
}

function defaultStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null
  } catch {
    return null
  }
}

export function createLocalAdapter(options: LocalAdapterOptions = {}): PersistenceAdapter {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const seedVersion = options.seedVersion ?? SEED_VERSION
  const seedFn = options.buildSeed ?? defaultBuildSeed
  const debounceMs = options.debounceMs ?? 400
  const maxWaitMs = options.maxWaitMs ?? 3000
  const setT = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearT = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const now = options.now ?? (() => Date.now())
  const key = localKey(seedVersion)

  let state: DbState | null = null
  let timer: unknown = null
  let dirty = false
  let dirtySince = 0

  const setPending = () => options.onPendingChange?.(dirty ? 1 : 0)

  const serialize = (s: Partial<DbState>) => JSON.stringify({ v: seedVersion, savedAt: new Date(now()).toISOString(), state: s })

  /** Supprime les bases d'anciennes versions du jeu de données */
  function purgeOtherVersions() {
    if (!storage || typeof storage.key !== 'function' || typeof storage.length !== 'number') return
    const stale: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(LOCAL_DB_PREFIX) && k !== key) stale.push(k)
    }
    for (const k of stale) {
      try {
        storage.removeItem(k)
      } catch { /* ignoré */ }
    }
  }

  function read(): DbState | null {
    if (!storage) return null
    let raw: string | null
    try {
      raw = storage.getItem(key)
    } catch {
      return null
    }
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.v !== seedVersion || typeof parsed.state !== 'object' || !parsed.state) return null
      const merged = emptyState()
      for (const c of COLLECTION_NAMES) {
        const rows = parsed.state[c]
        if (Array.isArray(rows)) (merged as any)[c] = rows
      }
      // base vide ou tronquée : on réamorce plutôt que d'afficher une application sans données
      if (!merged.users.length || !merged.settings.length) return null
      return merged
    } catch {
      return null
    }
  }

  /** Version allégée pour retenter après un dépassement de quota */
  function trimmed(s: DbState): Partial<DbState> {
    return { ...s, auditLog: s.auditLog.slice(0, 200), notifications: s.notifications.slice(0, 100) }
  }

  function save(): boolean {
    if (timer != null) {
      clearT(timer)
      timer = null
    }
    dirty = false
    dirtySince = 0
    setPending()
    if (!storage || !state) return false
    try {
      storage.setItem(key, serialize(state))
      return true
    } catch (e) {
      try {
        storage.setItem(key, serialize(trimmed(state)))
        options.onError?.(e)
        return true
      } catch (e2) {
        options.onError?.(e2)
        return false
      }
    }
  }

  const adapter: PersistenceAdapter = {
    kind: 'local',

    async load(): Promise<LoadResult> {
      purgeOtherVersions()
      const existing = read()
      if (existing) return { state: existing, seedVersion, fresh: false }
      const fresh = seedFn()
      try {
        storage?.setItem(key, serialize(fresh))
      } catch (e) {
        options.onError?.(e)
      }
      return { state: fresh, seedVersion, fresh: true }
    },

    attach(s) {
      state = s
    },

    onWrite(_collection: CollectionName, _op: WriteOp, _row: any, _opts?: WriteOpts) {
      const t = now()
      if (!dirty) {
        dirty = true
        dirtySince = t
        setPending()
      }
      if (timer != null) clearT(timer)
      if (t - dirtySince >= maxWaitMs) {
        save()
        return
      }
      timer = setT(() => {
        timer = null
        if (dirty) save()
      }, debounceMs)
    },

    pending: () => (dirty ? 1 : 0),

    async flush() {
      if (dirty) save()
    },

    async reset() {
      const fresh = seedFn()
      if (timer != null) {
        clearT(timer)
        timer = null
      }
      dirty = false
      setPending()
      try {
        storage?.setItem(key, serialize(fresh))
      } catch (e) {
        options.onError?.(e)
      }
      return fresh
    },

    dispose() {
      if (dirty) save()
      else if (timer != null) {
        clearT(timer)
        timer = null
      }
    },
  }
  return adapter
}
