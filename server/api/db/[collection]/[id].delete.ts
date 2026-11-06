/** Supprime une ligne après contrôle des droits. */
import { routeContext } from '../../../utils/context'
import { toHttp } from '../../../utils/http'
import { authorizeWrite } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  try {
    const collection = getRouterParam(event, 'collection') ?? ''
    const id = getRouterParam(event, 'id') ?? ''
    const { store, actor } = await routeContext(event)
    const existing = (await store.getRow(collection, id)) ?? null
    authorizeWrite({ collection, id, op: 'delete', existing, actor, via: getHeader(event, 'x-service'), all: () => [] })
    const removed = await store.remove(collection, id)
    if (!removed) throw createError({ statusCode: 404, statusMessage: 'Cet élément n’existe plus.' })
    return { ok: true }
  } catch (e) {
    return toHttp(e)
  }
})
