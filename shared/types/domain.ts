/**
 * EcoBloc — modèle de données du domaine.
 * Toutes les données de démonstration sont FICTIVES (voir shared/seed).
 * Ce fichier est partagé entre l'application et le serveur Nitro.
 */

export type Id = string
export type ISODate = string // ISO 8601
export type Currency = 'XOF'

// ---------------------------------------------------------------- Rôles
export type RoleKey =
  | 'visitor' // A
  | 'client' // B — client particulier
  | 'pro' // C — client professionnel
  | 'collector' // D — collecteur / fournisseur de déchets
  | 'driver' // E — agent de collecte / chauffeur
  | 'procurement' // F — approvisionnement & stock
  | 'production' // G — responsable de production
  | 'quality' // H — technicien qualité
  | 'sales' // I — responsable commercial
  | 'logistics' // J — logistique & livraison
  | 'distributor' // K — distributeur / revendeur
  | 'admin' // L — administrateur général
  | 'environment' // M — environnement & audit

// ---------------------------------------------------------------- Utilisateurs & entreprises
export interface User {
  id: Id
  email: string
  name: string
  role: RoleKey
  phone?: string
  companyId?: Id // client pro, distributeur
  supplierId?: Id // collecteur
  carrierId?: Id // chauffeur
  /** Responsabilité dans l'équipe d'une entreprise cliente */
  companyRole?: 'owner' | 'buyer' | 'accountant' | 'viewer'
  active: boolean
  /** Compte en attente de validation par l'administration */
  pendingApproval?: boolean
  neonUserId?: string
  extraPermissions?: string[]
  address?: Address
  createdAt: ISODate
  lastLoginAt?: ISODate
  /** Marque les comptes de démonstration */
  demo?: boolean
}

export interface Address {
  line: string
  city: string
  zone?: string // zone de livraison (id de DeliveryZone)
  country?: string
  lat?: number
  lng?: number
  instructions?: string
}

export interface CompanyContact {
  id: Id
  name: string
  email: string
  phone?: string
  function?: string
  userId?: Id
  authorized: boolean // autorisé à commander / demander des devis
}

export interface Company {
  id: Id
  name: string
  kind: 'client' | 'distributor'
  taxId?: string
  address: Address
  billingEmail: string
  paymentTermsDays: number
  priceGridId?: Id
  creditLimit?: number
  contacts: CompanyContact[]
  status: 'prospect' | 'active' | 'suspended'
  /** Distributeur : portefeuille de clients finaux (si la fonctionnalité est activée) */
  portfolio?: PortfolioClient[]
  createdAt: ISODate
  demo?: boolean
}

export interface PortfolioClient {
  id: Id
  name: string
  city: string
  contact?: string
  notes?: string
  lastOrderAt?: ISODate
}

// ---------------------------------------------------------------- Catalogue
export type ValidationStatus =
  | 'development' // en développement
  | 'testing' // en cours de test
  | 'results' // résultats de tests disponibles
  | 'authorized' // autorisé à la commercialisation selon le processus défini

export type SaleUnit = 'piece' | 'm2' | 'ml' | 'pallet'

export interface MediaRef {
  /** Identifiant public Cloudinary (si l'image a été envoyée) */
  publicId?: string
  /** URL directe (prioritaire sur publicId s'il est absent) */
  url?: string
  alt: string
}

export interface Category {
  id: Id
  name: string
  slug: string
  description: string
  order: number
  published: boolean
}

export interface Product {
  id: Id
  ref: string // ex. PAV-A12
  slug: string
  name: string
  categoryId: Id
  description: string
  photos: MediaRef[]
  /** Teinte de base pour le visuel procédural lorsqu'il n'y a pas de photo */
  tone: string
  pattern: 'paver' | 'slab' | 'kerb' | 'tile' | 'plank' | 'block'
  dimensions: { lengthMm: number; widthMm: number; heightMm: number }
  unitWeightKg?: number
  saleUnit: SaleUnit
  unitsPerPallet?: number
  m2PerUnit?: number
  finishes: string[]
  colors: { name: string; hex: string }[]
  /** Prix indicatif en FCFA par unité de vente ; null = « sur devis » */
  priceIndicative: number | null
  minOrderQty: number
  minStockUnits: number
  deliveryZones: Id[]
  leadTimeLabel: string // toujours « à confirmer » tant que non validé
  documentIds: Id[]
  validation: ValidationStatus
  allowedUses: string[]
  restrictions: string[]
  /** Instructions de pose : uniquement si validées */
  installNotes?: string
  installNotesValidated: boolean
  /** Les commandes de ce produit n'utilisent que des lots libérés par la qualité */
  requiresReleasedLot: boolean
  published: boolean
  featured?: boolean
  ownerUserId?: Id
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

export interface PriceGrid {
  id: Id
  name: string
  audience: 'public' | 'pro' | 'distributor'
  defaultDiscountPct: number
  tiers: { productId: Id; minQty: number; unitPrice: number }[]
  notes?: string
  active: boolean
}

// ---------------------------------------------------------------- Devis & commandes
export type QuoteStatus =
  | 'requested' // demande envoyée par le client
  | 'in_review' // prise en charge par le commercial
  | 'sent' // devis envoyé au client
  | 'accepted' // accepté (simulation)
  | 'declined'
  | 'expired'
  | 'converted' // converti en commande

export interface QuoteLine {
  id: Id
  productId: Id
  label: string
  qty: number
  unit: SaleUnit
  /** Renseigné par le commercial ; null tant que le produit est « sur devis » */
  unitPrice: number | null
  discountPct?: number
}

export interface HistoryEntry {
  id: Id
  at: ISODate
  userId?: Id
  userName?: string
  action: string
  note?: string
}

export interface Quote {
  id: Id
  ref: string // DV-2026-0001
  requesterUserId?: Id
  companyId?: Id
  contact: { name: string; email: string; phone?: string }
  deliveryAddress: Address
  lines: QuoteLine[]
  customerNotes?: string
  internalNotes?: string
  status: QuoteStatus
  discountPct: number
  deliveryFee: number
  depositPct: number
  currency: Currency
  validUntil?: ISODate
  assignedTo?: Id // commercial
  orderId?: Id
  declineReason?: string
  negotiation: ThreadMessage[]
  history: HistoryEntry[]
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

export interface ThreadMessage {
  id: Id
  userId?: Id
  userName: string
  at: ISODate
  body: string
}

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'in_preparation'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'disputed'

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'disputed'

export interface OrderLine {
  id: Id
  productId: Id
  label: string
  qty: number
  unit: SaleUnit
  unitPrice: number
  discountPct?: number
  /** Lots de produits finis réservés pour cette ligne */
  allocations: { lotId: Id; qty: number }[]
}

export interface Order {
  id: Id
  ref: string // CMD-2026-0001
  quoteId?: Id
  userId: Id
  companyId?: Id
  lines: OrderLine[]
  deliveryAddress: Address
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  discountTotal: number
  deliveryFee: number
  total: number
  depositPct: number
  depositAmount: number
  amountPaid: number
  currency: Currency
  requiresReleasedLot: boolean
  /** Vrai tant que des lots libérés suffisants n'ont pas été réservés */
  awaitingStock?: boolean
  deliveryId?: Id
  purchaseOrderRef?: string
  resellerOrder?: boolean
  timeline: HistoryEntry[]
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

export type PaymentMethod = 'mobile_money' | 'bank_transfer' | 'cash' | 'card'

export interface Payment {
  id: Id
  /** Référence SIMULÉE (préfixe SIM-) : jamais un identifiant de transaction réel */
  ref: string
  orderId: Id
  invoiceId?: Id
  userId: Id
  amount: number
  kind: 'deposit' | 'balance' | 'full' | 'refund'
  method: PaymentMethod
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  simulated: true
  note?: string
  createdAt: ISODate
  paidAt?: ISODate
}

export interface Invoice {
  id: Id
  ref: string // FAC-SIM-2026-0001
  orderId: Id
  userId: Id
  companyId?: Id
  amount: number
  purchaseOrderRef?: string
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
  issuedAt?: ISODate
  dueAt?: ISODate
  paidAt?: ISODate
  simulated: true
  createdAt: ISODate
}

// ---------------------------------------------------------------- Collecte & approvisionnement
export type PolymerCode = 'PET' | 'HDPE' | 'LDPE' | 'PP' | 'PS' | 'PVC' | 'OTHER'

export interface Supplier {
  id: Id
  name: string
  kind: 'collector_individual' | 'collector_org' | 'cooperative' | 'supplier'
  contactName: string
  phone: string
  email?: string
  address: Address
  polymers: PolymerCode[]
  status: 'pending' | 'approved' | 'suspended'
  paymentModel: 'per_kg' | 'none'
  userId?: Id
  notes?: string
  createdAt: ISODate
  demo?: boolean
}

export interface Carrier {
  id: Id
  name: string
  contactName?: string
  phone: string
  vehicle: string
  plate?: string
  zones: Id[]
  flatFee?: number
  perKmFee?: number
  status: 'active' | 'inactive'
  demo?: boolean
}

export type CollectionStatus =
  | 'submitted'
  | 'under_review'
  | 'planned'
  | 'en_route'
  | 'collected'
  | 'weighed'
  | 'received'
  | 'problem'
  | 'cancelled'
  | 'rejected'

export interface CollectionRequest {
  id: Id
  ref: string // COL-2026-0001
  supplierId: Id
  polymers: { code: PolymerCode; estimatedKg: number }[]
  estimatedTotalKg: number
  pickupPoint: Address & { label: string }
  photos: MediaRef[]
  preferredSlots: string[]
  proposedSlots: string[]
  scheduledAt?: ISODate
  tourId?: Id
  driverUserId?: Id
  status: CollectionStatus
  problemReason?: string
  cancelReason?: string
  proof?: { note: string; photo?: MediaRef; at: ISODate }
  recordedKg?: number // quantité enregistrée par le chauffeur
  receiptId?: Id
  notes?: string
  history: HistoryEntry[]
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

export interface Tour {
  id: Id
  ref: string // TRN-2026-0001
  date: ISODate
  driverUserId: Id
  carrierId?: Id
  vehicle: string
  collectionIds: Id[]
  status: 'planned' | 'in_progress' | 'done' | 'cancelled'
  startedAt?: ISODate
  endedAt?: ISODate
  distanceKm?: number
  notes?: string
  demo?: boolean
}

export interface ReceiptLine {
  polymer: PolymerCode
  weighedKg: number
  acceptedKg: number
  rejectedKg: number
  quarantineKg: number
  contaminationPct?: number
  decision: 'accepted' | 'rejected' | 'quarantine' | 'partial'
  reason?: string
}

export interface Receipt {
  id: Id
  ref: string // RCP-2026-0001
  collectionId?: Id
  supplierId: Id
  receivedAt: ISODate
  receivedBy: Id
  declaredKg: number
  weighedKg: number
  lines: ReceiptLine[]
  status: 'weighed' | 'controlled' | 'closed'
  /** Rémunération simulée du collecteur (si le modèle d'achat est actif) */
  payout?: { amount: number; status: 'pending' | 'paid_simulated'; ref?: string; paidAt?: ISODate }
  notes?: string
  demo?: boolean
}

export interface RawLot {
  id: Id
  ref: string // MP-2026-0001
  receiptId: Id
  supplierId: Id
  polymer: PolymerCode
  kgInitial: number
  kgAvailable: number
  kgReserved: number
  kgConsumed: number
  locationId: Id
  status: 'available' | 'quarantine' | 'rejected' | 'depleted'
  receivedAt: ISODate
  notes?: string
  demo?: boolean
}

export interface StockLocation {
  id: Id
  code: string
  name: string
  kind: 'raw' | 'finished' | 'quarantine'
  capacity?: number
  unit: 'kg' | 'unit'
}

export interface StockMovement {
  id: Id
  at: ISODate
  type: 'in' | 'out' | 'transfer' | 'adjustment' | 'loss' | 'reservation' | 'release'
  itemKind: 'raw' | 'finished'
  itemId: Id // RawLot.id ou ProductionLot.id
  qty: number
  unit: 'kg' | 'unit'
  fromLocationId?: Id
  toLocationId?: Id
  refType?: 'receipt' | 'work_order' | 'order' | 'inventory' | 'manual'
  refId?: Id
  userId: Id
  note?: string
}

// ---------------------------------------------------------------- Production
export interface Operator {
  id: Id
  name: string
  station: string
  shift: 'matin' | 'après-midi' | 'nuit'
  active: boolean
}

export type WorkOrderStatus =
  | 'draft'
  | 'planned'
  | 'materials_reserved'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'

export interface WorkOrder {
  id: Id
  ref: string // OF-2026-0001
  productId: Id
  plannedQty: number
  producedQty: number
  scrapQty: number
  status: WorkOrderStatus
  plannedStart: ISODate
  plannedEnd: ISODate
  actualStart?: ISODate
  actualEnd?: ISODate
  materialKgPlanned: number
  materialKgConsumed: number
  reservations: { rawLotId: Id; kg: number }[]
  operatorIds: Id[]
  supervisorId?: Id
  /** Donnée technique INTERNE : n'est pas une instruction de fabrication certifiée */
  internalRecipeNote?: string
  lotId?: Id
  history: HistoryEntry[]
  createdAt: ISODate
  demo?: boolean
}

export interface ProductionEvent {
  id: Id
  workOrderId: Id
  type: 'anomaly' | 'stop' | 'note'
  severity: 'low' | 'medium' | 'high'
  startedAt: ISODate
  durationMin?: number
  description: string
  resolved: boolean
  userId?: Id
}

export type LotQcStatus = 'pending_qc' | 'in_qc' | 'released' | 'rejected' | 'quarantine'

/** Lot de produits finis */
export interface ProductionLot {
  id: Id
  ref: string // LOT-2026-0001
  workOrderId: Id
  productId: Id
  producedQty: number
  scrapQty: number
  availableQty: number
  reservedQty: number
  shippedQty: number
  producedAt: ISODate
  locationId?: Id
  /** Traçabilité amont : matières premières consommées */
  rawInputs: { rawLotId: Id; kg: number }[]
  qcStatus: LotQcStatus
  releasedAt?: ISODate
  releasedBy?: Id
  inspectionIds: Id[]
  demo?: boolean
}

// ---------------------------------------------------------------- Qualité
export interface QcCriterion {
  kind: 'min' | 'max' | 'range' | 'pass_fail'
  min?: number
  max?: number
}

export interface QcTemplate {
  id: Id
  productId?: Id // vide = s'applique à tous les produits
  code: string
  name: string
  method: string // description de la méthode (interne, non normative)
  unit: string
  criterion: QcCriterion
  required: boolean
  order: number
  /** Les seuils de la maquette sont des valeurs de démonstration, pas des exigences normatives */
  demoValues: true
}

export interface QcResult {
  templateId: Id
  value?: number
  passed?: boolean
  measuredAt: ISODate
  note?: string
}

export interface QcInspection {
  id: Id
  ref: string // QC-2026-0001
  lotId: Id
  requestedAt: ISODate
  requestedBy?: Id
  assignedTo?: Id
  status: 'pending' | 'in_progress' | 'completed'
  results: QcResult[]
  decision?: 'accepted' | 'rejected' | 'quarantine'
  decisionReason?: string
  decidedBy?: Id
  decidedAt?: ISODate
  reportDocumentId?: Id
  history: HistoryEntry[]
  demo?: boolean
}

export interface TechDocument {
  id: Id
  ref: string // DOC-0001
  title: string
  kind: 'datasheet' | 'test_report' | 'install_guide' | 'safety' | 'commercial' | 'proof' | 'other'
  productId?: Id
  lotId?: Id
  status: 'draft' | 'internal' | 'published' | 'archived'
  visibility: 'public' | 'customers' | 'internal'
  version: string
  mime: string
  sizeKb?: number
  file?: MediaRef
  /** Tout document de la maquette est clairement non officiel */
  demoNotice: string
  uploadedBy?: Id
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

// ---------------------------------------------------------------- Livraison
export interface Incident {
  id: Id
  at: ISODate
  type: 'delay' | 'damage' | 'absent' | 'address' | 'vehicle' | 'other'
  description: string
  resolved: boolean
  userId?: Id
}

export interface Delivery {
  id: Id
  ref: string // LIV-2026-0001
  orderId: Id
  carrierId?: Id
  driverName?: string
  status: 'to_prepare' | 'preparing' | 'planned' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
  plannedDate?: ISODate
  shippedAt?: ISODate
  deliveredAt?: ISODate
  address: Address
  fee: number
  lotIds: Id[]
  tourRef?: string
  proof?: { receivedBy: string; note?: string; photo?: MediaRef; at: ISODate }
  incidents: Incident[]
  history: HistoryEntry[]
  demo?: boolean
}

export interface Claim {
  id: Id
  ref: string // SUP-2026-0001
  userId: Id
  companyId?: Id
  orderId?: Id
  deliveryId?: Id
  collectionId?: Id
  kind: 'quality' | 'delivery' | 'billing' | 'collection' | 'payment' | 'other'
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_review' | 'resolved' | 'rejected'
  thread: ThreadMessage[]
  assignedTo?: Id
  createdAt: ISODate
  updatedAt: ISODate
  demo?: boolean
}

// ---------------------------------------------------------------- Environnement
export interface EnvRecord {
  id: Id
  period: string // AAAA-MM
  polymer: PolymerCode
  receivedKg: number
  acceptedKg: number
  rejectedKg: number
  usedInProductionKg: number
  finishedUnits: number
  finishedKg: number
  lossKg: number
  validated: boolean
  validatedBy?: Id
  notes?: string
  demo: true
}

export interface EnvIndicator {
  id: Id
  key: string
  label: string
  value: number
  unit: string
  periodFrom: string
  periodTo: string
  /** Comment l'indicateur est calculé : obligatoire pour publier */
  methodology: string
  evidenceDocumentIds: Id[]
  status: 'draft' | 'validated' | 'published'
  approvedBy?: Id
  approvedAt?: ISODate
  demo: true
}

// ---------------------------------------------------------------- Commercial
export interface Prospect {
  id: Id
  name: string
  company?: string
  email?: string
  phone?: string
  source: 'site' | 'referral' | 'event' | 'outbound' | 'distributor_request'
  /** Sujet de la demande reçue via le site public */
  interest?: 'contact' | 'quote' | 'collector' | 'distributor' | 'supplier' | 'pro_services'
  status: 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
  ownerId?: Id
  estimatedValue?: number
  notes?: string
  nextFollowUpAt?: ISODate
  createdAt: ISODate
  demo?: boolean
}

export interface Interaction {
  id: Id
  kind: 'call' | 'email' | 'meeting' | 'note' | 'reminder'
  subjectType: 'prospect' | 'company' | 'quote' | 'user'
  subjectId: Id
  userId?: Id
  at: ISODate
  summary: string
  dueAt?: ISODate
  done?: boolean
}

// ---------------------------------------------------------------- Contenu public
export interface FaqItem {
  id: Id
  category: string
  question: string
  answer: string
  order: number
  published: boolean
}

export interface CaseStudy {
  id: Id
  title: string
  sector: string
  summary: string
  challenge: string
  approach: string
  outcome: string
  published: boolean
  /** Toujours vrai : toutes les études de cas de la maquette sont fictives */
  fictional: true
}

export interface ContentBlock {
  id: Id
  key: string // ex. 'home.hero', 'about.story', 'legal.terms'
  title: string
  body: string
  published: boolean
  updatedAt: ISODate
}

// ---------------------------------------------------------------- Système
export interface AuditEntry {
  id: Id
  at: ISODate
  userId?: Id
  userName: string
  role?: RoleKey
  action: 'create' | 'update' | 'delete' | 'status' | 'login' | 'logout' | 'export' | 'permission' | 'reset'
  entity: string
  entityId?: Id
  summary: string
  before?: unknown
  after?: unknown
}

export interface Notification {
  id: Id
  userId?: Id // vide = diffusée à tous les rôles ciblés
  roles?: RoleKey[]
  at: ISODate
  title: string
  body?: string
  level: 'info' | 'success' | 'warning' | 'danger'
  read: boolean
  href?: string
}

export interface Favorite {
  id: Id
  userId: Id
  productId: Id
  createdAt: ISODate
}

export interface DeliveryZone {
  id: Id
  name: string
  baseFee: number
  perKmFee?: number
  etaDays: string // « à confirmer »
  active: boolean
}

export interface PolymerRule {
  code: PolymerCode
  accepted: boolean
  pricePerKg: number // FCFA/kg, rémunération du collecteur (simulée)
  criteria: string
  maxContaminationPct: number
}

export interface AppSettings {
  id: 'company'
  brand: { name: string; tagline: string; logoUrl?: string; logoPublicId?: string; monogram: string }
  company: {
    legalName: string
    address: string
    city: string
    country: string
    phone: string
    email: string
    website?: string
    taxId?: string
  }
  currency: Currency
  vatRatePct: number
  defaultDepositPct: number
  quoteValidityDays: number
  zones: DeliveryZone[]
  polymers: PolymerRule[]
  rawThresholdsKg: Partial<Record<PolymerCode, number>>
  features: {
    collectorPayouts: boolean
    distributorPortfolio: boolean
    proPriceGrid: boolean
    publicImpactPage: boolean
  }
  demoBanner: string
}

// ---------------------------------------------------------------- Collections
export interface CollectionMap {
  users: User
  companies: Company
  categories: Category
  products: Product
  priceGrids: PriceGrid
  quotes: Quote
  orders: Order
  payments: Payment
  invoices: Invoice
  suppliers: Supplier
  carriers: Carrier
  collections: CollectionRequest
  tours: Tour
  receipts: Receipt
  rawLots: RawLot
  stockLocations: StockLocation
  stockMovements: StockMovement
  operators: Operator
  workOrders: WorkOrder
  productionEvents: ProductionEvent
  productionLots: ProductionLot
  qcTemplates: QcTemplate
  qcInspections: QcInspection
  documents: TechDocument
  deliveries: Delivery
  claims: Claim
  envRecords: EnvRecord
  envIndicators: EnvIndicator
  prospects: Prospect
  interactions: Interaction
  faqs: FaqItem
  caseStudies: CaseStudy
  contentBlocks: ContentBlock
  favorites: Favorite
  notifications: Notification
  auditLog: AuditEntry
  settings: AppSettings
}

export type CollectionName = keyof CollectionMap
export type Row<C extends CollectionName> = CollectionMap[C]
