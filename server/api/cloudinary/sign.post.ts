/** Signature d'envoi Cloudinary (jamais le secret). Dossier limité à l'arborescence du projet. */
import { z } from 'zod'
import { buildUploadSignature } from '../../utils/cloudinary'
import { parseBody, routeContext } from '../../utils/context'
import { rateLimit, toHttp } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    rateLimit(event, 'cld-sign', 40)
    const { folder } = await parseBody(event, z.object({ folder: z.string().max(40) }))
    const { actor } = await routeContext(event)
    if (actor.role === 'visitor') throw createError({ statusCode: 401, statusMessage: 'Connectez-vous pour envoyer des fichiers.' })
    const c = (useRuntimeConfig(event) as any).cloudinary
    const res = buildUploadSignature({ folder, root: c.folder || 'ecobloc', cloudName: c.cloudName, apiKey: c.apiKey, apiSecret: c.apiSecret })
    if ('error' in res) {
      if (res.error === 'folder') throw createError({ statusCode: 422, statusMessage: 'Dossier Cloudinary non autorisé.' })
      throw createError({ statusCode: 503, statusMessage: 'Cloudinary n’est pas configuré sur ce serveur.' })
    }
    return res
  } catch (e) {
    return toHttp(e)
  }
})
