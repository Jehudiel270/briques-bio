/** Crée ou remplace une ligne après contrôle des droits (collection, champs, propriété, service). */
import { COLLECTION_NAMES } from '../../../../shared/utils/db-core'
import { routeContext } from '../../../utils/context'
import { toHttp } from '../../../utils/http'
import { authorizeWrite } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  try {
    const collection = getRouterParam(event, 'collection') ?? ''
    const id = getRouterParam(event, 'id') ?? ''
    const { store, actor } = await routeContext(event)
    const body = await readBody(event).catch(() => undefined)
    const existing = (await store.getRow(collection, id)) ?? null
    // collections nécessaires aux jointures de propriété (commandes pour les livraisons/lots, sociétés pour les grilles)
    const joins: Record<string, any[]> = {}
    for (const c of ['orders', 'companies']) joins[c] = await store.loadCollection(c)
    const { row } = authorizeWrite({
      collection, id, op: 'put', body, existing, actor,
      via: getHeader(event, 'x-service'),
      all: (c) => (joins[c] ?? []) as any[],
    })
    await store.upsert(collection, id, row)
    return { ok: true }
  } catch (e) {
    return toHttp(e)
  }
})
