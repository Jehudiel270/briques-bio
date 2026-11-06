/**
 * Base de données applicative : singleton réactif construit sur le noyau `createDb`.
 *
 * Retourne le noyau (`all/get/peek/raw/create/update/remove/nextRef/notify/history/audit/now/actor/state`)
 * et, en plus : `ready` (Ref<boolean>), `mode` (Ref<'local'|'neon'>), `pending` (Ref<number>, écritures
 * pas encore persistées), `init()`, `reset()`, `reload()`, `flush()`, `sys` (noyau sans contrôle d'accès,
 * réservé aux flux système comme l'inscription simulée).
 */
import { reactive, ref, type Ref } from 'vue'
import { createDb, emptyState, type Db, type DbState } from '#shared/utils/db-core'
import {
  createLocalAdapter,
  createNeonAdapter,
  replaceState,
  resolveDataMode,
  type DataMode,
  type PersistenceAdapter,
} from '~/utils/persistence'
import { actorFromSession, authHeaders, sessionRef } from '~/utils/auth-session'
import { toastSafe } from '~/utils/toast-safe'

export interface DbApi extends Db {
  ready: Ref<boolean>
  mode: Ref<DataMode>
  pending: Ref<number>
  init(): Promise<void>
  reset(): Promise<void>
  reload(): Promise<void>
  flush(): Promise<void>
  /** Noyau sans contrôle d'accès (flux système : inscription simulée, amorçage) */
  sys: Db
}

let api: DbApi | null = null

export function useDb(): DbApi {
  if (api) return api

  const state = reactive(emptyState()) as DbState
  const ready = ref(false)
  const mode = ref<DataMode>('local')
  const pending = ref(0)
  let adapter: PersistenceAdapter | null = null
  let initPromise: Promise<void> | null = null

  const getActor = () => actorFromSession(sessionRef.value, state.users)
  const hooks = {
    onWrite: (...args: Parameters<NonNullable<PersistenceAdapter['onWrite']>>) => adapter?.onWrite(...args),
  }
  const core = createDb(state, { getActor, hooks })
  const sys = createDb(state, { getActor, hooks, enforce: false })

  // Contexte Nuxt capturé tant qu'il est disponible (les rappels asynchrones n'y ont plus accès)
  const config = useRuntimeConfig()
  const baseUrl = String(config.app?.baseURL ?? '/').replace(/\/+$/, '')
  const dataMode = String((config.public as any).dataMode ?? 'auto')
  const fetcher = (url: string, init?: any) => fetch(url, init)

  const onPendingChange = (n: number) => {
    pending.value = n
  }

  async function startLocal() {
    const local = createLocalAdapter({
      onPendingChange,
      onError: (e) => console.warn('[EcoBloc] Sauvegarde locale incomplète :', e),
    })
    const res = await local.load()
    replaceState(state, res.state)
    local.attach(state)
    adapter = local
    mode.value = 'local'
  }

  function makeNeon() {
    const neon = createNeonAdapter({
      fetch: fetcher,
      baseUrl,
      getHeaders: authHeaders,
      onPendingChange,
      onRejected: (r) => toastSafe('error', `${r.message} L’action n’a pas été enregistrée sur le serveur.`, 'Enregistrement refusé'),
      onFallback: () => void fallbackToLocal(neon.pendingJobs()),
    })
    return neon
  }

  /** Le serveur ne répond plus : on repart de la base locale en conservant les dernières modifications non envoyées. */
  async function fallbackToLocal(jobs: ReturnType<ReturnType<typeof makeNeon>['pendingJobs']>) {
    try {
      const local = createLocalAdapter({ onPendingChange })
      const res = await local.load()
      replaceState(state, res.state)
      for (const j of jobs) {
        const rows = (state as any)[j.collection] as { id: string }[]
        const i = rows.findIndex((r) => r.id === j.id)
        if (j.op === 'delete') {
          if (i >= 0) rows.splice(i, 1)
        } else if (j.row) {
          if (i >= 0) rows.splice(i, 1, j.row)
          else rows.unshift(j.row)
        }
      }
      local.attach(state)
      adapter = local
      mode.value = 'local'
      local.onWrite('settings', 'update', { id: 'company' })
      await local.flush()
      toastSafe(
        'warning',
        'Le serveur ne répond plus : EcoBloc continue avec les données locales de démonstration, enregistrées dans ce navigateur.',
        'Mode local activé',
      )
    } catch (e) {
      console.error('[EcoBloc] Bascule vers le stockage local impossible', e)
    }
  }

  async function init() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const { mode: wanted } = await resolveDataMode(dataMode, fetcher, { baseUrl })
      if (wanted === 'neon') {
        try {
          const neon = makeNeon()
          const res = await neon.load()
          replaceState(state, res.state)
          neon.attach(state)
          adapter = neon
          mode.value = 'neon'
        } catch (e) {
          console.warn('[EcoBloc] Serveur de données indisponible', e)
          toastSafe('warning', 'Le serveur de données ne répond pas : EcoBloc utilise les données locales de démonstration.', 'Mode local activé')
          await startLocal()
        }
      } else {
        await startLocal()
      }
      ready.value = true
    })()
    return initPromise
  }

  async function flush() {
    await adapter?.flush()
  }

  async function reload() {
    if (!adapter || adapter.kind !== 'neon') return
    await adapter.flush()
    try {
      const res = await adapter.load()
      replaceState(state, res.state)
    } catch (e) {
      console.warn('[EcoBloc] Rechargement impossible', e)
      toastSafe('error', 'Les données n’ont pas pu être rechargées depuis le serveur. Réessayez dans un instant.', 'Serveur injoignable')
    }
  }

  async function reset() {
    if (!adapter) await init()
    if (!adapter) return
    await adapter.flush()
    const next = await adapter.reset()
    replaceState(state, next)
    if (adapter.kind === 'local') {
      core.audit({ action: 'reset', entity: 'db', summary: 'Données de démonstration réamorcées' })
    }
  }

  api = {
    ...core,
    ready,
    mode,
    pending,
    init,
    reset,
    reload,
    flush,
    sys,
  }
  return api
}
