import { describe, expect, it } from 'vitest'
import { createLocalAdapter, localKey, LOCAL_DB_PREFIX, type StorageLike } from '../app/utils/persistence/local'
import { createNeonAdapter, NeonUnavailableError } from '../app/utils/persistence/neon'
import { replaceState, resolveDataMode, type FetchLike } from '../app/utils/persistence'
import { SEED_VERSION } from '../shared/seed'
import { COLLECTION_NAMES, emptyState } from '../shared/utils/db-core'

class FakeStorage implements StorageLike {
  data = new Map<string, string>()
  failWhen: ((value: string) => boolean) | null = null
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    if (this.failWhen?.(v)) throw new DOMException('quota', 'QuotaExceededError')
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  get length() {
    return this.data.size
  }
}

/** Minuteries manuelles pour tester la sauvegarde différée */
function manualTimers() {
  let next = 1
  const pending = new Map<number, () => void>()
  return {
    setTimer: (fn: () => void) => {
      const id = next++
      pending.set(id, fn)
      return id
    },
    clearTimer: (h: unknown) => void pending.delete(h as number),
    fire: () => {
      const fns = [...pending.values()]
      pending.clear()
      fns.forEach((f) => f())
    },
    count: () => pending.size,
  }
}

describe('persistance locale', () => {
  it('amorce la base au premier chargement et la stocke sous la clé versionnée', async () => {
    const storage = new FakeStorage()
    const res = await createLocalAdapter({ storage }).load()
    expect(res.fresh).toBe(true)
    expect(res.seedVersion).toBe(SEED_VERSION)
    expect(res.state.users.length).toBeGreaterThan(5)
    expect(localKey()).toBe(`ecobloc:db:v${SEED_VERSION}`)
    expect(storage.getItem(localKey())).toContain('"users"')
  })

  it('recharge l’état sauvegardé au chargement suivant', async () => {
    const storage = new FakeStorage()
    const a = createLocalAdapter({ storage, debounceMs: 0 })
    const { state } = await a.load()
    a.attach(state)
    state.users[0]!.name = 'Nom modifié'
    a.onWrite('users', 'update', state.users[0])
    await a.flush()

    const again = await createLocalAdapter({ storage }).load()
    expect(again.fresh).toBe(false)
    expect(again.state.users[0]!.name).toBe('Nom modifié')
  })

  it('regroupe les écritures rapprochées en une seule sauvegarde différée', async () => {
    const storage = new FakeStorage()
    const timers = manualTimers()
    let saves = 0
    const original = storage.setItem.bind(storage)
    const a = createLocalAdapter({ storage, setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    const { state } = await a.load()
    storage.setItem = (k, v) => {
      saves++
      original(k, v)
    }
    a.attach(state)
    a.onWrite('users', 'update', state.users[0])
    a.onWrite('users', 'update', state.users[1])
    a.onWrite('orders', 'create', {})
    expect(saves).toBe(0)
    expect(a.pending()).toBe(1)
    expect(timers.count()).toBe(1) // chaque écriture remplace la minuterie précédente
    timers.fire()
    expect(saves).toBe(1)
    expect(a.pending()).toBe(0)
  })

  it('force la sauvegarde si les écritures s’enchaînent trop longtemps', async () => {
    const storage = new FakeStorage()
    const timers = manualTimers()
    let t = 0
    let saves = 0
    const a = createLocalAdapter({ storage, setTimer: timers.setTimer, clearTimer: timers.clearTimer, now: () => t, maxWaitMs: 1000 })
    const { state } = await a.load()
    a.attach(state)
    const original = storage.setItem.bind(storage)
    storage.setItem = (k, v) => {
      saves++
      original(k, v)
    }
    a.onWrite('users', 'update', {})
    t = 1500
    a.onWrite('users', 'update', {})
    expect(saves).toBe(1)
  })

  it('supprime les bases d’anciennes versions et réamorce si la version change', async () => {
    const storage = new FakeStorage()
    storage.setItem(`${LOCAL_DB_PREFIX}0`, '{"v":0}')
    storage.setItem('ecobloc:cart', '[]')
    // même clé mais contenu d'une autre version
    storage.setItem(localKey(), JSON.stringify({ v: SEED_VERSION + 5, state: { users: [{ id: 'x' }], settings: [{ id: 'company' }] } }))
    const res = await createLocalAdapter({ storage }).load()
    expect(res.fresh).toBe(true)
    expect(storage.getItem(`${LOCAL_DB_PREFIX}0`)).toBeNull()
    expect(storage.getItem('ecobloc:cart')).toBe('[]')
    expect(res.state.users.some((u) => u.id === 'x')).toBe(false)
  })

  it('supprime l’ancienne clé quand la version du jeu de données augmente', async () => {
    const storage = new FakeStorage()
    storage.setItem(localKey(SEED_VERSION), JSON.stringify({ v: SEED_VERSION, state: {} }))
    const res = await createLocalAdapter({ storage, seedVersion: SEED_VERSION + 1 }).load()
    expect(res.fresh).toBe(true)
    expect(storage.getItem(localKey(SEED_VERSION))).toBeNull()
    expect(storage.getItem(localKey(SEED_VERSION + 1))).not.toBeNull()
  })

  it('réamorce quand le contenu est illisible ou vide', async () => {
    for (const raw of ['pas du json', '{"v":1,"state":{}}', 'null']) {
      const storage = new FakeStorage()
      storage.setItem(localKey(), raw)
      const res = await createLocalAdapter({ storage }).load()
      expect(res.fresh, raw).toBe(true)
      expect(res.state.users.length).toBeGreaterThan(0)
    }
  })

  it('complète les collections absentes d’une sauvegarde plus ancienne', async () => {
    const seed = (await createLocalAdapter({ storage: new FakeStorage() }).load()).state
    const partial: any = { users: seed.users, settings: seed.settings }
    const storage = new FakeStorage()
    storage.setItem(localKey(), JSON.stringify({ v: SEED_VERSION, state: partial }))
    const res = await createLocalAdapter({ storage }).load()
    expect(res.fresh).toBe(false)
    for (const c of COLLECTION_NAMES) expect(Array.isArray(res.state[c]), c).toBe(true)
  })

  it('retente avec un journal allégé quand le quota est dépassé', async () => {
    const storage = new FakeStorage()
    const errors: unknown[] = []
    const a = createLocalAdapter({ storage, onError: (e) => errors.push(e) })
    const { state } = await a.load()
    a.attach(state)
    for (let i = 0; i < 400; i++) state.auditLog.push({ id: `aud_${i}`, at: '', userName: 'x', action: 'update', entity: 'x', summary: 's' })
    const limit = JSON.stringify(state).length - 1000
    storage.failWhen = (v) => v.length > limit
    a.onWrite('users', 'update', {})
    await a.flush()
    expect(errors.length).toBe(1)
    const stored = JSON.parse(storage.getItem(localKey())!)
    expect(stored.state.auditLog.length).toBe(200)
  })

  it('fonctionne sans stockage (mémoire seule)', async () => {
    const a = createLocalAdapter({ storage: null })
    const { state } = await a.load()
    a.attach(state)
    a.onWrite('users', 'update', {})
    await expect(a.flush()).resolves.toBeUndefined()
  })

  it('reset renvoie une base neuve et la stocke', async () => {
    const storage = new FakeStorage()
    const a = createLocalAdapter({ storage })
    const { state } = await a.load()
    a.attach(state)
    state.users.length = 0
    a.onWrite('users', 'remove', {})
    const fresh = await a.reset()
    expect(fresh.users.length).toBeGreaterThan(5)
    expect(a.pending()).toBe(0)
    expect(JSON.parse(storage.getItem(localKey())!).state.users.length).toBe(fresh.users.length)
  })
})

describe('replaceState', () => {
  it('remplace les collections fournies et vide les autres', () => {
    const target = emptyState()
    target.orders.push({ id: 'o1' } as any)
    target.faqs.push({ id: 'f1' } as any)
    replaceState(target, { faqs: [{ id: 'f2' } as any] })
    expect(target.orders).toEqual([])
    expect(target.faqs.map((f) => f.id)).toEqual(['f2'])
  })
})

// ----------------------------------------------------------------------------------- Neon
type Call = { url: string; method: string; headers: Record<string, string>; body?: string }

function fakeFetch(handler: (call: Call, n: number) => Promise<{ status: number; body?: any }> | { status: number; body?: any }) {
  const calls: Call[] = []
  const fetch: FetchLike = async (url, init) => {
    const call: Call = { url, method: init?.method ?? 'GET', headers: init?.headers ?? {}, body: init?.body }
    calls.push(call)
    const r = await handler(call, calls.length)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} }
  }
  return { fetch, calls }
}

const baseOpts = { retryDelayMs: 0, flushTimeoutMs: 2000 }

describe('adaptateur Neon', () => {
  it('charge l’état filtré renvoyé par le serveur et complète les collections absentes', async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 200, body: { seedVersion: 3, state: { products: [{ id: 'p1' }], settings: [{ id: 'company' }] } } }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({ 'x-demo-user': 'usr_admin' }), ...baseOpts })
    const res = await adapter.load()
    expect(calls[0]).toMatchObject({ url: '/api/db/bootstrap', method: 'GET' })
    expect(calls[0]!.headers['x-demo-user']).toBe('usr_admin')
    expect(res.seedVersion).toBe(3)
    expect(res.state.products).toHaveLength(1)
    expect(res.state.orders).toEqual([])
  })

  it('signale un serveur injoignable ou en erreur au chargement', async () => {
    const down = createNeonAdapter({ fetch: async () => { throw new TypeError('network') }, getHeaders: () => ({}), ...baseOpts })
    await expect(down.load()).rejects.toBeInstanceOf(NeonUnavailableError)
    const err = fakeFetch(() => ({ status: 500 }))
    await expect(createNeonAdapter({ fetch: err.fetch, getHeaders: () => ({}), ...baseOpts }).load()).rejects.toBeInstanceOf(NeonUnavailableError)
  })

  it('envoie PUT et DELETE avec identité et x-service', async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 200 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: async () => ({ Authorization: 'Bearer jeton' }), baseUrl: '/base', ...baseOpts })
    adapter.onWrite('quotes', 'create', { id: 'q 1', ref: 'DV-1' }, { via: 'quotes.request' })
    adapter.onWrite('faqs', 'remove', { id: 'f1' })
    await adapter.flush()
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ url: '/base/api/db/quotes/q%201', method: 'PUT' })
    expect(calls[0]!.headers).toMatchObject({ Authorization: 'Bearer jeton', 'x-service': 'quotes.request', 'content-type': 'application/json' })
    expect(JSON.parse(calls[0]!.body!)).toEqual({ id: 'q 1', ref: 'DV-1' })
    expect(calls[1]).toMatchObject({ url: '/base/api/db/faqs/f1', method: 'DELETE' })
    expect(calls[1]!.headers['x-service']).toBeUndefined()
    expect(adapter.pending()).toBe(0)
  })

  it('remplace une écriture en attente sur la même ligne (coalescence)', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { fetch, calls } = fakeFetch(async (_c, n) => {
      if (n === 1) await gate
      return { status: 200 }
    })
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), ...baseOpts })
    adapter.onWrite('orders', 'update', { id: 'a', v: 1 }) // en cours d'envoi
    adapter.onWrite('orders', 'update', { id: 'b', v: 1 })
    adapter.onWrite('orders', 'update', { id: 'b', v: 2 })
    adapter.onWrite('orders', 'update', { id: 'a', v: 2 }) // la ligne « a » est déjà en vol : nouvelle entrée
    expect(adapter.pending()).toBe(3)
    release()
    await adapter.flush()
    expect(calls.map((c) => JSON.parse(c.body!))).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'a', v: 2 }])
  })

  it('considère la suppression d’une ligne absente (404) comme réussie', async () => {
    const rejected: unknown[] = []
    const { fetch } = fakeFetch(() => ({ status: 404 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), onRejected: (r) => rejected.push(r), ...baseOpts })
    adapter.onWrite('faqs', 'remove', { id: 'zz' })
    await adapter.flush()
    expect(rejected).toHaveLength(0)
  })

  it('signale un refus 4xx puis continue la file ; les collections « au mieux » restent silencieuses', async () => {
    const rejected: any[] = []
    const { fetch, calls } = fakeFetch((c) => (c.url.includes('/orders/') ? { status: 403, body: { statusMessage: 'Action non autorisée.' } } : { status: 403 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), onRejected: (r) => rejected.push(r), ...baseOpts })
    adapter.onWrite('orders', 'update', { id: 'o1' })
    adapter.onWrite('notifications', 'create', { id: 'n1' })
    adapter.onWrite('auditLog', 'create', { id: 'a1' })
    adapter.onWrite('auditLog', 'create', { id: 'a2' }) // ignorée : le serveur a refusé le journal client
    await adapter.flush()
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ collection: 'orders', id: 'o1', status: 403, message: 'Action non autorisée.' })
    expect(calls.map((c) => c.url)).toEqual(['/api/db/orders/o1', '/api/db/notifications/n1', '/api/db/auditLog/a1'])
  })

  it('ne rejoue jamais une écriture refusée en 4xx et retire les écritures de journal en attente après un refus', async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 403 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), ...baseOpts })
    adapter.onWrite('auditLog', 'create', { id: 'a1' })
    adapter.onWrite('faqs', 'update', { id: 'f1' })
    adapter.onWrite('auditLog', 'create', { id: 'a2' })
    adapter.onWrite('auditLog', 'create', { id: 'a3' })
    await adapter.flush()
    expect(calls.map((c) => c.url)).toEqual(['/api/db/auditLog/a1', '/api/db/faqs/f1'])
    expect(adapter.pending()).toBe(0)
    expect(adapter.stopped).toBe(false)
  })

  it('un serveur injoignable pour une collection « au mieux » ne bascule pas en local et ne bloque pas la file', async () => {
    const fallbacks: string[] = []
    const rejected: unknown[] = []
    const { fetch, calls } = fakeFetch((c) => (c.url.includes('/notifications/') ? { status: 503 } : { status: 200 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), onFallback: (r) => fallbacks.push(r), onRejected: (r) => rejected.push(r), ...baseOpts })
    adapter.onWrite('notifications', 'create', { id: 'n1' })
    adapter.onWrite('faqs', 'update', { id: 'f1' })
    await adapter.flush()
    expect(fallbacks).toHaveLength(0)
    expect(rejected).toHaveLength(0)
    expect(adapter.stopped).toBe(false)
    expect(calls.map((c) => c.url)).toEqual(['/api/db/notifications/n1', '/api/db/notifications/n1', '/api/db/faqs/f1'])
    expect(adapter.pending()).toBe(0)
  })

  it('réessaie après une erreur serveur passagère', async () => {
    const { fetch, calls } = fakeFetch((_c, n) => ({ status: n < 3 ? 503 : 200 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({}), ...baseOpts })
    adapter.onWrite('faqs', 'update', { id: 'f1' })
    await adapter.flush()
    expect(calls).toHaveLength(3)
    expect(adapter.pending()).toBe(0)
    expect(adapter.stopped).toBe(false)
  })

  it('recalcule les en-têtes après un 401 (jeton expiré)', async () => {
    let token = 'vieux'
    const { fetch, calls } = fakeFetch((c) => ({ status: c.headers.Authorization === 'Bearer vieux' ? 401 : 200 }))
    const adapter = createNeonAdapter({
      fetch,
      getHeaders: () => {
        const h = { Authorization: `Bearer ${token}` }
        token = 'frais'
        return h
      },
      ...baseOpts,
    })
    adapter.onWrite('faqs', 'update', { id: 'f1' })
    await adapter.flush()
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer vieux', 'Bearer frais'])
  })

  it('bascule (onFallback) quand le serveur reste injoignable et conserve les écritures non envoyées', async () => {
    const fallbacks: string[] = []
    const adapter = createNeonAdapter({
      fetch: async () => { throw new TypeError('network') },
      getHeaders: () => ({}),
      maxAttempts: 2,
      onFallback: (r) => fallbacks.push(r),
      ...baseOpts,
    })
    adapter.onWrite('faqs', 'update', { id: 'f1', q: 'a' })
    adapter.onWrite('faqs', 'remove', { id: 'f2' })
    await adapter.flush()
    expect(fallbacks).toHaveLength(1)
    expect(adapter.stopped).toBe(true)
    expect(adapter.pendingJobs()).toEqual([
      { collection: 'faqs', id: 'f1', op: 'put', row: { id: 'f1', q: 'a' } },
      { collection: 'faqs', id: 'f2', op: 'delete', row: undefined },
    ])
    adapter.onWrite('faqs', 'update', { id: 'f3' }) // ignoré après la bascule
    expect(adapter.pendingJobs()).toHaveLength(2)
  })

  it('reset appelle /api/db/reset puis recharge', async () => {
    const { fetch, calls } = fakeFetch((c) => (c.url.endsWith('/bootstrap') ? { status: 200, body: { seedVersion: 1, state: { users: [{ id: 'u' }] } } } : { status: 200 }))
    const adapter = createNeonAdapter({ fetch, getHeaders: () => ({ 'x-demo-user': 'usr_admin' }), ...baseOpts })
    const state = await adapter.reset()
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['POST /api/db/reset', 'GET /api/db/bootstrap'])
    expect(state.users).toHaveLength(1)
  })
})

describe('resolveDataMode', () => {
  const health = (body: any, ok = true): FetchLike => async () => ({ ok, status: ok ? 200 : 500, json: async () => body })
  it('respecte local et neon sans interroger le serveur', async () => {
    const never: FetchLike = async () => { throw new Error('ne doit pas être appelé') }
    expect((await resolveDataMode('local', never)).mode).toBe('local')
    expect((await resolveDataMode('neon', never)).mode).toBe('neon')
  })
  it('auto : Neon seulement si /api/health annonce db: neon', async () => {
    expect((await resolveDataMode('auto', health({ ok: true, db: 'neon' }))).mode).toBe('neon')
    expect((await resolveDataMode('auto', health({ ok: true, db: 'none' }))).mode).toBe('local')
    expect((await resolveDataMode('auto', health({}, false))).mode).toBe('local')
    expect((await resolveDataMode('auto', async () => { throw new Error('x') })).mode).toBe('local')
  })
})
