/**
 * Identification de l'appelant (contrat §8) :
 *  - `Authorization: Bearer <jwt Neon Auth>` : signature vérifiée via le JWKS distant (EdDSA), émetteur/audience,
 *    expiration ; l'utilisateur est retrouvé par `neonUserId` puis par e-mail ;
 *  - `x-demo-user: <userId>` : comptes de démonstration, uniquement si le mode démo est activé ;
 *  - sinon : visiteur.
 * Les fonctions de ce fichier sont pures (le vérificateur de jetons est injecté) pour être testées sans réseau.
 */
import type { H3Event } from 'h3'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { RoleKey, User } from '../../shared/types/domain'

export interface Actor {
  id?: string
  name: string
  role: RoleKey
  companyId?: string
  supplierId?: string
  companyRole?: User['companyRole']
  user?: User
  /** Identité vérifiée mais sans ligne `users` correspondante (première connexion) */
  identity?: { sub: string; email?: string; name?: string }
  mode: 'demo' | 'neon' | 'visitor'
}

export interface VerifiedToken {
  sub: string
  email?: string
  name?: string
}
export type TokenVerifier = (token: string) => Promise<VerifiedToken>

export const VISITOR: Actor = { name: 'Visiteur', role: 'visitor', mode: 'visitor' }

const originOf = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/** Vérificateur de jetons Neon Auth (JWKS distant mis en cache par jose). */
export function makeJwksVerifier(opts: { jwksUrl: string; baseUrl?: string; issuer?: string; audience?: string; keys?: Parameters<typeof jwtVerify>[1] }): TokenVerifier {
  const origin = originOf(opts.baseUrl ?? '')
  const issuer = opts.issuer ?? (origin || undefined)
  const audience = opts.audience ?? (origin || undefined)
  const keys = opts.keys ?? createRemoteJWKSet(new URL(opts.jwksUrl), { timeoutDuration: 5000, cooldownDuration: 30000 })
  return async (token) => {
    const { payload } = await jwtVerify(token, keys as any, { issuer, audience, algorithms: ['EdDSA'], clockTolerance: 5 })
    return payloadToIdentity(payload)
  }
}

export function payloadToIdentity(p: JWTPayload): VerifiedToken {
  const sub = String(p.sub ?? p.id ?? '')
  if (!sub) throw new Error('jeton sans identifiant')
  return { sub, email: typeof p.email === 'string' ? p.email.toLowerCase() : undefined, name: typeof p.name === 'string' ? p.name : undefined }
}

export interface ResolveInput {
  authorization?: string | null
  demoUser?: string | null
  demoMode: boolean
  verify?: TokenVerifier
  findUsers: () => Promise<User[]>
}

function actorFromUser(u: User, mode: Actor['mode']): Actor {
  return { id: u.id, name: u.name, role: u.role, companyId: u.companyId, supplierId: u.supplierId, companyRole: u.companyRole, user: u, mode }
}

export async function resolveActorFrom(input: ResolveInput): Promise<Actor> {
  const bearer = /^Bearer\s+(.+)$/i.exec(input.authorization ?? '')?.[1]
  if (bearer && input.verify) {
    try {
      const id = await input.verify(bearer)
      const users = await input.findUsers()
      const u = users.find((x) => x.neonUserId && x.neonUserId === id.sub) ?? (id.email ? users.find((x) => x.email.toLowerCase() === id.email) : undefined)
      if (u && u.active !== false && !u.pendingApproval) return { ...actorFromUser(u, 'neon'), identity: id }
      // identité valide sans profil actif : visiteur, mais l'identité reste disponible pour /api/auth/sync
      return { ...VISITOR, identity: id, user: u, mode: 'neon', name: id.name ?? id.email ?? 'Visiteur' }
    } catch {
      return VISITOR
    }
  }
  if (input.demoMode && input.demoUser) {
    const users = await input.findUsers()
    const u = users.find((x) => x.id === input.demoUser && x.demo === true && x.active !== false)
    if (u) return actorFromUser(u, 'demo')
  }
  return VISITOR
}

let verifier: { key: string; fn: TokenVerifier } | null = null

export function nitroVerifier(event: H3Event): TokenVerifier | undefined {
  const cfg = useRuntimeConfig(event) as any
  const jwksUrl = String(cfg.neonAuthJwksUrl || '')
  if (!jwksUrl) return undefined
  const key = `${jwksUrl}|${cfg.neonAuthBaseUrl}`
  if (!verifier || verifier.key !== key) verifier = { key, fn: makeJwksVerifier({ jwksUrl, baseUrl: String(cfg.neonAuthBaseUrl || '') }) }
  return verifier.fn
}

export async function resolveActor(event: H3Event, findUsers: () => Promise<User[]>): Promise<Actor> {
  const cfg = useRuntimeConfig(event) as any
  return resolveActorFrom({
    authorization: getHeader(event, 'authorization'),
    demoUser: getHeader(event, 'x-demo-user'),
    demoMode: cfg.public?.demoMode !== false && cfg.public?.demoMode !== 'false',
    verify: nitroVerifier(event),
    findUsers,
  })
}
