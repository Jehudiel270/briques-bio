/**
 * Contrôle d'accès serveur — réutilise exactement les règles de `shared/utils/permissions.ts`
 * (les mêmes que celles appliquées dans le navigateur).
 *
 * Limite assumée du prototype : les services métier s'exécutent dans le navigateur et déclarent leur nom
 * via `x-service` ; le serveur vérifie que le rôle de l'appelant a le droit d'exécuter ce service
 * (`serviceAllowed`), mais ne rejoue pas la logique métier. En production, les services migreraient côté
 * serveur (voir docs/BACKEND.md).
 */
import type { CollectionName } from '../../shared/types/domain'
import { COLLECTION_NAMES } from '../../shared/utils/db-core'
import { allowedFields, canCreate, canRead, canRemove, canUpdate, filterRows, rowWritable, serviceAllowed } from '../../shared/utils/permissions'
import type { Actor } from './session'
import type { RawState } from './sql'

export class HttpError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

const VALID = new Set<string>(COLLECTION_NAMES)
export const isCollection = (c: string): c is CollectionName => VALID.has(c)

/** Collections que le serveur n'accepte jamais en écriture directe (même pour un service). */
const NEVER_VIA_SERVICE = new Set<CollectionName>(['users', 'settings'])
/** Collections « techniques » ouvertes en ajout à tout appelant : journal d'audit et notifications (écrits par le noyau). */
const APPEND_OPEN = new Set<CollectionName>(['auditLog', 'notifications'])

const userLike = (a: Actor) => ({ id: a.id, role: a.role, companyId: a.companyId, supplierId: a.supplierId, companyRole: a.companyRole, extraPermissions: a.user?.extraPermissions })

/** État filtré pour l'appelant : collections lisibles, lignes visibles. */
export function filterStateFor(state: RawState, actor: Actor): RawState {
  const ctx = { all: <T = any>(c: CollectionName) => (state[c] ?? []) as T[] }
  const out: RawState = {}
  for (const c of COLLECTION_NAMES) {
    out[c] = canRead(actor.role, c) ? filterRows(userLike(actor), c, state[c] ?? [], ctx) : []
  }
  return out
}

export interface WriteRequest {
  collection: string
  id: string
  op: 'put' | 'delete'
  body?: any
  via?: string | null
  actor: Actor
  /** Ligne existante (null si création) */
  existing: any | null
  /** Lectures nécessaires aux jointures de propriété */
  all: <T = any>(c: CollectionName) => T[]
}

/**
 * Valide une écriture ; renvoie la ligne à enregistrer (éventuellement nettoyée) ou lève HttpError.
 */
export function authorizeWrite(req: WriteRequest): { row?: any; created: boolean } {
  const { collection: c, id, op, actor, existing, via } = req
  if (!isCollection(c)) throw new HttpError(404, `Collection inconnue : « ${c} ».`)
  const role = actor.role
  const ctx = { all: req.all }
  const created = !existing
  if (op === 'put') {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(422, 'Le corps de la requête doit être un objet JSON.')
    if (String(body.id) !== id) throw new HttpError(422, 'L’identifiant de la ligne doit être identique à celui de l’adresse.')
  }

  // Ajout libre (journal, notifications) : jamais de modification ni de suppression par ce biais
  if (APPEND_OPEN.has(c)) {
    if (op === 'delete') {
      if (c === 'notifications' && existing && canRemove(role, c)) return { created: false }
      throw new HttpError(403, 'Cette collection est en ajout seul.')
    }
    if (created) {
      const row = { ...req.body }
      if (c === 'auditLog') {
        row.userId = actor.id
        row.userName = actor.name
        row.role = actor.role
      }
      return { row, created }
    }
    if (c === 'notifications') {
      const keys = Object.keys(req.body).filter((k) => JSON.stringify(req.body[k]) !== JSON.stringify(existing[k]))
      if (keys.some((k) => k !== 'read')) throw new HttpError(403, 'Seul l’état « lu » d’une notification est modifiable.')
      return { row: { ...existing, read: !!req.body.read }, created }
    }
    throw new HttpError(403, 'Le journal d’audit est en ajout seul.')
  }

  if (via) {
    if (!serviceAllowed(via, role)) throw new HttpError(403, `Le rôle « ${role} » ne peut pas exécuter l’action « ${via} ».`)
    if (NEVER_VIA_SERVICE.has(c)) throw new HttpError(403, `La collection « ${c} » ne peut pas être modifiée par une action métier.`)
    return { row: op === 'put' ? req.body : undefined, created }
  }

  if (op === 'delete') {
    if (!existing) return { created: false }
    if (!canRemove(role, c)) throw new HttpError(403, `Suppression non autorisée sur « ${c} » pour ce rôle.`)
    return { created: false }
  }

  if (created) {
    if (!canCreate(role, c)) throw new HttpError(403, `Création non autorisée sur « ${c} » pour ce rôle.`)
    // un lot de produits finis naît toujours « à contrôler » : seule la qualité (ou l'administration) le libère
    if (c === 'productionLots' && role !== 'admin' && req.body.qcStatus !== 'pending_qc') throw new HttpError(403, 'Un lot nouvellement produit doit être soumis au contrôle qualité.')
    return { row: req.body, created }
  }

  if (!canUpdate(role, c)) throw new HttpError(403, `Modification non autorisée sur « ${c} » pour ce rôle.`)
  if (!rowWritable(userLike(actor), c, existing, ctx)) throw new HttpError(403, 'Vous ne pouvez modifier que vos propres données.')
  const fields = allowedFields(role, c)
  if (fields) {
    const changed = new Set<string>()
    for (const k of new Set([...Object.keys(existing), ...Object.keys(req.body)])) {
      if (JSON.stringify(existing[k]) !== JSON.stringify(req.body[k])) changed.add(k)
    }
    const forbidden = [...changed].filter((k) => !fields.includes(k))
    if (forbidden.length) throw new HttpError(403, `Champs non modifiables pour ce rôle : ${forbidden.join(', ')}.`)
  }
  return { row: req.body, created }
}
