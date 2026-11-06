/**
 * Helpers purs de prix, de disponibilité et de stock (aucune écriture).
 * Tous les montants sont en FCFA, entiers. Les prix sont des valeurs de démonstration.
 */
import type { AppSettings, Id, PolymerCode, PriceGrid, Product } from '../types/domain'
import type { Db } from '../utils/db-core'

/** Produit commandable en ligne : publié ET autorisé à la commercialisation. */
export function isOrderable(product: Pick<Product, 'published' | 'validation'>): boolean {
  return !!product.published && product.validation === 'authorized'
}

/** Produit pouvant faire l'objet d'une demande de devis : publié et hors « en développement ». */
export function canRequestQuote(product: Pick<Product, 'published' | 'validation'>): boolean {
  return !!product.published && product.validation !== 'development'
}

/**
 * Prix unitaire effectif pour l'acheteur (FCFA par unité de vente), `null` = sur devis.
 * Avec une grille active : prix du palier de volume atteint, ou prix indicatif moins la remise
 * de base de la grille — le plus bas des deux. Sans grille : prix indicatif.
 */
export function unitPriceFor(product: Pick<Product, 'id' | 'priceIndicative'>, grid: PriceGrid | null | undefined, qty: number): number | null {
  const base = product.priceIndicative
  if (base == null) return null
  if (!grid || !grid.active) return base
  const discounted = Math.round(base * (1 - (grid.defaultDiscountPct || 0) / 100))
  const tier = grid.tiers
    .filter((t) => t.productId === product.id && qty >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0]
  return tier ? Math.min(tier.unitPrice, discounted) : discounted
}

/** Grille tarifaire applicable à une entreprise (si la fonctionnalité est activée). */
export function priceGridFor(db: Db, companyId?: Id): PriceGrid | undefined {
  const settings = db.raw('settings')[0]
  if (!settings?.features.proPriceGrid || !companyId) return undefined
  const grid = db.peek('priceGrids', db.peek('companies', companyId)?.priceGridId)
  return grid?.active ? grid : undefined
}

export interface TotalsInput {
  lines: { qty: number; unitPrice: number | null; discountPct?: number }[]
  /** Remise globale (en %) appliquée après les remises de ligne */
  discountPct?: number
  deliveryFee?: number
  depositPct?: number
  /** Si fourni : renvoie aussi la part de TVA contenue dans le total (les prix sont réputés TTC) */
  vatRatePct?: number
}

export interface Totals {
  subtotal: number
  discountTotal: number
  deliveryFee: number
  total: number
  depositAmount: number
  /** Présent seulement si `vatRatePct` est fourni : TVA incluse dans `total` (information, non ajoutée) */
  vatIncluded?: number
}

export function computeTotals(input: TotalsInput): Totals {
  const lines = input.lines
  const raw = lines.reduce((a, l) => a + l.qty * (l.unitPrice ?? 0), 0)
  const lineDiscount = lines.reduce((a, l) => a + (l.qty * (l.unitPrice ?? 0) * (l.discountPct ?? 0)) / 100, 0)
  const globalDiscount = ((raw - lineDiscount) * (input.discountPct ?? 0)) / 100
  const subtotal = Math.round(raw)
  const discountTotal = Math.round(lineDiscount + globalDiscount)
  const deliveryFee = Math.round(input.deliveryFee ?? 0)
  const total = subtotal - discountTotal + deliveryFee
  const depositAmount = Math.round(total * ((input.depositPct ?? 0) / 100))
  const out: Totals = { subtotal, discountTotal, deliveryFee, total, depositAmount }
  if (input.vatRatePct != null) out.vatIncluded = Math.round(total - total / (1 + input.vatRatePct / 100))
  return out
}

/** Frais de livraison d'une zone active (0 si la zone est inconnue ou inactive). */
export function deliveryFeeFor(settings: Pick<AppSettings, 'zones'>, zoneId: Id | undefined): number {
  const zone = settings.zones.find((z) => z.id === zoneId && z.active)
  return zone ? zone.baseFee : 0
}

export interface ProductStock {
  /** Pièces physiquement en stock dans des lots libérés (disponibles + réservées) */
  released: number
  /** Pièces réservées pour des commandes (lots libérés) */
  reserved: number
  /** Pièces libérées et non réservées : seules vendables */
  availableToSell: number
  /** Pièces en stock dans des lots en attente de contrôle ou en contrôle (non vendables) */
  pendingQc: number
  /** Pièces physiquement en stock, tous statuts qualité confondus */
  total: number
}

export function productStock(db: Db, productId: Id): ProductStock {
  const out: ProductStock = { released: 0, reserved: 0, availableToSell: 0, pendingQc: 0, total: 0 }
  for (const lot of db.raw('productionLots')) {
    if (lot.productId !== productId) continue
    const physical = lot.availableQty + lot.reservedQty
    out.total += physical
    if (lot.qcStatus === 'released') {
      out.released += physical
      out.reserved += lot.reservedQty
      out.availableToSell += lot.availableQty
    } else if (lot.qcStatus === 'pending_qc' || lot.qcStatus === 'in_qc') {
      out.pendingQc += lot.availableQty
    }
  }
  return out
}

export interface RawStock {
  /** kg disponibles dans des lots `available` */
  available: number
  /** kg réservés par des ordres de fabrication */
  reserved: number
  /** kg en quarantaine (non utilisables) */
  quarantine: number
  /** disponible + réservé + quarantaine */
  total: number
  /** Seuil d'alerte (kg) des paramètres, s'il existe */
  thresholdKg?: number
  /** Disponible strictement sous le seuil */
  belowThreshold: boolean
}

const POLYMERS: PolymerCode[] = ['PET', 'HDPE', 'LDPE', 'PP', 'PS', 'PVC', 'OTHER']

export function rawStockByPolymer(db: Db): Record<PolymerCode, RawStock> {
  const thresholds = db.raw('settings')[0]?.rawThresholdsKg ?? {}
  const out = Object.fromEntries(
    POLYMERS.map((p) => [p, { available: 0, reserved: 0, quarantine: 0, total: 0, thresholdKg: thresholds[p], belowThreshold: false } as RawStock]),
  ) as Record<PolymerCode, RawStock>
  for (const lot of db.raw('rawLots')) {
    const s = out[lot.polymer]
    if (!s) continue
    if (lot.status === 'available') {
      s.available += lot.kgAvailable
      s.reserved += lot.kgReserved
    } else if (lot.status === 'quarantine') {
      s.quarantine += lot.kgAvailable
    }
  }
  for (const p of POLYMERS) {
    const s = out[p]
    s.available = Math.round(s.available * 1000) / 1000
    s.total = Math.round((s.available + s.reserved + s.quarantine) * 1000) / 1000
    s.belowThreshold = s.thresholdKg != null && s.available < s.thresholdKg
  }
  return out
}
