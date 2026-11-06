/**
 * Couche de permissions EcoBloc — partagée entre l'interface et le serveur Nitro.
 *
 * Trois niveaux :
 *  1. Capacités (`can`) : grands droits métier utilisés pour afficher/masquer des actions.
 *  2. Collections (`canRead/canCreate/canUpdate/canRemove`) + limitation de champs.
 *  3. Lignes (`rowVisible`) : un client ne voit que ses commandes, un collecteur que ses collectes…
 *
 * Les effets de bord inter-rôles d'un workflow (ex. un client accepte un devis → une
 * commande est créée, le stock est réservé) s'exécutent via des SERVICES nommés
 * (`SERVICE_ROLES`). Un service ne peut être invoqué que par les rôles listés ; ses
 * écritures « système » sont alors autorisées. Côté serveur, le même contrôle s'applique.
 */
import type { CollectionName, Id, RoleKey, User } from '../types/domain'
import { CLIENT_ROLES, STAFF_ROLES } from './roles'

// ------------------------------------------------------------------ Capacités
export type Permission =
  | 'catalog.manage'
  | 'pricing.manage'
  | 'quotes.request'
  | 'quotes.manage'
  | 'orders.place'
  | 'orders.manage'
  | 'payments.record'
  | 'finance.view'
  | 'claims.create'
  | 'claims.manage'
  | 'collections.request'
  | 'collections.plan'
  | 'collections.execute'
  | 'receipts.manage'
  | 'stock.manage'
  | 'production.manage'
  | 'quality.inspect'
  | 'quality.release'
  | 'docs.manage'
  | 'delivery.manage'
  | 'env.view'
  | 'env.manage'
  | 'env.publish'
  | 'users.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'theme.manage'
  | 'crm.manage'
  | 'company.team.manage'
  | 'portfolio.manage'
  | 'export.data'

const ALL = '*' as const

export const PERMISSIONS: Record<RoleKey, readonly (Permission | typeof ALL)[]> = {
  visitor: ['quotes.request'],
  client: ['quotes.request', 'orders.place', 'claims.create', 'payments.record'],
  pro: ['quotes.request', 'orders.place', 'claims.create', 'payments.record', 'company.team.manage'],
  distributor: ['quotes.request', 'orders.place', 'claims.create', 'payments.record', 'company.team.manage', 'portfolio.manage'],
  collector: ['collections.request', 'claims.create'],
  driver: ['collections.execute'],
  procurement: ['collections.plan', 'receipts.manage', 'stock.manage', 'claims.manage', 'export.data'],
  production: ['production.manage', 'stock.manage', 'env.view', 'export.data'],
  quality: ['quality.inspect', 'quality.release', 'docs.manage', 'env.view'],
  sales: ['quotes.manage', 'orders.manage', 'pricing.manage', 'payments.record', 'finance.view', 'claims.manage', 'crm.manage', 'export.data'],
  logistics: ['delivery.manage', 'orders.manage', 'claims.manage', 'export.data'],
  environment: ['env.view', 'env.manage', 'env.publish', 'audit.view', 'export.data'],
  admin: [ALL],
}

type UserLike = Pick<User, 'role'> & Partial<Pick<User, 'id' | 'companyId' | 'supplierId' | 'extraPermissions' | 'companyRole'>>

export function can(user: UserLike | null | undefined, perm: Permission): boolean {
  const role: RoleKey = user?.role ?? 'visitor'
  const granted = PERMISSIONS[role] ?? []
  if (granted.includes(ALL)) return true
  if (granted.includes(perm)) return true
  return !!user?.extraPermissions?.includes(perm)
}

export const isStaff = (role?: RoleKey) => !!role && STAFF_ROLES.includes(role)
export const isClientRole = (role?: RoleKey) => !!role && CLIENT_ROLES.includes(role)

// ------------------------------------------------------------------ Accès aux collections
interface Access {
  read: RoleKey[] | 'public'
  create: RoleKey[]
  update: RoleKey[]
  remove: RoleKey[]
  /** Champs modifiables par rôle (si absent : tous les champs) */
  fields?: Partial<Record<RoleKey, string[]>>
}

const CLIENTS = CLIENT_ROLES
const AUTH: RoleKey[] = ['client', 'pro', 'distributor', 'collector', 'driver', 'procurement', 'production', 'quality', 'sales', 'logistics', 'environment', 'admin']

export const ACCESS: Record<CollectionName, Access> = {
  users: {
    read: AUTH,
    create: ['admin'],
    update: [...AUTH],
    remove: ['admin'],
    fields: {
      client: ['name', 'phone', 'address', 'lastLoginAt'],
      pro: ['name', 'phone', 'address', 'lastLoginAt', 'companyRole', 'active'],
      distributor: ['name', 'phone', 'address', 'lastLoginAt', 'companyRole', 'active'],
      collector: ['name', 'phone', 'address', 'lastLoginAt'],
      driver: ['name', 'phone', 'lastLoginAt'],
      procurement: ['name', 'phone', 'lastLoginAt'],
      production: ['name', 'phone', 'lastLoginAt'],
      quality: ['name', 'phone', 'lastLoginAt'],
      sales: ['name', 'phone', 'lastLoginAt'],
      logistics: ['name', 'phone', 'lastLoginAt'],
      environment: ['name', 'phone', 'lastLoginAt'],
    },
  },
  companies: {
    read: ['client', 'pro', 'distributor', 'sales', 'logistics', 'admin', 'production'],
    create: ['sales', 'admin'],
    update: ['sales', 'admin', 'pro', 'distributor'],
    remove: ['admin'],
    fields: { pro: ['name', 'address', 'billingEmail', 'taxId', 'contacts'], distributor: ['name', 'address', 'billingEmail', 'taxId', 'contacts', 'portfolio'] },
  },
  categories: { read: 'public', create: ['admin'], update: ['admin'], remove: ['admin'] },
  products: { read: 'public', create: ['admin'], update: ['admin'], remove: ['admin'] },
  priceGrids: { read: ['sales', 'admin', 'pro', 'distributor'], create: ['sales', 'admin'], update: ['sales', 'admin'], remove: ['admin'] },
  quotes: {
    read: [...CLIENTS, 'sales', 'admin'],
    create: ['visitor', ...CLIENTS, 'sales', 'admin'],
    update: ['sales', 'admin'],
    remove: ['admin'],
  },
  orders: {
    read: [...CLIENTS, 'sales', 'logistics', 'production', 'admin'],
    create: ['sales', 'admin'],
    update: ['sales', 'logistics', 'admin'],
    remove: ['admin'],
  },
  payments: { read: [...CLIENTS, 'sales', 'admin'], create: ['sales', 'admin'], update: ['sales', 'admin'], remove: ['admin'] },
  invoices: { read: [...CLIENTS, 'sales', 'admin'], create: ['sales', 'admin'], update: ['sales', 'admin'], remove: ['admin'] },
  suppliers: {
    read: ['collector', 'procurement', 'quality', 'environment', 'logistics', 'admin', 'driver'],
    create: ['procurement', 'admin'],
    update: ['procurement', 'admin', 'collector'],
    remove: ['admin'],
    fields: { collector: ['name', 'contactName', 'phone', 'email', 'address', 'polymers', 'notes'] },
  },
  carriers: { read: ['logistics', 'procurement', 'admin', 'driver'], create: ['logistics', 'admin'], update: ['logistics', 'admin'], remove: ['admin'] },
  collections: {
    read: ['collector', 'driver', 'procurement', 'logistics', 'environment', 'admin'],
    create: ['collector', 'procurement', 'admin'],
    update: ['procurement', 'admin', 'driver', 'collector'],
    remove: ['admin'],
    fields: {
      driver: ['status', 'proof', 'recordedKg', 'problemReason', 'history', 'updatedAt'],
      collector: ['status', 'cancelReason', 'history', 'updatedAt', 'preferredSlots', 'notes'],
    },
  },
  tours: {
    read: ['driver', 'procurement', 'logistics', 'admin'],
    create: ['procurement', 'logistics', 'admin'],
    update: ['procurement', 'logistics', 'admin', 'driver'],
    remove: ['admin'],
    fields: { driver: ['status', 'startedAt', 'endedAt', 'distanceKm', 'notes'] },
  },
  receipts: {
    read: ['collector', 'procurement', 'quality', 'environment', 'production', 'admin'],
    create: ['procurement', 'admin'],
    update: ['procurement', 'admin'],
    remove: ['admin'],
  },
  rawLots: {
    read: ['procurement', 'production', 'quality', 'environment', 'admin'],
    create: ['procurement', 'admin'],
    update: ['procurement', 'production', 'admin'],
    remove: ['admin'],
    fields: { production: ['kgAvailable', 'kgReserved', 'kgConsumed', 'status'] },
  },
  stockLocations: { read: ['procurement', 'production', 'logistics', 'quality', 'admin'], create: ['procurement', 'admin'], update: ['procurement', 'admin'], remove: ['admin'] },
  stockMovements: { read: ['procurement', 'production', 'logistics', 'quality', 'environment', 'admin'], create: ['procurement', 'production', 'logistics', 'admin'], update: ['admin'], remove: ['admin'] },
  operators: { read: ['production', 'admin'], create: ['production', 'admin'], update: ['production', 'admin'], remove: ['production', 'admin'] },
  workOrders: { read: ['production', 'quality', 'procurement', 'environment', 'sales', 'admin'], create: ['production', 'admin'], update: ['production', 'admin'], remove: ['admin'] },
  productionEvents: { read: ['production', 'quality', 'environment', 'admin'], create: ['production', 'quality', 'admin'], update: ['production', 'admin'], remove: ['admin'] },
  productionLots: {
    read: [...CLIENTS, 'production', 'quality', 'sales', 'logistics', 'environment', 'procurement', 'admin'],
    create: ['production', 'admin'],
    update: ['production', 'quality', 'sales', 'logistics', 'admin'],
    remove: ['admin'],
    fields: {
      // la production ne peut jamais libérer un lot : qcStatus / releasedAt / releasedBy lui sont interdits
      production: ['producedQty', 'scrapQty', 'availableQty', 'reservedQty', 'shippedQty', 'producedAt', 'locationId', 'rawInputs', 'inspectionIds'],
      quality: ['qcStatus', 'releasedAt', 'releasedBy', 'inspectionIds'],
      sales: ['availableQty', 'reservedQty', 'shippedQty'],
      logistics: ['availableQty', 'reservedQty', 'shippedQty'],
    },
  },
  qcTemplates: { read: ['quality', 'production', 'admin'], create: ['quality', 'admin'], update: ['quality', 'admin'], remove: ['quality', 'admin'] },
  qcInspections: { read: ['quality', 'production', 'environment', 'admin'], create: ['quality', 'production', 'admin'], update: ['quality', 'admin'], remove: ['admin'] },
  documents: { read: 'public', create: ['quality', 'admin'], update: ['quality', 'admin'], remove: ['admin'] },
  deliveries: { read: [...CLIENTS, 'logistics', 'sales', 'admin'], create: ['logistics', 'sales', 'admin'], update: ['logistics', 'admin'], remove: ['admin'] },
  claims: {
    read: [...CLIENTS, 'collector', 'sales', 'procurement', 'logistics', 'admin'],
    create: [...CLIENTS, 'collector', 'sales', 'admin'],
    update: ['sales', 'procurement', 'logistics', 'admin', ...CLIENTS, 'collector'],
    remove: ['admin'],
    fields: Object.fromEntries([...CLIENTS, 'collector'].map((r) => [r, ['thread', 'updatedAt']])) as Partial<Record<RoleKey, string[]>>,
  },
  envRecords: { read: ['environment', 'procurement', 'production', 'quality', 'admin'], create: ['environment', 'admin'], update: ['environment', 'admin'], remove: ['admin'] },
  envIndicators: { read: 'public', create: ['environment', 'admin'], update: ['environment', 'admin'], remove: ['admin'] },
  prospects: { read: ['sales', 'admin'], create: ['visitor', ...AUTH], update: ['sales', 'admin'], remove: ['sales', 'admin'] },
  interactions: { read: ['sales', 'admin'], create: ['sales', 'admin'], update: ['sales', 'admin'], remove: ['sales', 'admin'] },
  faqs: { read: 'public', create: ['admin'], update: ['admin'], remove: ['admin'] },
  caseStudies: { read: 'public', create: ['admin'], update: ['admin'], remove: ['admin'] },
  contentBlocks: { read: 'public', create: ['admin'], update: ['admin'], remove: ['admin'] },
  favorites: { read: AUTH, create: [...CLIENTS], update: [...CLIENTS], remove: [...CLIENTS] },
  notifications: { read: AUTH, create: AUTH, update: AUTH, remove: AUTH, fields: Object.fromEntries(AUTH.filter((r) => r !== 'admin').map((r) => [r, ['read']])) as Partial<Record<RoleKey, string[]>> },
  auditLog: { read: ['admin', 'environment'], create: [], update: [], remove: [] }, // alimenté uniquement par le noyau
  settings: { read: 'public', create: ['admin'], update: ['admin'], remove: [] },
}

const roleOf = (r?: RoleKey): RoleKey => r ?? 'visitor'

export function canRead(role: RoleKey | undefined, c: CollectionName): boolean {
  const a = ACCESS[c].read
  return a === 'public' || a.includes(roleOf(role))
}
export const canCreate = (role: RoleKey | undefined, c: CollectionName) => ACCESS[c].create.includes(roleOf(role))
export const canUpdate = (role: RoleKey | undefined, c: CollectionName) => ACCESS[c].update.includes(roleOf(role))
export const canRemove = (role: RoleKey | undefined, c: CollectionName) => ACCESS[c].remove.includes(roleOf(role))

/** Champs qu'un rôle a le droit de modifier ; `null` = tous */
export function allowedFields(role: RoleKey | undefined, c: CollectionName): string[] | null {
  return ACCESS[c].fields?.[roleOf(role)] ?? null
}

// ------------------------------------------------------------------ Services (effets de bord inter-rôles)
export const SERVICE_ROLES: Record<string, RoleKey[]> = {
  'quotes.request': ['visitor', ...CLIENTS, 'sales', 'admin'],
  'quotes.take': ['sales', 'admin'],
  'quotes.send': ['sales', 'admin'],
  'quotes.negotiate': [...CLIENTS, 'sales', 'admin'],
  'quotes.accept': [...CLIENTS, 'sales', 'admin'],
  'quotes.decline': [...CLIENTS, 'sales', 'admin'],
  'orders.create': [...CLIENTS, 'sales', 'admin'],
  'orders.pay': [...CLIENTS, 'sales', 'admin'],
  'orders.refund': ['sales', 'admin'],
  'orders.cancel': [...CLIENTS, 'sales', 'admin'],
  'orders.sendToPreparation': ['sales', 'admin'],
  'orders.allocate': ['sales', 'logistics', 'admin'],
  'deliveries.plan': ['sales', 'logistics', 'admin'],
  'deliveries.ship': ['logistics', 'admin'],
  'deliveries.deliver': ['logistics', 'admin'],
  'deliveries.incident': ['logistics', 'admin'],
  'deliveries.resolveIncident': ['logistics', 'admin'],
  'collections.request': ['collector', 'procurement', 'admin'],
  'collections.review': ['procurement', 'admin'],
  'collections.plan': ['procurement', 'admin'],
  'collections.cancel': ['collector', 'procurement', 'admin'],
  'collections.driverUpdate': ['driver', 'procurement', 'admin'],
  'receipts.confirm': ['procurement', 'admin'],
  'receipts.pay': ['procurement', 'admin'],
  'inventory.adjust': ['procurement', 'production', 'admin'],
  'inventory.transfer': ['procurement', 'production', 'logistics', 'admin'],
  'production.createOrder': ['production', 'admin'],
  'production.reserve': ['production', 'admin'],
  'production.start': ['production', 'admin'],
  'production.pause': ['production', 'admin'],
  'production.resume': ['production', 'admin'],
  'production.logEvent': ['production', 'quality', 'admin'],
  'production.record': ['production', 'admin'],
  'production.complete': ['production', 'admin'],
  'production.cancel': ['production', 'admin'],
  'quality.request': ['production', 'quality', 'admin'],
  'quality.record': ['quality', 'admin'],
  'quality.decide': ['quality', 'admin'],
  'quality.attachReport': ['quality', 'admin'],
  'env.aggregate': ['environment', 'admin'],
  'env.validate': ['environment', 'admin'],
  'env.createIndicator': ['environment', 'admin'],
  'env.publish': ['environment', 'admin'],
  'env.unpublish': ['environment', 'admin'],
  'catalog.setValidation': ['quality', 'admin'],
}

export const serviceAllowed = (via: string, role: RoleKey | undefined) => !!SERVICE_ROLES[via]?.includes(roleOf(role))

// ------------------------------------------------------------------ Visibilité des lignes
export interface RowCtx {
  /** Accès en lecture à une collection complète (pour les jointures de propriété) */
  all: <T = any>(c: CollectionName) => T[]
}

const mine = (u: UserLike, row: any): boolean =>
  (!!u.id && (row.userId === u.id || row.requesterUserId === u.id)) || (!!u.companyId && row.companyId === u.companyId)

export function rowVisible(user: UserLike | null | undefined, c: CollectionName, row: any, ctx?: RowCtx): boolean {
  const role = roleOf(user?.role)
  if (!canRead(role, c)) return false
  if (role === 'admin') return true

  switch (c) {
    // ---- contenu public : seuls les éléments publiés pour les non-éditeurs
    case 'products':
    case 'categories':
    case 'faqs':
    case 'caseStudies':
    case 'contentBlocks':
      return row.published !== false
    case 'documents':
      if (role === 'quality') return true
      if (row.status !== 'published') return false
      return row.visibility === 'public' || (row.visibility === 'customers' && role !== 'visitor')
    case 'envIndicators':
      return role === 'environment' || row.status === 'published'
    case 'settings':
      return true

    // ---- données du compte
    case 'users':
      if (isStaff(role)) return true
      if (row.id === user?.id) return true
      return !!user?.companyId && row.companyId === user.companyId && user.companyRole === 'owner'
    case 'companies':
      if (isStaff(role)) return true
      return !!user?.companyId && row.id === user.companyId
    case 'priceGrids':
      if (role === 'sales') return true
      if (isClientRole(role)) {
        const company = ctx?.all<any>('companies').find((x) => x.id === user?.companyId)
        return !!company && company.priceGridId === row.id
      }
      return false

    // ---- données commerciales : propriétaire ou équipe interne
    case 'quotes':
    case 'orders':
    case 'payments':
    case 'invoices':
    case 'claims':
      if (isClientRole(role) || role === 'collector') return !!user && mine(user, row)
      return true
    case 'deliveries': {
      if (!isClientRole(role)) return true
      const order = ctx?.all<any>('orders').find((o) => o.id === row.orderId)
      return !!order && !!user && mine(user, order)
    }
    case 'productionLots': {
      if (!isClientRole(role)) return true
      // un client ne voit que les lots livrés ou affectés à ses commandes
      const orders = (ctx?.all<any>('orders') ?? []).filter((o) => user && mine(user, o))
      return orders.some((o) => o.lines.some((l: any) => l.allocations?.some((a: any) => a.lotId === row.id)))
    }
    case 'favorites':
      return row.userId === user?.id
    case 'notifications':
      return row.userId === user?.id || (!row.userId && (!row.roles || row.roles.includes(role)))

    // ---- terrain
    case 'suppliers':
      return role === 'collector' ? row.id === user?.supplierId : true
    case 'collections':
      if (role === 'collector') return row.supplierId === user?.supplierId
      if (role === 'driver') return row.driverUserId === user?.id
      return true
    case 'tours':
      return role === 'driver' ? row.driverUserId === user?.id : true
    case 'receipts':
      return role === 'collector' ? row.supplierId === user?.supplierId : true
    case 'carriers':
      return true

    default:
      return true
  }
}

/** Filtre un tableau de lignes selon l'utilisateur */
export function filterRows<T>(user: UserLike | null | undefined, c: CollectionName, rows: T[], ctx?: RowCtx): T[] {
  return rows.filter((r) => rowVisible(user, c, r, ctx))
}

/** Le propriétaire (ou l'équipe interne) peut-il modifier cette ligne ? */
export function rowWritable(user: UserLike | null | undefined, c: CollectionName, row: any, ctx?: RowCtx): boolean {
  const role = roleOf(user?.role)
  if (!canUpdate(role, c)) return false
  if (role === 'admin') return true
  // Les rôles « client/terrain » ne modifient que leurs propres lignes
  if (isClientRole(role) || role === 'collector' || role === 'driver') return rowVisible(user, c, row, ctx)
  return true
}

// ------------------------------------------------------------------ Navigation par rôle (accès aux zones)
export const ZONE_ROLES: { prefix: string; roles: RoleKey[] }[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/ops/appro', roles: ['procurement', 'admin'] },
  { prefix: '/ops/production', roles: ['production', 'admin'] },
  { prefix: '/ops/qualite', roles: ['quality', 'admin'] },
  { prefix: '/ops/commercial', roles: ['sales', 'admin'] },
  { prefix: '/ops/logistique', roles: ['logistics', 'admin'] },
  { prefix: '/ops/environnement', roles: ['environment', 'admin'] },
  { prefix: '/espace', roles: ['client', 'pro', 'distributor'] },
  { prefix: '/collecte', roles: ['collector'] },
  { prefix: '/terrain', roles: ['driver'] },
]

/** Un rôle a-t-il le droit d'ouvrir cette route ? Les routes publiques sont toujours autorisées. */
export function canAccessRoute(role: RoleKey | undefined, path: string): boolean {
  const zone = ZONE_ROLES.find((z) => path === z.prefix || path.startsWith(z.prefix + '/'))
  if (!zone) return true
  return zone.roles.includes(roleOf(role))
}

export const needsLogin = (path: string) => ZONE_ROLES.some((z) => path === z.prefix || path.startsWith(z.prefix + '/'))

