/**
 * Enveloppe minimale autour de `@neondatabase/auth` (client Better Auth « vanilla »).
 * Le SDK n'est chargé qu'à la demande (import dynamique) : aucun coût en mode démonstration.
 *
 * API réelle du SDK (0.6) utilisée ici :
 *   const client = createAuthClient(url)                     // client Better Auth
 *   client.signUp.email({ email, password, name })           // → { data, error }
 *   client.signIn.email({ email, password })                 // → { data, error }
 *   client.getSession()                                      // → { data: { session: { token (JWT) }, user }, error }
 *   client.signOut()
 * Le JWT à envoyer dans `Authorization: Bearer …` est `session.token` renvoyé par `getSession()`.
 */

export class AuthFlowError extends Error {
  code: string
  constructor(message: string, code = 'auth') {
    super(message)
    this.name = 'AuthFlowError'
    this.code = code
  }
}

export interface NeonIdentity {
  id: string
  email: string
  name: string
  token: string | null
}

type Client = any
let cached: { url: string; promise: Promise<Client> } | null = null

export async function neonClient(url: string): Promise<Client> {
  if (cached && cached.url === url) return cached.promise
  const promise = import('@neondatabase/auth').then((m) => m.createAuthClient(url) as Client)
  cached = { url, promise }
  promise.catch(() => {
    if (cached?.promise === promise) cached = null
  })
  return promise
}

const UNREACHABLE = 'Le service d’authentification est injoignable. Vérifiez votre connexion et réessayez.'

/** Traduit une erreur Better Auth / réseau en message français actionnable. */
export function mapAuthError(err: any, flow: 'signin' | 'signup' | 'session' = 'signin'): AuthFlowError {
  const status: number | undefined = typeof err?.status === 'number' ? err.status : undefined
  const code = String(err?.code ?? '').toUpperCase()
  const raw = String(err?.message ?? '')
  // pas de statut HTTP (réseau coupé, délai dépassé) ou erreur serveur : le service ne répond pas
  if (!status || status >= 500) return new AuthFlowError(UNREACHABLE, 'unreachable')
  if (code.includes('USER_ALREADY_EXISTS') || (flow === 'signup' && status === 422 && /exist|already/i.test(raw))) {
    return new AuthFlowError('Un compte existe déjà avec cet e-mail. Connectez-vous ou utilisez une autre adresse.', 'exists')
  }
  if (code.includes('PASSWORD_TOO_SHORT') || /too short/i.test(raw)) {
    return new AuthFlowError('Le mot de passe est trop court : utilisez au moins 8 caractères.', 'weak_password')
  }
  if (code.includes('PASSWORD_TOO_LONG')) {
    return new AuthFlowError('Le mot de passe est trop long : utilisez 128 caractères au maximum.', 'weak_password')
  }
  if (code.includes('INVALID_EMAIL') && !code.includes('PASSWORD')) {
    return new AuthFlowError('Adresse e-mail invalide : vérifiez sa forme (nom@domaine.bj).', 'invalid_email')
  }
  if (code.includes('EMAIL_NOT_VERIFIED')) {
    return new AuthFlowError('Adresse e-mail non vérifiée : ouvrez le lien reçu par e-mail, puis reconnectez-vous.', 'unverified')
  }
  if (status === 429) {
    return new AuthFlowError('Trop de tentatives. Patientez quelques instants avant de réessayer.', 'rate_limited')
  }
  if (code.includes('INVALID_EMAIL_OR_PASSWORD') || status === 401 || status === 403) {
    return new AuthFlowError('E-mail ou mot de passe incorrect. Vérifiez votre saisie.', 'invalid_credentials')
  }
  return new AuthFlowError(flow === 'signup' ? `Inscription impossible : ${raw || 'demande refusée'}.` : `Connexion impossible : ${raw || 'demande refusée'}.`, 'auth')
}

function identityFrom(data: any): NeonIdentity | null {
  const user = data?.user
  if (!user?.id) return null
  return { id: String(user.id), email: String(user.email ?? ''), name: String(user.name ?? user.email ?? ''), token: data?.session?.token ?? null }
}

/** Session Neon Auth courante ; null s'il n'y en a pas ; lève `unreachable` si le service ne répond pas. */
export async function neonGetSession(url: string, timeoutMs = 6000): Promise<NeonIdentity | null> {
  try {
    const client = await neonClient(url)
    const result = await Promise.race([
      client.getSession(),
      new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { status: 0 })), timeoutMs)),
    ])
    if (result?.error) {
      const status = result.error.status
      if (status === 401 || status === 403 || status === 404) return null
      throw result.error
    }
    return identityFrom(result?.data)
  } catch (e) {
    throw mapAuthError(e, 'session')
  }
}

/** Jeton JWT à envoyer au serveur (null si pas de session). Ne lève jamais. */
export async function neonToken(url: string): Promise<string | null> {
  try {
    const client = await neonClient(url)
    const result = await client.getSession()
    return result?.data?.session?.token ?? null
  } catch {
    return null
  }
}

export async function neonSignIn(url: string, email: string, password: string): Promise<NeonIdentity> {
  let result: any
  try {
    const client = await neonClient(url)
    result = await client.signIn.email({ email, password })
  } catch (e) {
    throw mapAuthError(e, 'signin')
  }
  if (result?.error) throw mapAuthError(result.error, 'signin')
  const identity = await neonGetSession(url)
  if (!identity) throw new AuthFlowError('Connexion impossible : aucune session n’a été ouverte. Réessayez.', 'no_session')
  return identity
}

export async function neonSignUp(url: string, input: { name: string; email: string; password: string }): Promise<NeonIdentity> {
  let result: any
  try {
    const client = await neonClient(url)
    result = await client.signUp.email({ email: input.email, password: input.password, name: input.name })
  } catch (e) {
    throw mapAuthError(e, 'signup')
  }
  if (result?.error) throw mapAuthError(result.error, 'signup')
  const identity = await neonGetSession(url).catch(() => null)
  if (!identity) {
    throw new AuthFlowError('Compte créé. Si une vérification d’e-mail est demandée, ouvrez le lien reçu puis connectez-vous.', 'verify_email')
  }
  return identity
}

export async function neonSignOut(url: string): Promise<void> {
  try {
    const client = await neonClient(url)
    await client.signOut()
  } catch {
    /* la session locale est de toute façon supprimée */
  }
}
