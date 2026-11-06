import { bindServices, type BoundServices } from '#shared/services'

let bound: BoundServices | null = null

/**
 * Services métier (`shared/services`) liés à la base applicative : mêmes fonctions, sans le paramètre `db`.
 *   const svc = useServices(); await svc.quotes.accept(id)
 */
export function useServices(): BoundServices {
  if (!bound) bound = bindServices(useDb())
  return bound
}
