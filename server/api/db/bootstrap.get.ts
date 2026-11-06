/** État de la base filtré selon le rôle de l'appelant ; amorce la base si elle est vide. */
import { SEED_VERSION } from '../../../shared/seed'
import { routeContext } from '../../utils/context'
import { toHttp } from '../../utils/http'
import { filterStateFor } from '../../utils/rbac'
import { ensureSeeded } from '../../utils/store'

export default defineEventHandler(async (event) => {
  try {
    const { store, actor } = await routeContext(event)
    await ensureSeeded(store)
    const state = await store.loadAll()
    setHeader(event, 'cache-control', 'no-store')
    return { seedVersion: (await store.getMeta<number>('seedVersion')) ?? SEED_VERSION, state: filterStateFor(state, actor) }
  } catch (e) {
    return toHttp(e)
  }
})
