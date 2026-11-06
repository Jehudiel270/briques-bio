/** Favoris du client connecté (client particulier, professionnel, distributeur). Les autres visiteurs sont invités à se connecter. */
const FAVORITE_ROLES = ['client', 'pro', 'distributor']

export function useFavorites() {
  const db = useDb()
  const auth = useAuth()
  const ids = computed(() => new Set(db.all('favorites').filter((f) => f.userId === auth.user.value?.id).map((f) => f.productId)))

  /** Ajoute ou retire un favori ; renvoie `null` si la connexion est requise (redirige vers /connexion). */
  function toggle(productId: string, redirect = '/catalogue'): boolean | null {
    const u = auth.user.value
    if (!u || !FAVORITE_ROLES.includes(u.role)) {
      navigateTo({ path: '/connexion', query: { redirect } })
      return null
    }
    const existing = db.all('favorites').find((f) => f.userId === u.id && f.productId === productId)
    if (existing) {
      db.remove('favorites', existing.id)
      return false
    }
    db.create('favorites', { userId: u.id, productId, createdAt: db.now() } as any)
    return true
  }

  return { ids, has: (productId: string) => ids.value.has(productId), toggle }
}
