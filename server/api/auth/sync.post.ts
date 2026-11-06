/**
 * Après inscription ou connexion Neon Auth : crée ou retrouve la ligne `users`.
 * Le rôle demandé doit appartenir à SELF_SIGNUP_ROLES ; collecteur et distributeur restent « en attente de validation ».
 */
import { z } from 'zod'
import { SELF_SIGNUP_ROLES } from '../../../shared/utils/roles'
import { uid } from '../../../shared/utils/db-core'
import type { Company, Supplier, User } from '../../../shared/types/domain'
import { routeContext, parseBody } from '../../utils/context'
import { rateLimit, toHttp } from '../../utils/http'

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  role: z.enum(['client', 'pro', 'collector', 'distributor']).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    rateLimit(event, 'auth-sync', 20)
    const body = await parseBody(event, schema)
    const { store, actor } = await routeContext(event)
    const id = actor.identity
    if (!id) throw createError({ statusCode: 401, statusMessage: 'Connexion requise : reconnectez-vous puis réessayez.' })
    const email = (id.email ?? body.email ?? '').toLowerCase()
    if (!email) throw createError({ statusCode: 422, statusMessage: 'Votre compte ne fournit pas d’adresse e-mail.' })

    const users = (await store.loadCollection('users')) as User[]
    const found = users.find((u) => u.neonUserId === id.sub) ?? users.find((u) => u.email.toLowerCase() === email)
    if (found) {
      if (!found.neonUserId) await store.upsert('users', found.id, { ...found, neonUserId: id.sub, lastLoginAt: new Date().toISOString() })
      return { user: { ...found, neonUserId: found.neonUserId ?? id.sub } }
    }

    const role = body.role && (SELF_SIGNUP_ROLES as readonly string[]).includes(body.role) ? body.role : 'client'
    const name = body.name ?? id.name ?? email.split('@')[0]!
    const now = new Date().toISOString()
    const user: User = {
      id: uid('usr'), email, name, role, active: true, neonUserId: id.sub, createdAt: now,
      pendingApproval: role === 'collector' || role === 'distributor' ? true : undefined,
    }
    if (role === 'pro' || role === 'distributor') {
      const company: Company = {
        id: uid('co'), name: `Entreprise de ${name}`, kind: role === 'distributor' ? 'distributor' : 'client',
        address: { line: 'À renseigner', city: 'À renseigner' }, billingEmail: email, paymentTermsDays: 0,
        contacts: [{ id: uid('ct'), name, email, userId: user.id, authorized: true }], status: 'prospect', createdAt: now,
      }
      user.companyId = company.id
      user.companyRole = 'owner'
      await store.upsert('companies', company.id, company)
    }
    if (role === 'collector') {
      const supplier: Supplier = {
        id: uid('sup'), name: name, kind: 'collector_individual', contactName: name, phone: '', email,
        address: { line: 'À renseigner', city: 'À renseigner' }, polymers: [], status: 'pending', paymentModel: 'per_kg', userId: user.id, createdAt: now,
      }
      user.supplierId = supplier.id
      await store.upsert('suppliers', supplier.id, supplier)
    }
    await store.upsert('users', user.id, user)
    const aud = uid('aud')
    await store.upsert('auditLog', aud, { id: aud, at: now, userId: user.id, userName: name, role, action: 'create', entity: 'users', entityId: user.id, summary: `Inscription · ${email}` })
    const nid = uid('not')
    if (user.pendingApproval) {
      await store.upsert('notifications', nid, { id: nid, roles: ['admin'], at: now, title: 'Compte à valider', body: `${name} (${role}) attend une validation.`, level: 'info', read: false, href: `/admin/utilisateurs/${user.id}` })
    }
    return { user }
  } catch (e) {
    return toHttp(e)
  }
})
