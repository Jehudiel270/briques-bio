/** Réinitialise la base de démonstration (administrateur, mode démo uniquement). */
import { routeContext } from '../../utils/context'
import { toHttp } from '../../utils/http'
import { ensureSeeded } from '../../utils/store'
import { uid } from '../../../shared/utils/db-core'

export default defineEventHandler(async (event) => {
  try {
    const { store, actor, demoMode } = await routeContext(event)
    if (!demoMode) throw createError({ statusCode: 403, statusMessage: 'La réinitialisation n’est disponible qu’en mode démonstration.' })
    if (actor.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Seul un administrateur peut réinitialiser les données de démonstration.' })
    const res = await ensureSeeded(store, { force: true })
    await store.upsert('auditLog', 'aud_reset_' + uid('r').slice(2), {
      id: 'aud_reset_' + uid('r').slice(2), at: new Date().toISOString(), userId: actor.id, userName: actor.name, role: actor.role,
      action: 'reset', entity: 'database', summary: 'Réinitialisation des données de démonstration',
    })
    return { ok: true, rows: res.rows }
  } catch (e) {
    return toHttp(e)
  }
})
