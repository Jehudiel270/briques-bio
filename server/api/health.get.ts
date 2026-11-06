/** État du serveur — jamais de secret. */
import { routeContext } from '../utils/context'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event) as any
  const demoMode = cfg.public?.demoMode !== false && cfg.public?.demoMode !== 'false'
  const out = { ok: true, db: 'none' as 'neon' | 'none', seeded: false, demoMode, time: new Date().toISOString() }
  if (!cfg.databaseUrl) return out
  try {
    const { store } = await routeContext(event)
    out.db = 'neon'
    out.seeded = !(await store.isEmpty())
  } catch {
    out.db = 'none' // Neon configuré mais injoignable : le client bascule sur le stockage local
  }
  return out
})
