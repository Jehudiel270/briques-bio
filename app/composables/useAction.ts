/**
 * Exécute une action métier avec retour utilisateur :
 *   const act = useAction()
 *   const ok = await act(() => svc.orders.pay(id, {...}), 'Paiement simulé enregistré')
 * Succès : toast de succès (si un message est fourni). Échec : toast d'erreur avec le message de
 * `ServiceError` / `PermissionError`, ou un message générique pour une erreur inattendue. Renvoie true/false.
 */
export interface ActionOptions {
  /** Titre du toast d'erreur (défaut : « Action impossible ») */
  errorTitle?: string
  /** Titre du toast de succès */
  successTitle?: string
}

const BUSINESS_ERRORS = new Set(['ServiceError', 'PermissionError', 'AuthFlowError'])

export function errorMessage(e: unknown): string {
  if (e instanceof Error && BUSINESS_ERRORS.has(e.name) && e.message) return e.message
  if (e instanceof Error && e.name === 'Error' && /^Introuvable : /.test(e.message)) {
    return 'Cet élément n’existe plus : actualisez la page puis réessayez.'
  }
  return 'Une erreur inattendue est survenue : réessayez, ou rechargez la page si le problème persiste.'
}

export function useAction() {
  const toast = useToast()
  return async function act<T = unknown>(fn: () => T | Promise<T>, successMessage?: string, opts: ActionOptions = {}): Promise<boolean> {
    try {
      await fn()
      if (successMessage) toast.success(successMessage, opts.successTitle ? { title: opts.successTitle } : undefined)
      return true
    } catch (e) {
      if (!(e instanceof Error) || !BUSINESS_ERRORS.has(e.name)) console.error('[EcoBloc] Action en échec', e)
      toast.error(errorMessage(e), { title: opts.errorTitle ?? 'Action impossible' })
      return false
    }
  }
}
