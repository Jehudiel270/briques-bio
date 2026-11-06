/**
 * Authentification et session.
 *  - Mode démonstration (`runtimeConfig.public.demoMode`) : comptes `<rôle>@ecobloc.demo` / `demo1234`,
 *    changement de rôle à la volée.
 *  - Mode réel : Neon Auth (`@neondatabase/auth`) ; après connexion ou inscription, `POST /api/auth/sync`
 *    rattache le compte à une ligne `users`. Si Neon Auth est injoignable, un message clair est renvoyé
 *    et le mode démonstration reste utilisable.
 * Session persistée dans localStorage (`ecobloc:session`).
 */
import { computed, effectScope, ref, type ComputedRef, type Ref } from 'vue'
import { DEMO_ACCOUNTS } from '#shared/seed'
import type { RoleKey, User } from '#shared/types/domain'
import { uid } from '#shared/utils/db-core'
import { can as canDo, canAccessRoute, needsLogin, type Permission } from '#shared/utils/permissions'
import { SELF_SIGNUP_ROLES, homeFor, roleLabel } from '#shared/utils/roles'
import {
  DEMO_PASSWORD,
  authConfig,
  configureAuth,
  readStoredSession,
  resolveUser,
  sessionFromUser,
  sessionRef,
  writeStoredSession,
  type StoredSession,
} from '~/utils/auth-session'
import { AuthFlowError, neonGetSession, neonSignIn, neonSignOut, neonSignUp, type NeonIdentity } from '~/utils/neon-auth'
import { needsApproval } from '~/utils/role-ui'
import { toastSafe } from '~/utils/toast-safe'

export interface SignUpInput {
  name: string
  email: string
  password: string
  role: RoleKey
}

export interface SignUpResult {
  user: User | null
  /** Compte créé mais en attente de validation par l'administration (collecteur, distributeur) */
  pending: boolean
  /** Inscription simulée dans ce navigateur (aucun service d'authentification configuré) */
  simulated: boolean
}

export interface AuthApi {
  user: ComputedRef<User | null>
  role: ComputedRef<RoleKey>
  isLoggedIn: ComputedRef<boolean>
  loading: Ref<boolean>
  can: (perm: Permission) => boolean
  loginDemo: (userId: string) => Promise<User>
  switchDemoRole: (role: RoleKey) => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<User>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  logout: (opts?: { redirect?: boolean }) => Promise<void>
  demoAccounts: ComputedRef<User[]>
  demoMode: boolean
  /** Nature de la session courante */
  mode: ComputedRef<'demo' | 'neon' | null>
  /** Vrai si Neon Auth est configuré (connexion et inscription réelles) */
  realAuth: boolean
  /** Relit la session mémorisée (appelé au démarrage) */
  restore: () => Promise<void>
}

let authApi: AuthApi | null = null

export function useAuth(): AuthApi {
  if (authApi) return authApi

  const db = useDb()
  const router = useRouter()
  const config = useRuntimeConfig()
  const pub = config.public as Record<string, unknown>
  const baseUrl = String(config.app?.baseURL ?? '/').replace(/\/+$/, '')
  configureAuth({ neonAuthUrl: String(pub.neonAuthUrl ?? ''), demoMode: !(pub.demoMode === false || pub.demoMode === 'false') })

  const loading = ref(false)
  const scope = effectScope(true)
  const derived = scope.run(() => {
    const user = computed(() => resolveUser(sessionRef.value, db.state.users))
    const role = computed<RoleKey>(() => user.value?.role ?? 'visitor')
    const isLoggedIn = computed(() => !!user.value)
    const mode = computed(() => sessionRef.value?.mode ?? null)
    const demoAccounts = computed<User[]>(() =>
      DEMO_ACCOUNTS.map(
        (a) =>
          db.state.users.find((u) => u.id === a.userId) ??
          ({ id: a.userId, name: a.label, email: a.email, role: a.role, active: true, createdAt: '', demo: true } satisfies User),
      ),
    )
    return { user, role, isLoggedIn, mode, demoAccounts }
  })!
  const { user, role, isLoggedIn, mode, demoAccounts } = derived

  const neonUrl = () => authConfig.neonAuthUrl

  // ------------------------------------------------------------------ Ouverture / fermeture de session
  async function startSession(s: StoredSession): Promise<User> {
    await db.flush() // écritures en attente : elles partent avec l'ancienne identité
    sessionRef.value = s
    writeStoredSession(s)
    if (db.mode.value === 'neon') await db.reload()
    try {
      db.sys.update('users', s.userId, { lastLoginAt: db.now() }, { silent: true })
    } catch { /* ligne absente (profil non visible) : sans conséquence */ }
    db.audit({ action: 'login', entity: 'session', entityId: s.userId, summary: `Connexion : ${s.name} (${roleLabel(s.role)})` })
    return user.value ?? resolveUser(s, [])!
  }

  async function loginDemo(userId: string): Promise<User> {
    if (!authConfig.demoMode) throw new AuthFlowError('Le mode démonstration est désactivé : connectez-vous avec votre compte.', 'demo_disabled')
    loading.value = true
    try {
      const row = db.state.users.find((u) => u.id === userId)
      const acct = DEMO_ACCOUNTS.find((a) => a.userId === userId)
      if (!row && !acct) throw new AuthFlowError('Compte de démonstration introuvable : choisissez-en un dans la liste.', 'not_found')
      if (row?.pendingApproval) throw new AuthFlowError('Ce compte est en attente de validation par l’administration.', 'pending')
      if (row && row.active === false) throw new AuthFlowError('Ce compte est désactivé : demandez sa réactivation à l’administration.', 'inactive')
      const s: StoredSession = row
        ? sessionFromUser(row, 'demo')
        : { mode: 'demo', userId, email: acct!.email, name: acct!.label, role: acct!.role, savedAt: new Date().toISOString() }
      return await startSession(s)
    } finally {
      loading.value = false
    }
  }

  async function logout(opts: { redirect?: boolean } = {}) {
    const s = sessionRef.value
    if (!s) return
    loading.value = true
    try {
      db.audit({ action: 'logout', entity: 'session', entityId: s.userId, summary: `Déconnexion : ${s.name}` })
      await db.flush()
      if (s.mode === 'neon' && neonUrl()) await neonSignOut(neonUrl())
      sessionRef.value = null
      writeStoredSession(null)
      if (db.mode.value === 'neon') await db.reload()
      if (opts.redirect !== false) await router.push('/')
    } finally {
      loading.value = false
    }
  }

  /** Change de rôle de démonstration ; hors vitrine, ouvre l'accueil du nouveau rôle. */
  async function switchDemoRole(next: RoleKey) {
    if (!authConfig.demoMode) throw new AuthFlowError('Le changement de rôle n’existe qu’en mode démonstration.', 'demo_disabled')
    const path = router.currentRoute.value.path
    if (next === 'visitor') {
      await logout({ redirect: false })
      if (needsLogin(path) || path.startsWith('/ops')) await router.push('/')
      toastSafe('info', 'Vous naviguez maintenant comme visiteur (démo).', 'Rôle de démonstration')
      return
    }
    const acct = DEMO_ACCOUNTS.find((a) => a.role === next)
    if (!acct) throw new AuthFlowError('Aucun compte de démonstration n’existe pour ce rôle.', 'not_found')
    const u = await loginDemo(acct.userId)
    if (needsLogin(path) || path.startsWith('/ops') || !canAccessRoute(next, path)) await router.push(homeFor(next))
    toastSafe('info', `Vous naviguez comme « ${roleLabel(next)} » (${u.name}).`, 'Rôle de démonstration')
  }

  // ------------------------------------------------------------------ Mode réel (Neon Auth)
  async function readMessage(res: Response): Promise<string> {
    try {
      const body = await res.json()
      return String(body?.statusMessage ?? body?.message ?? '')
    } catch {
      return ''
    }
  }

  /** `POST /api/auth/sync` : crée ou retrouve la ligne `users` du compte Neon. */
  async function syncProfile(identity: NeonIdentity, extra: { role?: RoleKey; name?: string }): Promise<User> {
    if (!identity.token) throw new AuthFlowError('La session d’authentification est incomplète : reconnectez-vous.', 'no_token')
    const headers = { 'content-type': 'application/json', Authorization: `Bearer ${identity.token}` }
    let res: Response
    try {
      res = await fetch(`${baseUrl}/api/auth/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: extra.name ?? identity.name, email: identity.email, role: extra.role }),
      })
    } catch {
      throw new AuthFlowError('Le serveur EcoBloc ne répond pas : réessayez dans un instant.', 'unreachable')
    }
    if (!res.ok) throw new AuthFlowError((await readMessage(res)) || 'Votre profil EcoBloc n’a pas pu être créé : réessayez dans un instant.', 'sync_failed')
    const data: any = await res.json().catch(() => null)
    const direct = data?.user ?? (data?.id ? data : null)
    if (direct?.id) return direct as User
    const me: any = await fetch(`${baseUrl}/api/auth/me`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (me?.user?.id) return me.user as User
    throw new AuthFlowError('Votre profil EcoBloc est introuvable après la connexion : réessayez dans un instant.', 'sync_failed')
  }

  async function finishNeonLogin(profile: User): Promise<User> {
    if (profile.pendingApproval) {
      await neonSignOut(neonUrl())
      throw new AuthFlowError('Votre compte est en attente de validation par l’administration. Vous serez prévenu dès son activation.', 'pending')
    }
    if (profile.active === false) {
      await neonSignOut(neonUrl())
      throw new AuthFlowError('Ce compte est désactivé : demandez sa réactivation à l’administration.', 'inactive')
    }
    return startSession(sessionFromUser(profile, 'neon'))
  }

  function withDemoHint(e: unknown): never {
    if (e instanceof AuthFlowError && e.code === 'unreachable' && authConfig.demoMode) {
      throw new AuthFlowError(`${e.message} Le mode démonstration reste disponible : choisissez un compte de démonstration.`, 'unreachable')
    }
    throw e
  }

  async function loginWithPassword(email: string, password: string): Promise<User> {
    const mail = email.trim().toLowerCase()
    if (authConfig.demoMode && password === DEMO_PASSWORD) {
      const acct = DEMO_ACCOUNTS.find((a) => a.email === mail)
      const row = db.state.users.find((u) => u.demo && u.email.toLowerCase() === mail)
      if (acct || row) return loginDemo(acct?.userId ?? row!.id)
    }
    if (!neonUrl()) {
      if (authConfig.demoMode) {
        if (/@ecobloc\.demo$/i.test(mail)) throw new AuthFlowError(`Mot de passe incorrect : les comptes de démonstration utilisent « ${DEMO_PASSWORD} ».`, 'invalid_credentials')
        throw new AuthFlowError(`Aucun compte ne correspond à ces identifiants. Utilisez un compte de démonstration (mot de passe « ${DEMO_PASSWORD} ») ou créez un compte.`, 'invalid_credentials')
      }
      throw new AuthFlowError('L’authentification n’est pas configurée sur cet environnement : contactez l’administrateur.', 'not_configured')
    }
    loading.value = true
    try {
      const identity = await neonSignIn(neonUrl(), mail, password).catch(withDemoHint)
      const profile = await syncProfile(identity, {})
      return await finishNeonLogin(profile)
    } finally {
      loading.value = false
    }
  }

  // ------------------------------------------------------------------ Inscription
  /** Inscription simulée : le compte n'existe que dans ce navigateur (aucun service d'authentification configuré). */
  async function simulateSignUp(input: SignUpInput): Promise<SignUpResult> {
    const mail = input.email.trim().toLowerCase()
    const name = input.name.trim()
    if (db.state.users.some((u) => u.email.toLowerCase() === mail)) {
      throw new AuthFlowError('Un compte existe déjà avec cet e-mail. Connectez-vous ou utilisez une autre adresse.', 'exists')
    }
    const pending = needsApproval(input.role)
    const now = db.now()
    const userId = uid('usr')
    const sys = db.sys
    let companyId: string | undefined
    let supplierId: string | undefined
    if (input.role === 'pro' || input.role === 'distributor') {
      companyId = uid('co')
      sys.create('companies', {
        id: companyId,
        name: `Entreprise de ${name} (démo)`,
        kind: input.role === 'distributor' ? 'distributor' : 'client',
        address: { line: 'Adresse à renseigner', city: 'Cotonou', country: 'Bénin' },
        billingEmail: mail,
        paymentTermsDays: 0,
        contacts: [{ id: uid('ctc'), name, email: mail, function: 'Gérant', userId, authorized: true }],
        status: 'prospect',
        createdAt: now,
        demo: true,
      }, { silent: true })
    }
    if (input.role === 'collector') {
      supplierId = uid('sup')
      sys.create('suppliers', {
        id: supplierId,
        name: `${name} (démo)`,
        kind: 'collector_individual',
        contactName: name,
        phone: '',
        address: { line: 'Point de collecte à renseigner', city: 'Cotonou', country: 'Bénin' },
        polymers: ['PET', 'HDPE', 'PP'],
        status: 'pending',
        paymentModel: 'per_kg',
        userId,
        createdAt: now,
        demo: true,
      }, { silent: true })
    }
    const row = sys.create('users', {
      id: userId,
      name,
      email: mail,
      role: input.role,
      active: !pending,
      pendingApproval: pending || undefined,
      companyId,
      supplierId,
      companyRole: companyId ? 'owner' : undefined,
      createdAt: now,
      demo: true,
    }, { summary: `Inscription simulée : ${name}` })
    if (pending) {
      sys.notify({ roles: ['admin'], title: 'Inscription à valider', body: `${name} demande un compte « ${roleLabel(input.role)} ».`, level: 'info', href: '/admin/utilisateurs' })
      return { user: row, pending: true, simulated: true }
    }
    await startSession(sessionFromUser(row, 'demo'))
    return { user: row, pending: false, simulated: true }
  }

  async function signUp(input: SignUpInput): Promise<SignUpResult> {
    if (!SELF_SIGNUP_ROLES.includes(input.role)) {
      throw new AuthFlowError('Ce type de compte est créé par l’administration : choisissez client, professionnel, collecteur ou distributeur.', 'invalid_role')
    }
    loading.value = true
    try {
      if (neonUrl()) {
        const identity = await neonSignUp(neonUrl(), { name: input.name.trim(), email: input.email.trim().toLowerCase(), password: input.password }).catch(withDemoHint)
        const profile = await syncProfile(identity, { role: input.role, name: input.name.trim() })
        if (needsApproval(input.role) || profile.pendingApproval) {
          await neonSignOut(neonUrl())
          return { user: profile, pending: true, simulated: false }
        }
        await finishNeonLogin(profile)
        return { user: profile, pending: false, simulated: false }
      }
      if (authConfig.demoMode && db.mode.value === 'local') return await simulateSignUp(input)
      throw new AuthFlowError('L’inscription n’est pas disponible sur cet environnement : contactez l’administrateur.', 'not_configured')
    } finally {
      loading.value = false
    }
  }

  // ------------------------------------------------------------------ Démarrage
  async function restore() {
    const stored = readStoredSession()
    if (!stored) {
      sessionRef.value = null
      return
    }
    if (stored.mode === 'demo') {
      if (!authConfig.demoMode) {
        writeStoredSession(null)
        sessionRef.value = null
        return
      }
      sessionRef.value = stored
      return
    }
    if (!neonUrl()) {
      writeStoredSession(null)
      sessionRef.value = null
      return
    }
    sessionRef.value = stored // optimiste : la session est confirmée ci-dessous
    try {
      const identity = await neonGetSession(neonUrl(), 5000)
      if (!identity) {
        sessionRef.value = null
        writeStoredSession(null)
      }
    } catch {
      /* service injoignable : on garde la session mémorisée, les écritures seront refusées proprement */
    }
  }

  authApi = {
    user,
    role,
    isLoggedIn,
    loading,
    can: (perm) => canDo(user.value, perm),
    loginDemo,
    switchDemoRole,
    loginWithPassword,
    signUp,
    logout,
    demoAccounts,
    demoMode: authConfig.demoMode,
    mode,
    realAuth: !!authConfig.neonAuthUrl,
    restore,
  }
  return authApi
}
