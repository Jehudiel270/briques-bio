/**
 * Service catalogue : changement du statut de validation d'un produit.
 * `authorized` (autorisé à la commercialisation) exige au moins un document PUBLIÉ de type rapport d'essai
 * ou fiche technique rattaché au produit. Chaque changement est journalisé (audit + notification).
 */
import type { Product, ValidationStatus } from '../types/domain'
import type { Db } from '../utils/db-core'
import { statusMeta } from '../utils/labels'
import { fail } from './errors'
import { guard, need, notifyRoles } from './helpers'

const VALIDATIONS: ValidationStatus[] = ['development', 'testing', 'results', 'authorized']
/** Même formulation que les données de démonstration */
export const VALIDATION_RESTRICTION = 'Validation en cours : données techniques et certifications à confirmer avant commercialisation.'

export function setValidation(db: Db, productId: string, status: ValidationStatus, note?: string): Product {
  guard(db, 'catalog.setValidation')
  const product = need(db.peek('products', productId), 'Le produit')
  if (!VALIDATIONS.includes(status)) fail('Statut de validation inconnu : choisissez développement, test, résultats ou autorisé.')
  if (product.validation === status) fail(`« ${product.name} » a déjà le statut « ${statusMeta('validation', status).label} ».`)

  if (status === 'authorized') {
    const proofs = db.raw('documents').filter((d) =>
      (d.productId === product.id || product.documentIds.includes(d.id)) && d.status === 'published' && (d.kind === 'test_report' || d.kind === 'datasheet'))
    if (!proofs.length) {
      fail(`« ${product.name} » ne peut pas être autorisé à la commercialisation : publiez d’abord au moins un rapport d’essai ou une fiche technique pour ce produit.`, 'proof_missing')
    }
  }

  const previous = product.validation
  const authorized = status === 'authorized'
  const restrictions = authorized
    ? product.restrictions.filter((r) => r !== VALIDATION_RESTRICTION)
    : product.restrictions.includes(VALIDATION_RESTRICTION) ? product.restrictions : [...product.restrictions, VALIDATION_RESTRICTION]
  const summary = `Validation · ${product.ref} : ${statusMeta('validation', product.validation).label} → ${statusMeta('validation', status).label}${note?.trim() ? ` — ${note.trim()}` : ''}`
  db.update('products', product.id, {
    validation: status, restrictions, leadTimeLabel: authorized ? product.leadTimeLabel : 'À confirmer',
    installNotesValidated: authorized ? product.installNotesValidated : false,
  }, { via: 'catalog.setValidation', summary })
  notifyRoles(db, ['sales', 'production'], {
    title: authorized ? 'Produit autorisé à la commercialisation' : 'Statut de validation modifié',
    body: `${product.name} : ${statusMeta('validation', status).label}${note?.trim() ? ` — ${note.trim()}` : ''}.`,
    level: authorized ? 'success' : previous === 'authorized' ? 'warning' : 'info', href: `/admin/produits/${product.id}`,
  })
  return db.peek('products', product.id)!
}

export const catalog = { setValidation }
