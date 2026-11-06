/**
 * Session côté client (singleton réactif) partagée par useAuth et useDb.
 * Persistée dans localStorage sous `ecobloc:session`. Deux natures de session :
 *  - `demo` : compte de démonstration, identifié auprès du serveur par `x-demo-user` ;
 *  - `neon` : compte réel Neon Auth, identifié par `Authorization: Bearer <jwt>`.
 */
import { shallowRef } from 'vue'
import type { RoleKey, User } from '../../shared/types/domain'
import type { DbActor } from '../../shared/utils/db-core'
import { ROLES } from '../../shared/utils/roles'
import { neonToken } from './neon-auth'
import { lsGet, lsRemove, lsSetJson } from './storage'

export const SESSION_KEY = 'ecobloc:session'
export const DEMO_PASSWORD = 'demo1234'

export interface StoredSession {
  mode: 'demo' | 'neon'
  userId: string
  email: string
  name: string
  role: RoleKey
  companyId?: string
  supplierId?: string
  companyRole?: User['companyRole']
  savedAt: string
}

/** Session courante (null = visiteur) */
export const sessionRef = shallowRef<StoredSession | null>(null)

export interface AuthConfig {
  neonAuthUrl: string
  demoMode: boolean
}
export const authConfig: AuthConfig = { neonAuthUrl: '', demoMode: true }

export function configureAuth(cfg: Partial<AuthConfig>) {
  if (cfg.neonAuthUrl !== undefined) authConfig.neonAuthUrl = cfg.neonAuthUrl.trim().replace(/\/+$/, '')
  if (cfg.demoMode !== undefined) authConfig.demoMode = cfg.demoMode
}

/** Valide un objet lu du stockage ; null s'il est inutilisable. */
export function sanitizeSession(raw: unknown): StoredSession | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if ((r.mode !== 'demo' && r.mode !== 'neon') || typeof r.userId !== 'string' || !r.userId) return null
  if (typeof r.role !== 'string' || !(r.role in ROLES) || r.role === 'visitor') return null
  return {
    mode: r.mode,
    userId: r.userId,
    email: typeof r.email === 'string' ? r.email : '',
    name: typeof r.name === 'string' && r.name ? r.name : 'Utilisateur',
    role: r.role as RoleKey,
    companyId: typeof r.companyId === 'string' ? r.companyId : undefined,
    supplierId: typeof r.supplierId === 'string' ? r.supplierId : undefined,
    companyRole: ['owner', 'buyer', 'accountant', 'viewer'].includes(r.companyRole as string) ? (r.companyRole as User['companyRole']) : undefined,
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
  }
}

export function readStoredSession(): StoredSession | null {
  const raw = lsGet(SESSION_KEY)
  if (!raw) return null
  try {
    return sanitizeSession(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeStoredSession(s: StoredSession | null) {
  if (s) lsSetJson(SESSION_KEY, s)
  else lsRemove(SESSION_KEY)
}

export function sessionFromUser(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'supplierId' | 'companyRole'>, mode: StoredSession['mode']): StoredSession {
  return {
    mode,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    supplierId: user.supplierId,
    companyRole: user.companyRole,
    savedAt: new Date().toISOString(),
  }
}

/** Utilisateur reconstitué depuis la session quand sa ligne n'est pas (encore) dans la base chargée. */
export function userFromSession(s: StoredSession): User {
  return {
    id: s.userId,
    email: s.email,
    name: s.name,
    role: s.role,
    companyId: s.companyId,
    supplierId: s.supplierId,
    companyRole: s.companyRole,
    active: true,
    createdAt: s.savedAt,
    demo: s.mode === 'demo' || undefined,
  }
}

/** Utilisateur courant : la ligne de la base si elle existe, sinon l'instantané de session. */
export function resolveUser(s: StoredSession | null, users: readonly User[]): User | null {
  if (!s) return null
  return users.find((u) => u.id === s.userId) ?? (s.email ? users.find((u) => u.email.toLowerCase() === s.email.toLowerCase()) : undefined) ?? userFromSession(s)
}

/** Acteur transmis au noyau de la base pour les contrôles d'accès. */
export function actorFromSession(s: StoredSession | null, users: readonly User[]): DbActor | null {
  const u = resolveUser(s, users)
  if (!u) return null
  return { id: u.id, name: u.name, role: u.role, companyId: u.companyId, supplierId: u.supplierId, companyRole: u.companyRole }
}

/** En-têtes d'identité de l'API (contrat §8). */
export async function authHeaders(): Promise<Record<string, string>> {
  const s = sessionRef.value
  if (!s) return {}
  if (s.mode === 'demo') return authConfig.demoMode ? { 'x-demo-user': s.userId } : {}
  if (!authConfig.neonAuthUrl) return {}
  const token = await neonToken(authConfig.neonAuthUrl)
  return token ? { Authorization: `Bearer ${token}` } : {}
}
