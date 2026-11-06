/**
 * Affiche un toast depuis du code qui peut s'exécuter hors contexte Nuxt (rappels asynchrones, adaptateurs).
 * `primeToast()` est appelé une fois au démarrage (plugin) pour capturer l'API `useToast()`.
 */
type ToastKind = 'info' | 'success' | 'warning' | 'error'

let cached: Record<ToastKind, (message: string, opts?: { title?: string }) => unknown> | null = null

export function primeToast(): void {
  try {
    cached = useToast() as unknown as typeof cached
  } catch {
    /* le kit UI n'est pas encore disponible : les messages iront dans la console */
  }
}

export function toastSafe(kind: ToastKind, message: string, title?: string): void {
  try {
    if (!cached) cached = useToast() as unknown as typeof cached
    cached![kind](message, { title })
  } catch {
    console.warn(`[EcoBloc] ${title ? title + ' : ' : ''}${message}`)
  }
}
