/**
 * Adaptateur Neon : lecture initiale via `GET /api/db/bootstrap`, puis écriture au fil de l'eau
 * (`PUT/DELETE /api/db/:collection/:id`) à travers une file d'attente ordonnée.
 *
 *  - une écriture en attente sur la même ligne est remplacée par la plus récente (coalescence) ;
 *  - erreurs réseau / 5xx : nouvelles tentatives espacées, puis bascule (`onFallback`) ;
 *  - erreurs 4xx : l'écriture est abandonnée (jamais rejouée) et signalée (`onRejected`), sauf pour les
 *    collections « au mieux » (journal d'audit, notifications) dont les refus sont ignorés silencieusement ;
 *  - collections « au mieux » : au plus 2 tentatives, et un serveur injoignable n'y déclenche jamais la
 *    bascule locale ni de message (la prochaine écriture réelle s'en chargera) ; quand le serveur refuse
 *    le journal d'audit client, les écritures de journal déjà en file sont retirées ;
 *  - en-têtes d'identité fournis par `getHeaders` (Authorization ou x-demo-user), `x-service` si `opts.via`.
 */
import type { CollectionName } from '../../../shared/types/domain'
import { emptyState, type DbState, type WriteOp, type WriteOpts } from '../../../shared/utils/db-core'
import type { FetchLike, LoadResult, PersistenceAdapter } from './index'

export class NeonUnavailableError extends Error {
  constructor(message = 'Le serveur de données est injoignable.') {
    super(message)
    this.name = 'NeonUnavailableError'
  }
}

export interface NeonRejection {
  collection: CollectionName
  id: string
  op: 'put' | 'delete'
  status: number
  message: string
}

export interface NeonPendingJob {
  collection: CollectionName
  id: string
  op: 'put' | 'delete'
  row?: any
}

export interface NeonAdapterOptions {
  fetch: FetchLike
  baseUrl?: string
  getHeaders: () => Promise<Record<string, string>> | Record<string, string>
  /** Tentatives par écriture avant bascule (défaut 4) */
  maxAttempts?: number
  /** Délai de base entre deux tentatives, doublé à chaque essai (défaut 700 ms) */
  retryDelayMs?: number
  /** Délai maximal du chargement initial (défaut 30 s : la première lecture peut amorcer la base) */
  loadTimeoutMs?: number
  /** Délai maximal d'attente de `flush()` (défaut 8 s) */
  flushTimeoutMs?: number
  /** Collections dont un refus (4xx) n'est pas signalé */
  softCollections?: CollectionName[]
  setTimer?: (fn: () => void, ms: number) => unknown
  onRejected?: (info: NeonRejection) => void
  /** Appelé une fois quand le serveur reste injoignable : l'appelant bascule sur le stockage local */
  onFallback?: (reason: string) => void
  onPendingChange?: (pending: number) => void
}

interface Job {
  key: string
  collection: CollectionName
  id: string
  op: 'put' | 'delete'
  body?: string
  via?: string
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])

export function createNeonAdapter(options: NeonAdapterOptions): PersistenceAdapter & { pendingJobs(): NeonPendingJob[]; readonly stopped: boolean } {
  const base = options.baseUrl ?? ''
  const maxAttempts = options.maxAttempts ?? 4
  const retryDelay = options.retryDelayMs ?? 700
  const soft = new Set<CollectionName>(options.softCollections ?? ['auditLog', 'notifications'])
  const setT = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))

  const queue: Job[] = []
  let running = false
  let stopped = false
  let auditRefused = false
  let idleWaiters: (() => void)[] = []

  const notify = () => options.onPendingChange?.(queue.length)
  const sleep = (ms: number) => new Promise<void>((resolve) => (ms <= 0 ? resolve() : void setT(resolve, ms)))
  const rowUrl = (c: string, id: string) => `${base}/api/db/${encodeURIComponent(c)}/${encodeURIComponent(id)}`

  async function timed<T>(ms: number, fn: (signal: AbortSignal | undefined) => Promise<T>): Promise<T> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
    try {
      return await fn(ctrl?.signal)
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async function messageOf(res: { json(): Promise<any> }): Promise<string> {
    try {
      const body = await res.json()
      return String(body?.statusMessage ?? body?.message ?? '') || 'Écriture refusée par le serveur.'
    } catch {
      return 'Écriture refusée par le serveur.'
    }
  }

  /** 'ok' | 'dropped' (refus définitif) | 'unreachable' (réseau/serveur indisponible après nouvelles tentatives) */
  async function send(job: Job): Promise<'ok' | 'dropped' | 'unreachable'> {
    let refreshedAuth = false
    const attempts = soft.has(job.collection) ? Math.min(maxAttempts, 2) : maxAttempts
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const headers: Record<string, string> = { 'content-type': 'application/json', ...(await options.getHeaders()) }
        if (job.via) headers['x-service'] = job.via
        const res = await options.fetch(rowUrl(job.collection, job.id), {
          method: job.op === 'put' ? 'PUT' : 'DELETE',
          headers,
          body: job.op === 'put' ? job.body : undefined,
        })
        if (res.ok || (job.op === 'delete' && res.status === 404)) return 'ok'
        if (res.status === 401 && !refreshedAuth) {
          // jeton expiré : on réessaie une fois avec des en-têtes recalculés
          refreshedAuth = true
          attempt--
          continue
        }
        if (!RETRYABLE.has(res.status)) {
          if (job.collection === 'auditLog' && (res.status === 403 || res.status === 404)) {
            auditRefused = true
            // l'écriture en cours est en tête de file : on retire les autres écritures de journal déjà en attente
            for (let i = queue.length - 1; i >= 1; i--) if (queue[i]!.collection === 'auditLog') queue.splice(i, 1)
          }
          if (!soft.has(job.collection)) {
            options.onRejected?.({ collection: job.collection, id: job.id, op: job.op, status: res.status, message: await messageOf(res) })
          }
          return 'dropped'
        }
      } catch {
        /* erreur réseau : nouvelle tentative */
      }
      if (attempt < attempts - 1) await sleep(retryDelay * 2 ** attempt)
    }
    return 'unreachable'
  }

  function settle() {
    const waiters = idleWaiters
    idleWaiters = []
    for (const w of waiters) w()
  }

  async function pump() {
    if (running || stopped) return
    running = true
    try {
      while (queue.length && !stopped) {
        const outcome = await send(queue[0]!)
        if (outcome === 'unreachable' && !soft.has(queue[0]!.collection)) {
          stopped = true
          options.onFallback?.('Le serveur de données ne répond plus.')
          break
        }
        queue.shift()
        notify()
      }
    } finally {
      running = false
      if (!queue.length || stopped) settle()
    }
  }

  const adapter: PersistenceAdapter & { pendingJobs(): NeonPendingJob[]; readonly stopped: boolean } = {
    kind: 'neon',

    get stopped() {
      return stopped
    },

    async load(): Promise<LoadResult> {
      let res
      try {
        const headers = await options.getHeaders()
        res = await timed(options.loadTimeoutMs ?? 30000, (signal) => options.fetch(`${base}/api/db/bootstrap`, { headers, signal }))
      } catch {
        throw new NeonUnavailableError()
      }
      if (!res.ok) throw new NeonUnavailableError(`Le serveur de données a répondu avec l'erreur ${res.status}.`)
      let body: any
      try {
        body = await res.json()
      } catch {
        throw new NeonUnavailableError('Réponse illisible du serveur de données.')
      }
      const state = emptyState()
      const incoming = body?.state && typeof body.state === 'object' ? body.state : {}
      for (const c of Object.keys(state) as CollectionName[]) {
        if (Array.isArray(incoming[c])) (state as any)[c] = incoming[c]
      }
      return { state, seedVersion: Number(body?.seedVersion ?? 0), fresh: false }
    },

    attach() {
      /* l'adaptateur Neon n'a pas besoin de l'état : il reçoit chaque ligne via onWrite */
    },

    onWrite(collection: CollectionName, op: WriteOp, row: any, opts?: WriteOpts) {
      if (stopped || !row || row.id == null) return
      if (collection === 'auditLog' && auditRefused) return
      const id = String(row.id)
      const job: Job = {
        key: `${collection}/${id}`,
        collection,
        id,
        op: op === 'remove' ? 'delete' : 'put',
        body: op === 'remove' ? undefined : JSON.stringify(row),
        via: opts?.via,
      }
      // coalescence : on remplace une écriture en attente (hors celle en cours d'envoi, en tête de file)
      const start = running ? 1 : 0
      let idx = -1
      for (let i = start; i < queue.length; i++) {
        if (queue[i]!.key === job.key) {
          idx = i
          break
        }
      }
      if (idx >= 0) queue[idx] = job
      else queue.push(job)
      notify()
      void pump()
    },

    pending: () => queue.length,

    flush() {
      if (!queue.length || stopped) return Promise.resolve()
      void pump()
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve)
        void setT(resolve, options.flushTimeoutMs ?? 8000)
      })
    },

    async reset(): Promise<DbState> {
      await adapter.flush()
      const headers = await options.getHeaders()
      let res
      try {
        res = await options.fetch(`${base}/api/db/reset`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers } })
      } catch {
        throw new NeonUnavailableError()
      }
      if (!res.ok) throw new Error(await messageOf(res))
      return (await adapter.load()).state
    },

    pendingJobs(): NeonPendingJob[] {
      return queue.map((j) => ({ collection: j.collection, id: j.id, op: j.op, row: j.body ? JSON.parse(j.body) : undefined }))
    },

    dispose() {
      stopped = true
      settle()
    },
  }
  return adapter
}
