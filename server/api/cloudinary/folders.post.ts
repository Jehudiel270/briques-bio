/** Crée l'arborescence de dossiers du projet sur Cloudinary (administrateur). */
import { createProjectFolders } from '../../utils/cloudinary'
import { routeContext } from '../../utils/context'
import { toHttp } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    const { actor } = await routeContext(event)
    if (actor.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs.' })
    const c = (useRuntimeConfig(event) as any).cloudinary
    if (!c.cloudName || !c.apiKey || !c.apiSecret) throw createError({ statusCode: 503, statusMessage: 'Cloudinary n’est pas configuré sur ce serveur.' })
    const results = await createProjectFolders({ cloudName: c.cloudName, apiKey: c.apiKey, apiSecret: c.apiSecret, root: c.folder || 'ecobloc' })
    if (results.every((r) => r.status === 'error')) {
      throw createError({ statusCode: 502, statusMessage: 'Cloudinary est injoignable ou refuse les identifiants : vérifiez la configuration.', data: { results } })
    }
    return { ok: results.every((r) => r.status !== 'error'), results }
  } catch (e) {
    return toHttp(e)
  }
})
