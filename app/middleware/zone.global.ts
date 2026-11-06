/**
 * Zones de l'application (contrat §5) :
 *  - choisit le layout selon le préfixe de la route ;
 *  - exige une connexion pour /espace, /collecte, /terrain, /ops/*, /admin ;
 *  - renvoie vers l'accueil du rôle (avec un message) si le rôle n'a pas accès à la zone.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const db = useDb()
  const auth = useAuth()
  if (!db.ready.value) await db.init()

  setPageLayout(layoutForPath(to.path))

  const path = to.path.replace(/\/+$/, '') || '/'

  // /ops seul n'a pas de page : on oriente vers le module du rôle
  if (path === '/ops') {
    if (!auth.isLoggedIn.value) return navigateTo({ path: '/connexion', query: { redirect: to.fullPath } })
    return navigateTo(homeFor(auth.role.value))
  }

  if (!needsLogin(path)) return

  if (!auth.isLoggedIn.value) {
    return navigateTo({ path: '/connexion', query: { redirect: to.fullPath } })
  }

  if (!canAccessRoute(auth.role.value, path)) {
    toastSafe(
      'info',
      `Cette page n’est pas accessible avec le rôle « ${roleLabel(auth.role.value)} ». Vous êtes redirigé vers votre espace.`,
      'Accès limité',
    )
    return navigateTo(homeFor(auth.role.value))
  }
})
