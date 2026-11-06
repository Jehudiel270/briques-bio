/** Contexte commun des routes : magasin de données + appelant identifié. */
import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { ensureSeeded, useStore, type Store } from './store'
import { resolveActor, type Actor } from './session'
import { toHttp } from './http'

export interface RouteCtx {
  store: Store
  actor: Actor
  demoMode: boolean
}

export async function routeContext(event: H3Event, opts: { seed?: boolean } = {}): Promise<RouteCtx> {
  try {
    const store = await useStore(event)
    await store.ensure()
    if (opts.seed) await ensureSeeded(store)
    const actor = await resolveActor(event, () => store.loadCollection('users'))
    const cfg = useRuntimeConfig(event) as any
    return { store, actor, demoMode: cfg.public?.demoMode !== false && cfg.public?.demoMode !== 'false' }
  } catch (e) {
    return toHttp(e)
  }
}

export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const raw = await readBody(event).catch(() => undefined)
  const res = schema.safeParse(raw)
  if (!res.success) {
    const first = res.error.issues[0]
    throw createError({ statusCode: 422, statusMessage: `Données invalides${first ? ` (${first.path.join('.') || 'corps'} : ${first.message})` : ''}.` })
  }
  return res.data
}
