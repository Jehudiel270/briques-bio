import { routeContext } from '../../utils/context'
import { toHttp } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    const { actor } = await routeContext(event)
    return { user: actor.user ?? null, role: actor.role, mode: actor.mode === 'neon' && !actor.user ? 'visitor' : actor.mode }
  } catch (e) {
    return toHttp(e)
  }
})
