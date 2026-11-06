/** Erreur métier : message en français, affichable tel quel à l'utilisateur. */
export class ServiceError extends Error {
  code: string
  constructor(message: string, code = 'service_error') {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}

/** Lève une ServiceError (le type de retour `never` permet de l'utiliser comme garde). */
export function fail(message: string, code?: string): never {
  throw new ServiceError(message, code)
}

export function assert(cond: unknown, message: string, code?: string): asserts cond {
  if (!cond) throw new ServiceError(message, code)
}
