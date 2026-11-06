/**
 * Initialisation du cœur applicatif, côté client uniquement :
 *  1. session mémorisée (démo ou Neon Auth) ;
 *  2. base de données (Neon si disponible, sinon localStorage) ;
 *  3. sauvegarde des écritures en attente quand l'onglet se ferme ou passe en arrière-plan.
 * Le middleware `zone.global` attend ensuite `db.ready`.
 */
export default defineNuxtPlugin({
  name: 'ecobloc:core',
  dependsOn: ['ecobloc:theme'],
  async setup() {
    primeToast()
    const db = useDb()
    const auth = useAuth()
    await auth.restore()
    await db.init()

    window.addEventListener('pagehide', () => void db.flush())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void db.flush()
    })
  },
})
