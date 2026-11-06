/**
 * Persistance de la base EcoBloc : deux adaptateurs interchangeables.
 *  - local : localStorage (clé `ecobloc:db:v<SEED_VERSION>`), sauvegarde différée ;
 *  - neon  : API Nitro `/api/db/*` (Neon Postgres), écriture au fil de l'eau avec file d'attente.
 * Ce module n'importe rien de Nuxt : il tourne tel quel sous vitest.
 */
import { COLLECTION_NAMES, type DbState, type WriteOp, type WriteOpts } from '../../../shared/utils/db-core'
import type { CollectionName } from '../../../shared/types/domain'

export type DataMode = 'local' | 'neon'

export interface LoadResult {
  state: DbState
  seedVersion: number
  /** Vrai si la base vient d'être amorcée (rien n'était stocké ou la version a changé) */
  fresh: boolean
}

export interface PersistenceAdapter {
  readonly kind: DataMode
  /** Charge (ou amorce) la base */
  load(): Promise<LoadResult>
  /** Fournit l'objet d'état réactif à sauvegarder */
  attach(state: DbState): void
  /** Branché sur `hooks.onWrite` du noyau */
  onWrite(collection: CollectionName, op: WriteOp, row: any, opts?: WriteOpts): void
  /** Écritures pas encore persistées */
  pending(): number
  /** Persiste tout ce qui est en attente (résolu quand c'est fait, ou après un délai maximal) */
  flush(): Promise<void>
  /** Réamorce la base de démonstration et renvoie le nouvel état */
  reset(): Promise<DbState>
  dispose(): void
}

/** Sous-ensemble de `fetch` utilisé par les adaptateurs (remplaçable en test). */
export interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<any>
}
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponseLike>

/** Remplace le contenu de l'état ; les collections absentes de `next` sont vidées (ex. filtrage par rôle). */
export function replaceState(target: DbState, next: Partial<DbState>): void {
  for (const c of COLLECTION_NAMES) {
    const rows = next[c]
    ;(target as any)[c] = Array.isArray(rows) ? rows : []
  }
}

export interface HealthInfo {
  ok: boolean
  db: 'neon' | 'none'
  seeded?: boolean
  demoMode?: boolean
  time?: string
}

/** `GET /api/health` avec délai maximal ; null si injoignable. */
export async function fetchHealth(fetcher: FetchLike, baseUrl = '', timeoutMs = 4000): Promise<HealthInfo | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetcher(`${baseUrl}/api/health`, { signal: ctrl?.signal })
    if (!res.ok) return null
    const body = await res.json()
    return body && typeof body === 'object' ? (body as HealthInfo) : null
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Détermine le mode de données :
 *  - `local` : toujours le stockage du navigateur ;
 *  - `neon`  : Neon (le chargement bascule sur le local, avec message, si le serveur est injoignable) ;
 *  - `auto`  : Neon seulement si `/api/health` répond `db: 'neon'`, sinon local.
 */
export async function resolveDataMode(
  preference: string | undefined,
  fetcher: FetchLike,
  opts: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<{ mode: DataMode; health: HealthInfo | null }> {
  if (preference === 'local') return { mode: 'local', health: null }
  if (preference === 'neon') return { mode: 'neon', health: null }
  const health = await fetchHealth(fetcher, opts.baseUrl, opts.timeoutMs)
  return { mode: health?.ok && health.db === 'neon' ? 'neon' : 'local', health }
}

export { createLocalAdapter, localKey, LOCAL_DB_PREFIX } from './local'
export type { LocalAdapterOptions, StorageLike } from './local'
export { createNeonAdapter, NeonUnavailableError } from './neon'
export type { NeonAdapterOptions, NeonPendingJob, NeonRejection } from './neon'
