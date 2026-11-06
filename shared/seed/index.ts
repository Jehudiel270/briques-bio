/**
 * Données de DÉMONSTRATION d'EcoBloc — entièrement fictives et déterministes.
 * Aucune fabrication, vente, entreprise ou certification réelle.
 */
import type {
  Address, AppSettings, Carrier, CaseStudy, Claim, Company, ContentBlock, Delivery, EnvIndicator, EnvRecord, FaqItem, Invoice,
  Notification, Operator, Order, OrderLine, Payment, PolymerCode, Product, ProductionEvent, ProductionLot, Prospect, QcInspection,
  QcResult, QcTemplate, Quote, RawLot, Receipt, RoleKey, StockLocation, StockMovement, Supplier, TechDocument, Tour, User, WorkOrder,
  CollectionRequest, Interaction, HistoryEntry, AuditEntry, Favorite, PriceGrid, Category, ReceiptLine,
} from '../types/domain'
import { emptyState, type DbState } from '../utils/db-core'

export const SEED_VERSION = 1
export const SEED_ANCHOR = '2026-10-26T08:00:00.000Z'
const T0 = Date.parse(SEED_ANCHOR)
/** Date relative à l'ancre : jours (négatif = passé), heure locale UTC */
const d = (days: number, h = 8, m = 0) => new Date(T0 + days * 86400000 + ((h - 8) * 60 + m) * 60000).toISOString()
const DEMO_NOTICE = 'Document de démonstration — non officiel, sans valeur de certificat.'

export const DEMO_ACCOUNTS: { role: RoleKey; userId: string; email: string; label: string }[] = [
  { role: 'client', userId: 'usr_client1', email: 'client@ecobloc.demo', label: 'Client particulier' },
  { role: 'pro', userId: 'usr_pro1', email: 'pro@ecobloc.demo', label: 'Client professionnel' },
  { role: 'distributor', userId: 'usr_distri', email: 'distributeur@ecobloc.demo', label: 'Distributeur' },
  { role: 'collector', userId: 'usr_coll1', email: 'collecteur@ecobloc.demo', label: 'Collecteur' },
  { role: 'driver', userId: 'usr_driver1', email: 'chauffeur@ecobloc.demo', label: 'Chauffeur' },
  { role: 'procurement', userId: 'usr_appro', email: 'appro@ecobloc.demo', label: 'Approvisionnement & stock' },
  { role: 'production', userId: 'usr_prod', email: 'production@ecobloc.demo', label: 'Production' },
  { role: 'quality', userId: 'usr_qual', email: 'qualite@ecobloc.demo', label: 'Qualité' },
  { role: 'sales', userId: 'usr_sales', email: 'commercial@ecobloc.demo', label: 'Commercial' },
  { role: 'logistics', userId: 'usr_logi', email: 'logistique@ecobloc.demo', label: 'Logistique' },
  { role: 'admin', userId: 'usr_admin', email: 'admin@ecobloc.demo', label: 'Administrateur' },
  { role: 'environment', userId: 'usr_env', email: 'environnement@ecobloc.demo', label: 'Environnement & audit' },
]

const addr = (line: string, city: string, zone?: string, lat?: number, lng?: number): Address => ({ line, city, zone, country: 'Bénin', lat, lng })
const he = (at: string, action: string, userName = 'Système', note?: string, userId?: string): HistoryEntry => ({ id: `his_${Math.abs(hash(at + action + (note ?? '')))}`, at, action, userName, note, userId })
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h }

export function buildSeed(): DbState {
  const s = emptyState()

  // ===================================================================== Paramètres
  const settings: AppSettings = {
    id: 'company',
    brand: { name: 'EcoBloc', tagline: 'Matériaux d’aménagement issus de plastiques valorisés', monogram: 'EB' },
    company: { legalName: 'EcoBloc Industries SARL (démo)', address: 'Zone industrielle fictive, lot 00', city: 'Cotonou', country: 'Bénin', phone: '+229 01 00 00 00 01', email: 'contact@ecobloc.demo', website: 'ecobloc.demo', taxId: 'DEMO-000000' },
    currency: 'XOF', vatRatePct: 18, defaultDepositPct: 30, quoteValidityDays: 30,
    zones: [
      { id: 'z_cotonou', name: 'Cotonou', baseFee: 15000, etaDays: 'À confirmer (2 à 4 jours)', active: true },
      { id: 'z_calavi', name: 'Abomey-Calavi', baseFee: 18000, etaDays: 'À confirmer (2 à 5 jours)', active: true },
      { id: 'z_portonovo', name: 'Porto-Novo', baseFee: 25000, etaDays: 'À confirmer (3 à 6 jours)', active: true },
      { id: 'z_ouidah', name: 'Ouidah', baseFee: 28000, etaDays: 'À confirmer (3 à 6 jours)', active: true },
      { id: 'z_bohicon', name: 'Bohicon', baseFee: 45000, etaDays: 'À confirmer (5 à 8 jours)', active: true },
      { id: 'z_parakou', name: 'Parakou', baseFee: 85000, perKmFee: 0, etaDays: 'À confirmer (8 à 12 jours)', active: true },
    ],
    polymers: [
      { code: 'PET', accepted: true, pricePerKg: 90, criteria: 'Bouteilles et chutes propres, sans bouchons ni résidus organiques.', maxContaminationPct: 8 },
      { code: 'HDPE', accepted: true, pricePerKg: 120, criteria: 'Bidons, bacs et caisses propres, étiquettes tolérées.', maxContaminationPct: 8 },
      { code: 'PP', accepted: true, pricePerKg: 110, criteria: 'Seaux, bouchons, emballages rigides non gras.', maxContaminationPct: 10 },
      { code: 'LDPE', accepted: true, pricePerKg: 70, criteria: 'Films propres et secs, sans terre.', maxContaminationPct: 12 },
      { code: 'PVC', accepted: false, pricePerKg: 0, criteria: 'Non accepté pour l’instant (procédé non validé).', maxContaminationPct: 0 },
      { code: 'PS', accepted: false, pricePerKg: 0, criteria: 'Non accepté pour l’instant.', maxContaminationPct: 0 },
      { code: 'OTHER', accepted: false, pricePerKg: 0, criteria: 'Plastiques non identifiés : non acceptés.', maxContaminationPct: 0 },
    ],
    rawThresholdsKg: { PET: 500, HDPE: 400, PP: 300, LDPE: 200 },
    features: { collectorPayouts: true, distributorPortfolio: true, proPriceGrid: true, publicImpactPage: true },
    demoBanner: 'Prototype de démonstration : toutes les données, documents, prix et paiements sont fictifs.',
  }
  s.settings.push(settings)

  // ===================================================================== Utilisateurs & entreprises
  const U = (id: string, name: string, role: RoleKey, email: string, extra: Partial<User> = {}): User =>
    ({ id, name, role, email, active: true, createdAt: d(-120), lastLoginAt: d(-1), demo: true, phone: '+229 01 00 00 00 ' + String(10 + s.users.length).padStart(2, '0'), ...extra })
  s.users.push(
    U('usr_admin', 'Awa Adjovi', 'admin', 'admin@ecobloc.demo'),
    U('usr_sales', 'Koffi Mensah', 'sales', 'commercial@ecobloc.demo'),
    U('usr_appro', 'Raïssa Dossou', 'procurement', 'appro@ecobloc.demo'),
    U('usr_prod', 'Hervé Gbaguidi', 'production', 'production@ecobloc.demo'),
    U('usr_qual', 'Chantal Tossou', 'quality', 'qualite@ecobloc.demo'),
    U('usr_logi', 'Ibrahim Alassane', 'logistics', 'logistique@ecobloc.demo'),
    U('usr_env', 'Estelle Agbodjan', 'environment', 'environnement@ecobloc.demo'),
    U('usr_driver1', 'Fidèle Houngbo', 'driver', 'chauffeur@ecobloc.demo', { carrierId: 'car_3' }),
    U('usr_driver2', 'Rodrigue Kpadonou', 'driver', 'chauffeur2@ecobloc.demo', { carrierId: 'car_3' }),
    U('usr_coll1', 'Pauline Sènou', 'collector', 'collecteur@ecobloc.demo', { supplierId: 'sup_1' }),
    U('usr_coll2', 'Fatou Kora', 'collector', 'collecteur2@ecobloc.demo', { supplierId: 'sup_3' }),
    U('usr_coll3', 'Martial Zinsou', 'collector', 'collecteur3@ecobloc.demo', { supplierId: 'sup_5' }),
    U('usr_client1', 'Marie-Claire Ahouandjinou', 'client', 'client@ecobloc.demo', { address: addr('Rue 214, quartier Fidjrossè', 'Cotonou', 'z_cotonou', 6.3562, 2.3586) }),
    U('usr_client2', 'Jean-Baptiste Hounkpatin', 'client', 'client2@ecobloc.demo', { address: addr('Villa 12, cité des Cocotiers', 'Abomey-Calavi', 'z_calavi', 6.4485, 2.3558) }),
    U('usr_client3', 'Nadège Sagbo', 'client', 'client3@ecobloc.demo', { address: addr('Quartier Ouando', 'Porto-Novo', 'z_portonovo', 6.4969, 2.6289) }),
    U('usr_client4', 'Rodrigue Agbo', 'client', 'client4@ecobloc.demo', { address: addr('Rue des Palmiers, Fidjrossè', 'Cotonou', 'z_cotonou', 6.3548, 2.3797) }),
    U('usr_pro1', 'Désiré Akpo', 'pro', 'pro@ecobloc.demo', { companyId: 'co_batiplus', companyRole: 'owner' }),
    U('usr_pro1b', 'Larissa Tchibozo', 'pro', 'pro1.achats@ecobloc.demo', { companyId: 'co_batiplus', companyRole: 'buyer' }),
    U('usr_pro2', 'Ernest Vodounnou', 'pro', 'pro2@ecobloc.demo', { companyId: 'co_terra', companyRole: 'owner' }),
    U('usr_pro3', 'Sylvie Dansou', 'pro', 'pro3@ecobloc.demo', { companyId: 'co_hotel', companyRole: 'owner' }),
    U('usr_pro4', 'Basile Lokonon', 'pro', 'pro4@ecobloc.demo', { companyId: 'co_quartier', companyRole: 'owner' }),
    U('usr_distri', 'Moussa Bio Sika', 'distributor', 'distributeur@ecobloc.demo', { companyId: 'co_distri', companyRole: 'owner' }),
  )
  const ct = (id: string, name: string, email: string, fn: string, userId?: string) => ({ id, name, email, function: fn, userId, authorized: true, phone: '+229 01 00 00 00 99' })
  const comp = (id: string, name: string, kind: Company['kind'], city: string, zone: string, owner: User, extra: Partial<Company> = {}): Company => ({
    id, name, kind, address: addr('Adresse fictive ' + id.slice(3), city, zone), billingEmail: `compta@${id.slice(3)}.demo`, paymentTermsDays: 30, contacts: [ct('ctc_' + id, owner.name, owner.email, 'Gérant', owner.id)], status: 'active', createdAt: d(-100), demo: true, ...extra,
  })
  const uid_ = (id: string) => s.users.find((u) => u.id === id)!
  s.companies.push(
    comp('co_batiplus', 'BâtiPlus Cotonou SARL (démo)', 'client', 'Cotonou', 'z_cotonou', uid_('usr_pro1'), { priceGridId: 'pg_pro', contacts: [ct('ctc_bp1', 'Désiré Akpo', 'pro@ecobloc.demo', 'Directeur', 'usr_pro1'), ct('ctc_bp2', 'Larissa Tchibozo', 'pro1.achats@ecobloc.demo', 'Responsable achats', 'usr_pro1b')] }),
    comp('co_terra', 'Terra Aménagement (démo)', 'client', 'Abomey-Calavi', 'z_calavi', uid_('usr_pro2'), { priceGridId: 'pg_pro' }),
    comp('co_hotel', 'Résidence Les Palmiers (démo)', 'client', 'Ouidah', 'z_ouidah', uid_('usr_pro3'), { priceGridId: 'pg_pro', paymentTermsDays: 15 }),
    comp('co_quartier', 'Association de quartier Ouando (démo)', 'client', 'Porto-Novo', 'z_portonovo', uid_('usr_pro4'), { status: 'prospect', paymentTermsDays: 0 }),
    comp('co_distri', 'Distri-Matériaux Atlantique (démo)', 'distributor', 'Cotonou', 'z_cotonou', uid_('usr_distri'), {
      priceGridId: 'pg_dist', paymentTermsDays: 45, creditLimit: 3000000,
      portfolio: [
        { id: 'pf_1', name: 'Quincaillerie du Port (démo)', city: 'Cotonou', contact: 'M. Agossou', lastOrderAt: d(-9) },
        { id: 'pf_2', name: 'Chantiers Sud (démo)', city: 'Lokossa', contact: 'Mme Adanvo', lastOrderAt: d(-21) },
        { id: 'pf_3', name: 'Dépôt Sèmè (démo)', city: 'Sèmè-Podji', contact: 'M. Lawani' },
      ],
    }),
  )

  // ===================================================================== Catalogue
  const cats: Category[] = [
    { id: 'cat_paves', name: 'Pavés', slug: 'paves', description: 'Pavés pour allées, cours et espaces extérieurs piétons.', order: 1, published: true },
    { id: 'cat_dalles', name: 'Dalles', slug: 'dalles', description: 'Dalles pour allées, terrasses et aménagements paysagers.', order: 2, published: true },
    { id: 'cat_bordures', name: 'Bordures', slug: 'bordures', description: 'Bordures de jardin et de délimitation d’allées.', order: 3, published: true },
    { id: 'cat_autres', name: 'Autres produits non structurels', slug: 'autres', description: 'Produits décoratifs ou d’aménagement, uniquement lorsque l’usage est clairement défini.', order: 4, published: true },
  ]
  s.categories.push(...cats)
  const ZALL = ['z_cotonou', 'z_calavi', 'z_portonovo', 'z_ouidah', 'z_bohicon', 'z_parakou']
  const NS = 'Non structurel : ne pas utiliser pour des éléments porteurs.'
  const P = (id: string, ref: string, name: string, cat: string, pattern: Product['pattern'], tone: string, dim: [number, number, number], w: number, price: number | null, moq: number, validation: Product['validation'], x: Partial<Product> & { uses: string[]; restr?: string[]; desc: string }): Product => {
    const m2 = (dim[0] * dim[1]) / 1e6
    return {
      id, ref, slug: id.slice(4), name, categoryId: cat, description: x.desc, photos: [], tone, pattern,
      dimensions: { lengthMm: dim[0], widthMm: dim[1], heightMm: dim[2] }, unitWeightKg: w,
      saleUnit: cat === 'cat_bordures' ? 'ml' : 'piece', unitsPerPallet: Math.round(1000 / w / 5) * 5, m2PerUnit: cat === 'cat_bordures' ? undefined : m2,
      finishes: x.finishes ?? ['Lisse', 'Strié'], colors: x.colors ?? [{ name: 'Vert forêt', hex: tone }, { name: 'Graphite', hex: '#4b5359' }],
      priceIndicative: price, minOrderQty: moq, minStockUnits: 40, deliveryZones: ZALL, leadTimeLabel: 'À confirmer',
      documentIds: x.documentIds ?? [], validation,
      allowedUses: x.uses, restrictions: [NS, ...(x.restr ?? []), ...(validation === 'authorized' ? [] : ['Validation en cours : données techniques et certifications à confirmer avant commercialisation.'])],
      installNotes: x.installNotes, installNotesValidated: !!x.installNotes && validation === 'authorized',
      requiresReleasedLot: validation === 'authorized' ? true : true, published: true, featured: x.featured, ownerUserId: 'usr_prod', createdAt: d(-110), updatedAt: d(-12), demo: true,
    }
  }
  s.products.push(
    P('prd_pave-hexa-20', 'PAV-H20', 'Pavé Hexa 20', 'cat_paves', 'paver', '#3f6f5b', [200, 200, 60], 2.4, 450, 250, 'authorized', { featured: true, desc: 'Pavé carré de 20 cm en plastique recyclé, finition lisse ou striée. Pensé pour les allées piétonnes et les cours de résidence.', uses: ['Allées piétonnes', 'Cours et patios', 'Abords de bâtiments'], restr: ['Usage piéton : circulation de véhicules non validée.'], documentIds: ['doc_fiche_h20', 'doc_test_h20', 'doc_pose_h20', 'doc_safety'], installNotes: 'Pose sur lit de sable stabilisé compacté, joints de 3 à 5 mm. Instructions de démonstration, à confirmer par le service technique.' }),
    P('prd_pave-rect-10', 'PAV-R10', 'Pavé Rectangle 10×20', 'cat_paves', 'paver', '#5b6b73', [200, 100, 60], 1.2, 250, 400, 'authorized', { desc: 'Pavé rectangulaire pour calepinages en appareil, allées et bordures de terrasse.', uses: ['Allées piétonnes', 'Terrasses', 'Calepinages décoratifs'], restr: ['Usage piéton uniquement.'], colors: [{ name: 'Graphite', hex: '#5b6b73' }, { name: 'Vert forêt', hex: '#3f6f5b' }], documentIds: ['doc_fiche_r10', 'doc_safety'] }),
    P('prd_pave-renforce-80', 'PAV-R80', 'Pavé Renforcé 80', 'cat_paves', 'paver', '#6a5a46', [200, 100, 80], 1.6, null, 500, 'testing', { desc: 'Pavé de 8 cm d’épaisseur en cours d’essais pour des accès à trafic léger.', uses: ['À définir après essais'], restr: ['Aucun usage carrossable validé.'] }),
    P('prd_pave-drainant-30', 'PAV-D30', 'Pavé Drainant 30', 'cat_paves', 'paver', '#44796d', [300, 300, 60], 4.8, 900, 150, 'results', { desc: 'Pavé à joints ouverts pour limiter le ruissellement. Résultats d’essais disponibles, validation commerciale en cours.', uses: ['Allées piétonnes (après validation)'], restr: ['Performance de drainage à confirmer.'], documentIds: ['doc_test_d30'] }),
    P('prd_dalle-allee-40', 'DAL-A40', 'Dalle Allée 40×40', 'cat_dalles', 'slab', '#4f7a66', [400, 400, 40], 4.6, 1600, 100, 'authorized', { desc: 'Dalle de 40 cm pour allées de jardin et circulations piétonnes.', uses: ['Allées de jardin', 'Circulations piétonnes'], restr: ['Usage piéton uniquement.'], documentIds: ['doc_fiche_a40', 'doc_test_a40', 'doc_safety'] }),
    P('prd_dalle-jardin-50', 'DAL-J50', 'Dalle Jardin 50×50', 'cat_dalles', 'slab', '#58645f', [500, 500, 40], 9, 2400, 60, 'authorized', { desc: 'Grande dalle pour terrasses et aménagements paysagers.', uses: ['Terrasses', 'Aménagement paysager'], restr: ['Usage piéton uniquement.'], documentIds: ['doc_fiche_j50'] }),
    P('prd_dalle-terrasse-60', 'DAL-T60', 'Dalle Terrasse 60×30', 'cat_dalles', 'slab', '#7a6b52', [600, 300, 35], 3.8, 1450, 80, 'results', { desc: 'Dalle rectangulaire pour terrasses. Résultats d’essais disponibles ; validation commerciale en cours.', uses: ['Terrasses (après validation)'], documentIds: ['doc_test_t60'] }),
    P('prd_bordure-jardin-100', 'BOR-J100', 'Bordure Jardin 100', 'cat_bordures', 'kerb', '#35604f', [1000, 150, 50], 7.5, 3200, 40, 'authorized', { featured: true, desc: 'Bordure d’un mètre pour délimiter massifs, allées et pelouses.', uses: ['Délimitation de massifs', 'Bordures d’allées'], restr: ['Non destinée à contenir des charges.'], documentIds: ['doc_fiche_b100', 'doc_safety'], finishes: ['Lisse'] }),
    P('prd_bordure-arrondie-50', 'BOR-A50', 'Bordure Arrondie 50', 'cat_bordures', 'kerb', '#4a5a50', [500, 120, 60], 3, 2800, 60, 'testing', { desc: 'Bordure courte à profil arrondi, en essais.', uses: ['À définir après essais'] }),
    P('prd_lame-terrasse-25', 'PLA-C25', 'Lame de Terrasse 25', 'cat_autres', 'plank', '#6b5b45', [1200, 140, 25], 3.2, null, 100, 'testing', { desc: 'Lame de platelage décoratif en cours d’essais.', uses: ['À définir après essais'], restr: ['Aucune charge validée.'] }),
    P('prd_couvre-mur-30', 'AUT-CM30', 'Couvre-mur décoratif 30', 'cat_autres', 'block', '#51606a', [300, 250, 60], 3.5, null, 50, 'development', { desc: 'Élément décoratif en développement. Non commandable.', uses: ['Aucun usage validé'] }),
    P('prd_caillebotis-50', 'AUT-CJ50', 'Caillebotis de jardin 50', 'cat_autres', 'tile', '#476b5a', [500, 500, 30], 5.2, null, 50, 'development', { desc: 'Caillebotis en développement. Non commandable.', uses: ['Aucun usage validé'] }),
  )
  const prod = (id: string) => s.products.find((p) => p.id === id)!

  s.priceGrids.push(
    { id: 'pg_pro', name: 'Grille professionnelle (démo)', audience: 'pro', defaultDiscountPct: 6, tiers: [{ productId: 'prd_pave-hexa-20', minQty: 1000, unitPrice: 405 }, { productId: 'prd_dalle-allee-40', minQty: 300, unitPrice: 1450 }, { productId: 'prd_bordure-jardin-100', minQty: 200, unitPrice: 2900 }], notes: 'Remise de base de 6 % + paliers sur volumes. Valeurs fictives.', active: true },
    { id: 'pg_dist', name: 'Grille distributeur (démo)', audience: 'distributor', defaultDiscountPct: 12, tiers: [{ productId: 'prd_pave-hexa-20', minQty: 5000, unitPrice: 360 }, { productId: 'prd_bordure-jardin-100', minQty: 500, unitPrice: 2650 }], notes: 'Remise de base de 12 %. Valeurs fictives.', active: true },
    { id: 'pg_public', name: 'Tarif public indicatif', audience: 'public', defaultDiscountPct: 0, tiers: [], active: true },
  )

  // ===================================================================== Documents
  const D = (id: string, ref: string, title: string, kind: TechDocument['kind'], status: TechDocument['status'], visibility: TechDocument['visibility'], productId?: string, extra: Partial<TechDocument> = {}): TechDocument =>
    ({ id, ref, title, kind, status, visibility, version: '0.1-démo', mime: 'application/pdf', sizeKb: 180 + (hash(id) % 400 + 400) % 400, demoNotice: DEMO_NOTICE, productId, createdAt: d(-60), updatedAt: d(-20), uploadedBy: 'usr_qual', demo: true, ...extra })
  s.documents.push(
    D('doc_fiche_h20', 'DOC-0001', 'Fiche produit — Pavé Hexa 20 (démo)', 'datasheet', 'published', 'public', 'prd_pave-hexa-20'),
    D('doc_fiche_r10', 'DOC-0002', 'Fiche produit — Pavé Rectangle 10×20 (démo)', 'datasheet', 'published', 'public', 'prd_pave-rect-10'),
    D('doc_fiche_a40', 'DOC-0003', 'Fiche produit — Dalle Allée 40×40 (démo)', 'datasheet', 'published', 'public', 'prd_dalle-allee-40'),
    D('doc_fiche_j50', 'DOC-0004', 'Fiche produit — Dalle Jardin 50×50 (démo)', 'datasheet', 'published', 'public', 'prd_dalle-jardin-50'),
    D('doc_fiche_b100', 'DOC-0005', 'Fiche produit — Bordure Jardin 100 (démo)', 'datasheet', 'published', 'public', 'prd_bordure-jardin-100'),
    D('doc_test_h20', 'DOC-0006', 'Rapport d’essais interne — Pavé Hexa 20 (démo)', 'test_report', 'published', 'customers', 'prd_pave-hexa-20', { lotId: 'lot_1' }),
    D('doc_test_a40', 'DOC-0007', 'Rapport d’essais interne — Dalle Allée 40×40 (démo)', 'test_report', 'published', 'customers', 'prd_dalle-allee-40'),
    D('doc_test_d30', 'DOC-0008', 'Rapport d’essais — Pavé Drainant 30 (démo)', 'test_report', 'internal', 'internal', 'prd_pave-drainant-30', { lotId: 'lot_6' }),
    D('doc_test_t60', 'DOC-0009', 'Rapport d’essais — Dalle Terrasse 60×30 (brouillon démo)', 'test_report', 'draft', 'internal', 'prd_dalle-terrasse-60'),
    D('doc_pose_h20', 'DOC-0010', 'Guide de pose — Pavé Hexa 20 (démo)', 'install_guide', 'published', 'public', 'prd_pave-hexa-20'),
    D('doc_safety', 'DOC-0011', 'Consignes de manutention et de stockage (démo)', 'safety', 'published', 'public'),
    D('doc_proof_env', 'DOC-0012', 'Registre des pesées — indicateurs environnementaux (démo)', 'proof', 'internal', 'internal'),
    D('doc_cgv', 'DOC-0013', 'Conditions de vente professionnelles (démo)', 'commercial', 'published', 'customers'),
  )

  // ===================================================================== Partenaires terrain
  const S = (id: string, name: string, kind: Supplier['kind'], contact: string, city: string, polymers: PolymerCode[], extra: Partial<Supplier> = {}): Supplier => ({
    id, name, kind, contactName: contact, phone: '+229 01 00 00 00 ' + (20 + s.suppliers.length), address: addr('Point de collecte fictif', city, undefined, 6.4 + s.suppliers.length * 0.01, 2.35 + s.suppliers.length * 0.02), polymers,
    status: 'approved', paymentModel: 'per_kg', createdAt: d(-90), demo: true, ...extra,
  })
  s.suppliers.push(
    S('sup_1', 'Coopérative Plastique Propre Calavi (démo)', 'cooperative', 'Pauline Sènou', 'Abomey-Calavi', ['PET', 'HDPE', 'PP'], { userId: 'usr_coll1' }),
    S('sup_2', 'Groupement de collecte du marché (démo)', 'collector_org', 'Armand Fadé', 'Cotonou', ['PET', 'LDPE']),
    S('sup_3', 'Fatou Kora — collectrice indépendante (démo)', 'collector_individual', 'Fatou Kora', 'Cotonou', ['PP', 'LDPE', 'PET'], { userId: 'usr_coll2' }),
    S('sup_4', 'Brasserie Atlantique — chutes PET (démo)', 'supplier', 'Service environnement', 'Cotonou', ['PET'], { paymentModel: 'none' }),
    S('sup_5', 'Association Jeunes Propres Porto-Novo (démo)', 'collector_org', 'Martial Zinsou', 'Porto-Novo', ['HDPE', 'PP'], { userId: 'usr_coll3' }),
    S('sup_6', 'Atelier Ouidah Recyclage (démo)', 'collector_org', 'Eugénie Hounsa', 'Ouidah', ['PET', 'HDPE'], { status: 'pending', notes: 'Dossier en cours de validation.' }),
  )
  s.carriers.push(
    { id: 'car_1', name: 'Transports Atlantique (démo)', contactName: 'M. Dègla', phone: '+229 01 00 00 00 71', vehicle: 'Camion 10 t', plate: 'DEMO-0001', zones: ZALL, flatFee: 12000, perKmFee: 350, status: 'active', demo: true },
    { id: 'car_2', name: 'Logistique Sud Express (démo)', contactName: 'Mme Gnonlonfoun', phone: '+229 01 00 00 00 72', vehicle: 'Camion 5 t', plate: 'DEMO-0002', zones: ['z_cotonou', 'z_calavi', 'z_ouidah', 'z_portonovo'], flatFee: 9000, perKmFee: 300, status: 'active', demo: true },
    { id: 'car_3', name: 'Flotte interne EcoBloc', phone: '+229 01 00 00 00 73', vehicle: 'Pick-up et plateau 3 t', plate: 'DEMO-0003', zones: ['z_cotonou', 'z_calavi', 'z_portonovo'], flatFee: 0, perKmFee: 200, status: 'active', demo: true },
  )

  // ===================================================================== Collectes
  const C = (n: number, sup: string, poly: [PolymerCode, number][], status: CollectionRequest['status'], created: number, label: string, city: string, x: Partial<CollectionRequest> = {}): CollectionRequest => {
    const supplier = s.suppliers.find((q) => q.id === sup)!
    return {
      id: `col_${n}`, ref: `COL-2026-${String(n).padStart(4, '0')}`, supplierId: sup, polymers: poly.map(([code, estimatedKg]) => ({ code, estimatedKg })),
      estimatedTotalKg: poly.reduce((a, [, k]) => a + k, 0), pickupPoint: { ...addr(label, city, undefined, 6.35 + n * 0.02, 2.4 + n * 0.015), label }, photos: [],
      preferredSlots: ['Matin', 'Après-midi'], proposedSlots: [], status, createdAt: d(created), updatedAt: d(created + 1), history: [he(d(created), 'Demande envoyée', supplier.contactName)], demo: true, ...x,
    }
  }
  s.collections.push(
    C(1, 'sup_1', [['PET', 260], ['HDPE', 160]], 'received', -16, 'Dépôt de la coopérative', 'Abomey-Calavi', { scheduledAt: d(-14, 9), tourId: 'trn_1', driverUserId: 'usr_driver1', recordedKg: 405, receiptId: 'rcp_1' }),
    C(2, 'sup_3', [['PP', 180], ['LDPE', 120]], 'received', -18, 'Marché — allée B', 'Cotonou', { scheduledAt: d(-12, 10), tourId: 'trn_1', driverUserId: 'usr_driver1', recordedKg: 296, receiptId: 'rcp_2' }),
    C(3, 'sup_5', [['HDPE', 300]], 'weighed', -6, 'Local de l’association', 'Porto-Novo', { scheduledAt: d(-2, 9), tourId: 'trn_2', driverUserId: 'usr_driver1', recordedKg: 312 }),
    C(4, 'sup_1', [['PP', 320]], 'collected', -5, 'Dépôt de la coopérative', 'Abomey-Calavi', { scheduledAt: d(0, 7), tourId: 'trn_2', driverUserId: 'usr_driver1', recordedKg: 318, proof: { note: 'Sacs fermés, 16 sacs de 20 kg.', at: d(0, 8, 40) } }),
    C(5, 'sup_3', [['PET', 140]], 'en_route', -3, 'Marché — allée B', 'Cotonou', { scheduledAt: d(0, 10), tourId: 'trn_2', driverUserId: 'usr_driver1' }),
    C(6, 'sup_1', [['PET', 220], ['HDPE', 140]], 'planned', -2, 'Dépôt de la coopérative', 'Abomey-Calavi', { scheduledAt: d(2, 9), tourId: 'trn_3', driverUserId: 'usr_driver2', proposedSlots: [d(2, 9), d(3, 9)] }),
    C(7, 'sup_5', [['PP', 200]], 'planned', -2, 'Local de l’association', 'Porto-Novo', { scheduledAt: d(4, 14), tourId: 'trn_3', driverUserId: 'usr_driver2', proposedSlots: [d(4, 14)] }),
    C(8, 'sup_3', [['LDPE', 90]], 'under_review', -1, 'Marché — allée B', 'Cotonou'),
    C(9, 'sup_1', [['PET', 180]], 'submitted', 0, 'Dépôt de la coopérative', 'Abomey-Calavi'),
    C(10, 'sup_5', [['HDPE', 120]], 'problem', -4, 'Local de l’association', 'Porto-Novo', { scheduledAt: d(-1, 9), driverUserId: 'usr_driver2', problemReason: 'Point de collecte inaccessible (route barrée). À replanifier.' }),
    C(11, 'sup_3', [['PP', 60]], 'cancelled', -9, 'Marché — allée B', 'Cotonou', { cancelReason: 'Quantité insuffisante, annulée par le collecteur.' }),
    C(12, 'sup_1', [['PVC', 150]] as any, 'rejected', -8, 'Dépôt de la coopérative', 'Abomey-Calavi', { problemReason: 'Le PVC n’est pas accepté actuellement.' }),
  )
  s.tours.push(
    { id: 'trn_1', ref: 'TRN-2026-0001', date: d(-14), driverUserId: 'usr_driver1', carrierId: 'car_3', vehicle: 'Pick-up et plateau 3 t', collectionIds: ['col_1', 'col_2'], status: 'done', startedAt: d(-14, 7), endedAt: d(-12, 13), distanceKm: 74, demo: true },
    { id: 'trn_2', ref: 'TRN-2026-0002', date: d(0), driverUserId: 'usr_driver1', carrierId: 'car_3', vehicle: 'Pick-up et plateau 3 t', collectionIds: ['col_3', 'col_4', 'col_5'], status: 'in_progress', startedAt: d(0, 7), distanceKm: 52, demo: true },
    { id: 'trn_3', ref: 'TRN-2026-0003', date: d(2), driverUserId: 'usr_driver2', carrierId: 'car_3', vehicle: 'Pick-up et plateau 3 t', collectionIds: ['col_6', 'col_7'], status: 'planned', demo: true },
  )

  // ===================================================================== Réceptions & matières premières
  const L = (polymer: PolymerCode, weighedKg: number, acceptedKg: number, rejectedKg: number, quarantineKg: number, reason?: string, contamination?: number): ReceiptLine => ({
    polymer, weighedKg, acceptedKg, rejectedKg, quarantineKg, contaminationPct: contamination, reason,
    decision: acceptedKg === weighedKg ? 'accepted' : rejectedKg === weighedKg ? 'rejected' : quarantineKg === weighedKg ? 'quarantine' : 'partial',
  })
  const R = (n: number, sup: string, at: number, declared: number, lines: ReceiptLine[], x: Partial<Receipt> = {}): Receipt => {
    const supplier = s.suppliers.find((q) => q.id === sup)!
    const accepted = lines.reduce((a, l) => a + l.acceptedKg, 0)
    const rate = s.settings[0]!.polymers
    const amount = supplier.paymentModel === 'per_kg' ? lines.reduce((a, l) => a + l.acceptedKg * (rate.find((p) => p.code === l.polymer)?.pricePerKg ?? 0), 0) : 0
    return {
      id: `rcp_${n}`, ref: `RCP-2026-${String(n).padStart(4, '0')}`, supplierId: sup, receivedAt: d(at, 14), receivedBy: 'usr_appro', declaredKg: declared,
      weighedKg: lines.reduce((a, l) => a + l.weighedKg, 0), lines, status: 'closed',
      payout: supplier.paymentModel === 'per_kg' && accepted > 0 ? { amount, status: n <= 2 || n === 5 ? 'paid_simulated' : 'pending', ref: n <= 2 || n === 5 ? `SIM-PAY-${n}` : undefined, paidAt: n <= 2 || n === 5 ? d(at + 3) : undefined } : undefined,
      demo: true, ...x,
    }
  }
  s.receipts.push(
    R(1, 'sup_1', -14, 420, [L('PET', 250, 238, 12, 0, 'Étiquettes et résidus', 4.8), L('HDPE', 155, 150, 0, 5, 'Un sac à contrôler', 3.2)], { collectionId: 'col_1' }),
    R(2, 'sup_3', -12, 300, [L('PP', 180, 172, 8, 0, 'Pièces métalliques', 4.4), L('LDPE', 116, 100, 6, 10, 'Films humides', 13.8)], { collectionId: 'col_2' }),
    R(3, 'sup_4', -18, 600, [L('PET', 600, 590, 10, 0, 'Quelques bouchons', 1.7)]),
    R(4, 'sup_5', -17, 300, [L('HDPE', 300, 300, 0, 0)]),
    R(5, 'sup_1', -15, 230, [L('PP', 220, 0, 0, 220, 'Odeur d’hydrocarbure : mis en quarantaine', undefined)]),
    R(6, 'sup_3', -16, 150, [L('PET', 150, 0, 150, 0, 'Plastique non conforme (PVC mélangé)', 22)]),
    R(7, 'sup_4', -11, 520, [L('PET', 520, 520, 0, 0)]),
    R(8, 'sup_5', -4, 480, [L('HDPE', 480, 480, 0, 0)]),
    R(9, 'sup_1', -2, 300, [L('PP', 300, 300, 0, 0)]),
  )
  const RL = (n: number, rcp: string, sup: string, polymer: PolymerCode, initial: number, consumed: number, reserved: number, status: RawLot['status'], at: number, loc: string, notes?: string): RawLot => ({
    id: `rlot_${n}`, ref: `MP-2026-${String(n).padStart(4, '0')}`, receiptId: rcp, supplierId: sup, polymer, kgInitial: initial, kgConsumed: consumed, kgReserved: reserved,
    kgAvailable: status === 'rejected' ? 0 : initial - consumed - reserved, locationId: loc, status, receivedAt: d(at, 14), notes, demo: true,
  })
  s.rawLots.push(
    RL(1, 'rcp_1', 'sup_1', 'PET', 238, 238, 0, 'depleted', -14, 'loc_raw_a'),
    RL(2, 'rcp_1', 'sup_1', 'HDPE', 150, 150, 0, 'depleted', -14, 'loc_raw_a'),
    RL(3, 'rcp_1', 'sup_1', 'HDPE', 5, 0, 0, 'quarantine', -14, 'loc_quar', 'Sac à contrôler.'),
    RL(4, 'rcp_2', 'sup_3', 'PP', 172, 172, 0, 'depleted', -12, 'loc_raw_b'),
    RL(5, 'rcp_2', 'sup_3', 'LDPE', 100, 100, 0, 'depleted', -12, 'loc_raw_b'),
    RL(6, 'rcp_2', 'sup_3', 'LDPE', 10, 0, 0, 'quarantine', -12, 'loc_quar', 'Films humides.'),
    RL(7, 'rcp_3', 'sup_4', 'PET', 590, 590, 0, 'depleted', -18, 'loc_raw_a'),
    RL(8, 'rcp_4', 'sup_5', 'HDPE', 300, 300, 0, 'depleted', -17, 'loc_raw_a'),
    RL(9, 'rcp_5', 'sup_1', 'PP', 220, 0, 0, 'quarantine', -15, 'loc_quar', 'Odeur suspecte : en attente de décision.'),
    RL(11, 'rcp_7', 'sup_4', 'PET', 520, 400, 100, 'available', -11, 'loc_raw_a'),
    RL(12, 'rcp_8', 'sup_5', 'HDPE', 480, 70, 350, 'available', -4, 'loc_raw_a'),
    RL(13, 'rcp_9', 'sup_1', 'PP', 300, 50, 220, 'available', -2, 'loc_raw_b'),
  )
  s.stockLocations.push(
    { id: 'loc_raw_a', code: 'HA', name: 'Hangar A — PET / PEHD', kind: 'raw', capacity: 8000, unit: 'kg' },
    { id: 'loc_raw_b', code: 'HB', name: 'Hangar B — PP / PEBD', kind: 'raw', capacity: 5000, unit: 'kg' },
    { id: 'loc_quar', code: 'QR', name: 'Zone de quarantaine', kind: 'quarantine', capacity: 1500, unit: 'kg' },
    { id: 'loc_fin_1', code: 'PF1', name: 'Aire produits finis 1', kind: 'finished', capacity: 3000, unit: 'unit' },
    { id: 'loc_fin_2', code: 'PF2', name: 'Aire produits finis 2', kind: 'finished', capacity: 2000, unit: 'unit' },
  )

  // ===================================================================== Production
  s.operators.push(
    { id: 'op_1', name: 'Gaston Adjakpa', station: 'Broyage', shift: 'matin', active: true },
    { id: 'op_2', name: 'Prisca Gnancadja', station: 'Extrusion', shift: 'matin', active: true },
    { id: 'op_3', name: 'Thierry Zossou', station: 'Moulage', shift: 'après-midi', active: true },
    { id: 'op_4', name: 'Odette Houssou', station: 'Finition', shift: 'après-midi', active: true },
    { id: 'op_5', name: 'Cyrille Padonou', station: 'Contrôle dimensionnel', shift: 'matin', active: false },
  )
  const NOTE = 'Donnée technique interne de démonstration — ne constitue pas une instruction de fabrication certifiée.'
  const WO = (n: number, productId: string, planned: number, produced: number, scrap: number, status: WorkOrder['status'], start: number, end: number, plannedKg: number, consumedKg: number, reservations: WorkOrder['reservations'], x: Partial<WorkOrder> = {}): WorkOrder => ({
    id: `of_${n}`, ref: `OF-2026-${String(n).padStart(4, '0')}`, productId, plannedQty: planned, producedQty: produced, scrapQty: scrap, status,
    plannedStart: d(start, 6), plannedEnd: d(end, 17), actualStart: ['in_progress', 'paused', 'completed'].includes(status) ? d(start, 6) : undefined,
    actualEnd: status === 'completed' ? d(end, 16) : undefined, materialKgPlanned: plannedKg, materialKgConsumed: consumedKg, reservations, operatorIds: ['op_1', 'op_2', 'op_3'],
    supervisorId: 'usr_prod', internalRecipeNote: NOTE, history: [he(d(start - 1), 'Ordre créé', 'Hervé Gbaguidi'), ...(status === 'completed' ? [he(d(end, 16), 'Ordre clôturé', 'Hervé Gbaguidi')] : [])], createdAt: d(start - 1), demo: true, ...x,
  })
  s.workOrders.push(
    WO(1, 'prd_pave-hexa-20', 400, 388, 12, 'completed', -22, -18, 1000, 985, [], { lotId: 'lot_1' }),
    WO(2, 'prd_bordure-jardin-100', 80, 74, 6, 'completed', -17, -14, 600, 565, [], { lotId: 'lot_2' }),
    WO(3, 'prd_dalle-allee-40', 80, 70, 4, 'completed', -13, -10, 350, 340, [], { lotId: 'lot_3' }),
    WO(4, 'prd_pave-rect-10', 300, 0, 0, 'materials_reserved', 1, 5, 350, 0, [{ rawLotId: 'rlot_11', kg: 100 }, { rawLotId: 'rlot_12', kg: 250 }]),
    WO(5, 'prd_dalle-jardin-50', 24, 10, 0, 'in_progress', 0, 3, 220, 0, [{ rawLotId: 'rlot_13', kg: 220 }]),
    WO(6, 'prd_pave-hexa-20', 200, 0, 0, 'cancelled', -8, -6, 500, 0, [], { history: [he(d(-9), 'Ordre créé', 'Hervé Gbaguidi'), he(d(-8), 'Ordre annulé', 'Hervé Gbaguidi', 'Matière insuffisante au moment du lancement.')] }),
    WO(7, 'prd_bordure-arrondie-50', 40, 6, 0, 'paused', -2, 2, 130, 0, [{ rawLotId: 'rlot_12', kg: 100 }]),
    WO(8, 'prd_pave-renforce-80', 40, 38, 2, 'completed', -9, -8, 62, 60, [], { lotId: 'lot_4' }),
    WO(9, 'prd_dalle-terrasse-60', 12, 12, 0, 'completed', -4, -3, 48, 50, [], { lotId: 'lot_5' }),
    WO(10, 'prd_pave-drainant-30', 30, 28, 2, 'completed', -7, -6, 72, 70, [], { lotId: 'lot_6' }),
  )
  s.productionEvents.push(
    { id: 'ev_1', workOrderId: 'of_1', type: 'stop', severity: 'medium', startedAt: d(-20, 10), durationMin: 85, description: 'Arrêt pour nettoyage de la filière.', resolved: true, userId: 'usr_prod' },
    { id: 'ev_2', workOrderId: 'of_2', type: 'anomaly', severity: 'low', startedAt: d(-16, 11), description: 'Variation de teinte sur un lot de matière.', resolved: true, userId: 'usr_prod' },
    { id: 'ev_3', workOrderId: 'of_5', type: 'anomaly', severity: 'medium', startedAt: d(0, 9), description: 'Température de moulage instable sur la presse 2.', resolved: false, userId: 'usr_prod' },
    { id: 'ev_4', workOrderId: 'of_7', type: 'stop', severity: 'high', startedAt: d(-1, 15), durationMin: 240, description: 'Panne du broyeur : ordre mis en pause.', resolved: false, userId: 'usr_prod' },
    { id: 'ev_5', workOrderId: 'of_3', type: 'note', severity: 'low', startedAt: d(-12, 9), description: 'Changement de moule en début de poste.', resolved: true },
    { id: 'ev_6', workOrderId: 'of_10', type: 'anomaly', severity: 'high', startedAt: d(-7, 14), description: 'Porosité excessive observée sur les premières pièces.', resolved: true, userId: 'usr_prod' },
  )
  const LOT = (n: number, wo: string, productId: string, produced: number, scrap: number, avail: number, res: number, shipped: number, qc: ProductionLot['qcStatus'], at: number, inputs: ProductionLot['rawInputs'], x: Partial<ProductionLot> = {}): ProductionLot => ({
    id: `lot_${n}`, ref: `LOT-2026-${String(n).padStart(4, '0')}`, workOrderId: wo, productId, producedQty: produced, scrapQty: scrap, availableQty: avail, reservedQty: res, shippedQty: shipped,
    producedAt: d(at, 16), locationId: n % 2 ? 'loc_fin_1' : 'loc_fin_2', rawInputs: inputs, qcStatus: qc, inspectionIds: [`qc_${n}`], demo: true, ...x,
  })
  s.productionLots.push(
    LOT(1, 'of_1', 'prd_pave-hexa-20', 388, 12, 108, 60, 220, 'released', -18, [{ rawLotId: 'rlot_7', kg: 590 }, { rawLotId: 'rlot_1', kg: 238 }, { rawLotId: 'rlot_2', kg: 150 }, { rawLotId: 'rlot_8', kg: 7 }], { releasedAt: d(-16, 11), releasedBy: 'usr_qual' }),
    LOT(2, 'of_2', 'prd_bordure-jardin-100', 74, 6, 30, 14, 30, 'released', -14, [{ rawLotId: 'rlot_8', kg: 293 }, { rawLotId: 'rlot_4', kg: 172 }, { rawLotId: 'rlot_5', kg: 100 }], { releasedAt: d(-12, 10), releasedBy: 'usr_qual' }),
    LOT(3, 'of_3', 'prd_dalle-allee-40', 70, 4, 70, 0, 0, 'in_qc', -10, [{ rawLotId: 'rlot_11', kg: 340 }]),
    LOT(4, 'of_8', 'prd_pave-renforce-80', 38, 2, 38, 0, 0, 'quarantine', -8, [{ rawLotId: 'rlot_11', kg: 60 }]),
    LOT(5, 'of_9', 'prd_dalle-terrasse-60', 12, 0, 12, 0, 0, 'pending_qc', -3, [{ rawLotId: 'rlot_13', kg: 50 }]),
    LOT(6, 'of_10', 'prd_pave-drainant-30', 28, 2, 28, 0, 0, 'rejected', -6, [{ rawLotId: 'rlot_12', kg: 70 }]),
  )

  // ===================================================================== Qualité
  const QT = (id: string, code: string, name: string, method: string, unit: string, criterion: QcTemplate['criterion'], order: number, required = true): QcTemplate => ({ id, code, name, method, unit, criterion, required, order, demoValues: true })
  s.qcTemplates.push(
    QT('qct_dim', 'DIM', 'Écart dimensionnel', 'Mesure au pied à coulisse sur 5 pièces (méthode interne de démonstration).', 'mm', { kind: 'range', min: -2, max: 2 }, 1),
    QT('qct_aspect', 'ASP', 'Aspect visuel (fissures, déformations)', 'Contrôle visuel de 100 % de l’échantillon.', '', { kind: 'pass_fail' }, 2),
    QT('qct_water', 'ABS', 'Absorption d’eau', 'Immersion 24 h (valeur seuil de démonstration).', '% masse', { kind: 'max', max: 6 }, 3),
    QT('qct_flex', 'FLX', 'Résistance en flexion (indicative)', 'Essai de flexion interne (valeur seuil de démonstration).', 'MPa', { kind: 'min', min: 4 }, 4),
    QT('qct_mass', 'MAS', 'Écart de masse unitaire', 'Pesée de 10 pièces.', '%', { kind: 'range', min: -5, max: 5 }, 5, false),
  )
  const RS = (dim: number, asp: boolean, water: number, flex: number, mass: number, at: number): QcResult[] => [
    { templateId: 'qct_dim', value: dim, passed: Math.abs(dim) <= 2, measuredAt: d(at) },
    { templateId: 'qct_aspect', passed: asp, measuredAt: d(at) },
    { templateId: 'qct_water', value: water, passed: water <= 6, measuredAt: d(at) },
    { templateId: 'qct_flex', value: flex, passed: flex >= 4, measuredAt: d(at) },
    { templateId: 'qct_mass', value: mass, passed: Math.abs(mass) <= 5, measuredAt: d(at) },
  ]
  const QI = (n: number, lot: string, status: QcInspection['status'], results: QcResult[], decision: QcInspection['decision'] | undefined, reason: string | undefined, at: number): QcInspection => ({
    id: `qc_${n}`, ref: `QC-2026-${String(n).padStart(4, '0')}`, lotId: lot, requestedAt: d(at - 1), requestedBy: 'usr_prod', assignedTo: 'usr_qual', status, results, decision, decisionReason: reason,
    decidedBy: decision ? 'usr_qual' : undefined, decidedAt: decision ? d(at, 11) : undefined, history: [he(d(at - 1), 'Contrôle demandé', 'Hervé Gbaguidi'), ...(decision ? [he(d(at, 11), `Décision : ${decision}`, 'Chantal Tossou', reason)] : [])], demo: true,
  })
  s.qcInspections.push(
    QI(1, 'lot_1', 'completed', RS(0.8, true, 3.1, 6.2, 1.4, -17), 'accepted', 'Tous les critères de démonstration sont respectés.', -16),
    QI(2, 'lot_2', 'completed', RS(-0.6, true, 3.8, 5.6, -0.9, -13), 'accepted', 'Conforme aux critères de démonstration.', -12),
    QI(3, 'lot_3', 'in_progress', RS(1.1, true, 4.2, 5.1, 0.4, -1).slice(0, 3), undefined, undefined, -1),
    QI(4, 'lot_4', 'completed', RS(1.6, true, 5.4, 3.7, 2.2, -7), 'quarantine', 'Résistance en flexion juste sous le seuil : nouveaux essais demandés.', -7),
    QI(5, 'lot_5', 'pending', [], undefined, undefined, -2),
    QI(6, 'lot_6', 'completed', RS(0.9, false, 9.2, 4.4, 1.0, -5), 'rejected', 'Absorption d’eau et aspect hors critères.', -5),
  )

  // ===================================================================== Devis, commandes, paiements, factures
  const priceOf = (pid: string) => prod(pid).priceIndicative ?? 0
  const zoneFee = (z: string) => settings.zones.find((q) => q.id === z)!.baseFee
  type OL = [string, number, [string, number][]?]
  const mkLines = (n: number, lines: OL[], disc: number): OrderLine[] => lines.map(([pid, qty, al], i) => ({
    id: `ol_${n}_${i}`, productId: pid, label: prod(pid).name, qty, unit: prod(pid).saleUnit, unitPrice: priceOf(pid), discountPct: disc || undefined,
    allocations: (al ?? []).map(([lotId, q]) => ({ lotId, qty: q })),
  }))
  const totals = (lines: OrderLine[], fee: number, depositPct: number) => {
    const subtotal = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)
    const discountTotal = Math.round(lines.reduce((a, l) => a + (l.qty * l.unitPrice * (l.discountPct ?? 0)) / 100, 0))
    const total = subtotal - discountTotal + fee
    return { subtotal, discountTotal, total, depositAmount: Math.round(total * (depositPct / 100)) }
  }
  type OSpec = { n: number; user: string; company?: string; lines: OL[]; zone: string; day: number; status: Order['status']; pay: Order['paymentStatus']; disc?: number; quote?: string; awaiting?: boolean; po?: string; reseller?: boolean; paid?: 'deposit' | 'full' | 'none' | 'refunded' }
  const orderSpecs: OSpec[] = [
    { n: 1, user: 'usr_pro1', company: 'co_batiplus', lines: [['prd_pave-hexa-20', 100, [['lot_1', 100]]], ['prd_bordure-jardin-100', 20, [['lot_2', 20]]]], zone: 'z_cotonou', day: -20, status: 'delivered', pay: 'paid', disc: 6, quote: 'q_1', paid: 'full', po: 'BC-BP-0412' },
    { n: 2, user: 'usr_client1', lines: [['prd_pave-hexa-20', 50, [['lot_1', 50]]]], zone: 'z_cotonou', day: -19, status: 'delivered', pay: 'paid', paid: 'full' },
    { n: 3, user: 'usr_pro2', company: 'co_terra', lines: [['prd_pave-hexa-20', 40, [['lot_1', 40]]], ['prd_bordure-jardin-100', 10, [['lot_2', 10]]]], zone: 'z_calavi', day: -4, status: 'shipped', pay: 'paid', disc: 6, quote: 'q_2', paid: 'full' },
    { n: 4, user: 'usr_pro1', company: 'co_batiplus', lines: [['prd_pave-hexa-20', 60, [['lot_1', 60]]], ['prd_bordure-jardin-100', 8, [['lot_2', 8]]]], zone: 'z_cotonou', day: -2, status: 'in_preparation', pay: 'deposit_paid', disc: 6, paid: 'deposit', po: 'BC-BP-0431' },
    { n: 5, user: 'usr_pro2', company: 'co_terra', lines: [['prd_dalle-allee-40', 40]], zone: 'z_calavi', day: -1, status: 'confirmed', pay: 'deposit_paid', disc: 6, awaiting: true, paid: 'deposit' },
    { n: 6, user: 'usr_client2', lines: [['prd_pave-hexa-20', 30]], zone: 'z_calavi', day: 0, status: 'pending_payment', pay: 'unpaid', quote: 'q_4', paid: 'none' },
    { n: 7, user: 'usr_client3', lines: [['prd_bordure-jardin-100', 10]], zone: 'z_portonovo', day: -12, status: 'cancelled', pay: 'unpaid', paid: 'none' },
    { n: 8, user: 'usr_pro3', company: 'co_hotel', lines: [['prd_pave-hexa-20', 30, [['lot_1', 30]]]], zone: 'z_ouidah', day: -9, status: 'disputed', pay: 'disputed', disc: 6, paid: 'full' },
    { n: 9, user: 'usr_distri', company: 'co_distri', lines: [['prd_bordure-jardin-100', 6, [['lot_2', 6]]]], zone: 'z_cotonou', day: -3, status: 'ready_to_ship', pay: 'paid', disc: 12, paid: 'full', reseller: true },
    { n: 10, user: 'usr_distri', company: 'co_distri', lines: [['prd_pave-rect-10', 400]], zone: 'z_cotonou', day: -1, status: 'confirmed', pay: 'deposit_paid', disc: 12, quote: 'q_3', awaiting: true, paid: 'deposit', reseller: true },
    { n: 11, user: 'usr_client1', lines: [['prd_dalle-jardin-50', 6]], zone: 'z_cotonou', day: 0, status: 'pending_payment', pay: 'unpaid', paid: 'none' },
    { n: 12, user: 'usr_client2', lines: [['prd_dalle-allee-40', 12]], zone: 'z_calavi', day: -10, status: 'cancelled', pay: 'refunded', paid: 'refunded' },
  ]
  let payN = 0, invN = 0
  for (const o of orderSpecs) {
    const lines = mkLines(o.n, o.lines, o.disc ?? 0)
    const fee = zoneFee(o.zone)
    const t = totals(lines, fee, 30)
    const company = o.company
    const delId = ({ 1: 'del_1', 2: 'del_2', 3: 'del_3', 4: 'del_4', 8: 'del_5', 9: 'del_6' } as Record<number, string>)[o.n]
    const tl: HistoryEntry[] = [he(d(o.day), 'Commande créée', s.users.find((u) => u.id === o.user)!.name, undefined, o.user)]
    if (o.status !== 'pending_payment') tl.push(he(d(o.day, 12), 'Acompte enregistré (simulé)', 'Système'))
    if (['in_preparation', 'ready_to_ship', 'shipped', 'delivered', 'disputed'].includes(o.status)) tl.push(he(d(o.day + 1), 'Envoyée en préparation', 'Koffi Mensah'))
    if (['shipped', 'delivered', 'disputed'].includes(o.status)) tl.push(he(d(o.day + 3), 'Expédiée', 'Ibrahim Alassane'))
    if (o.status === 'delivered' || o.status === 'disputed') tl.push(he(d(o.day + 5), 'Livrée', 'Ibrahim Alassane'))
    const paidAmount = o.paid === 'full' ? t.total : o.paid === 'deposit' ? t.depositAmount : 0
    const order: Order = {
      id: `ord_${o.n}`, ref: `CMD-2026-${String(o.n).padStart(4, '0')}`, quoteId: o.quote, userId: o.user, companyId: company, lines,
      deliveryAddress: addr(company ? 'Chantier ' + o.n : 'Domicile du client', settings.zones.find((q) => q.id === o.zone)!.name, o.zone), status: o.status, paymentStatus: o.pay,
      subtotal: t.subtotal, discountTotal: t.discountTotal, deliveryFee: fee, total: t.total, depositPct: 30, depositAmount: t.depositAmount, amountPaid: paidAmount, currency: 'XOF',
      requiresReleasedLot: true, awaitingStock: o.awaiting, deliveryId: delId, purchaseOrderRef: o.po, resellerOrder: o.reseller, timeline: tl, createdAt: d(o.day), updatedAt: d(o.day + 1), demo: true,
    }
    s.orders.push(order)
    const pay = (kind: Payment['kind'], amount: number, at: number, method: Payment['method'], status: Payment['status'] = 'succeeded'): Payment => ({
      id: `pay_${++payN}`, ref: `SIM-2026-${String(payN).padStart(4, '0')}`, orderId: order.id, userId: o.user, amount, kind, method, status, simulated: true, createdAt: d(at), paidAt: status === 'succeeded' || status === 'refunded' ? d(at) : undefined, note: 'Paiement simulé',
    })
    if (o.paid === 'full') {
      s.payments.push(pay('deposit', t.depositAmount, o.day, 'mobile_money'), pay('balance', t.total - t.depositAmount, o.day + 2, 'bank_transfer'))
    } else if (o.paid === 'deposit') s.payments.push(pay('deposit', t.depositAmount, o.day, 'mobile_money'))
    else if (o.paid === 'refunded') {
      s.payments.push(pay('deposit', t.depositAmount, o.day, 'mobile_money', 'refunded'), pay('refund', t.depositAmount, o.day + 2, 'mobile_money', 'refunded'))
    }
    if (o.status !== 'cancelled') {
      const inv: Invoice = {
        id: `inv_${++invN}`, ref: `FAC-SIM-2026-${String(invN).padStart(4, '0')}`, orderId: order.id, userId: o.user, companyId: company, amount: t.total, purchaseOrderRef: o.po,
        status: o.pay === 'paid' ? 'paid' : o.status === 'disputed' ? 'overdue' : 'issued', issuedAt: d(o.day), dueAt: d(o.day + (company ? 30 : 7)), paidAt: o.pay === 'paid' ? d(o.day + 2) : undefined, simulated: true, createdAt: d(o.day),
      }
      s.invoices.push(inv)
    }
  }
  // Un acompte « refunded » réglé puis remboursé ne compte pas dans amountPaid (cf. commande 12) ; l'ordre 8 reste payé mais en litige.

  const Q = (n: number, status: Quote['status'], user: string | undefined, company: string | undefined, contact: [string, string], lines: [string, number, number | null][], day: number, x: Partial<Quote> = {}): Quote => ({
    id: `q_${n}`, ref: `DV-2026-${String(n).padStart(4, '0')}`, requesterUserId: user, companyId: company, contact: { name: contact[0], email: contact[1], phone: '+229 01 00 00 00 80' },
    deliveryAddress: addr('Adresse de livraison fictive', 'Cotonou', 'z_cotonou'), lines: lines.map(([pid, qty, price], i) => ({ id: `ql_${n}_${i}`, productId: pid, label: prod(pid).name, qty, unit: prod(pid).saleUnit, unitPrice: price })),
    status, discountPct: company ? 6 : 0, deliveryFee: 15000, depositPct: 30, currency: 'XOF', negotiation: [], history: [he(d(day), 'Demande de devis reçue', contact[0])], createdAt: d(day), updatedAt: d(day + 1), demo: true,
    assignedTo: status === 'requested' ? undefined : 'usr_sales', ...x,
  })
  s.quotes.push(
    Q(1, 'converted', 'usr_pro1', 'co_batiplus', ['Désiré Akpo', 'pro@ecobloc.demo'], [['prd_pave-hexa-20', 100, 450], ['prd_bordure-jardin-100', 20, 3200]], -24, { orderId: 'ord_1', validUntil: d(5), history: [he(d(-24), 'Demande reçue'), he(d(-23), 'Devis envoyé', 'Koffi Mensah'), he(d(-22), 'Accepté (simulation)'), he(d(-20), 'Converti en commande')] }),
    Q(2, 'converted', 'usr_pro2', 'co_terra', ['Ernest Vodounnou', 'pro2@ecobloc.demo'], [['prd_pave-hexa-20', 40, 450], ['prd_bordure-jardin-100', 10, 3200]], -9, { orderId: 'ord_3' }),
    Q(3, 'converted', 'usr_distri', 'co_distri', ['Moussa Bio Sika', 'distributeur@ecobloc.demo'], [['prd_pave-rect-10', 400, 250]], -5, { orderId: 'ord_10', discountPct: 12 }),
    Q(4, 'converted', 'usr_client2', undefined, ['Jean-Baptiste Hounkpatin', 'client2@ecobloc.demo'], [['prd_pave-hexa-20', 30, 450]], -3, { orderId: 'ord_6', discountPct: 0 }),
    Q(5, 'sent', 'usr_pro2', 'co_terra', ['Ernest Vodounnou', 'pro2@ecobloc.demo'], [['prd_pave-renforce-80', 500, 760]], -3, { validUntil: d(27), customerNotes: 'Accès chantier à confirmer.', internalNotes: 'Produit en essais : devis exploratoire sous réserve de validation.', negotiation: [{ id: 'm1', userName: 'Koffi Mensah', at: d(-2), body: 'Devis envoyé sous réserve de la validation du produit.' }] }),
    Q(6, 'in_review', 'usr_pro3', 'co_hotel', ['Sylvie Dansou', 'pro3@ecobloc.demo'], [['prd_dalle-terrasse-60', 150, null], ['prd_dalle-allee-40', 80, null]], -1),
    Q(7, 'requested', undefined, undefined, ['Visiteur — Prosper Gbèdo', 'prosper@exemple.demo'], [['prd_bordure-jardin-100', 60, null]], 0, { customerNotes: 'Délimitation d’une cour d’école (projet fictif).', assignedTo: undefined }),
    Q(8, 'requested', 'usr_client1', undefined, ['Marie-Claire Ahouandjinou', 'client@ecobloc.demo'], [['prd_dalle-terrasse-60', 40, null]], 0, { assignedTo: undefined }),
    Q(9, 'declined', 'usr_pro3', 'co_hotel', ['Sylvie Dansou', 'pro3@ecobloc.demo'], [['prd_pave-hexa-20', 800, 450]], -30, { declineReason: 'Budget insuffisant pour ce trimestre.' }),
    Q(10, 'expired', 'usr_distri', 'co_distri', ['Moussa Bio Sika', 'distributeur@ecobloc.demo'], [['prd_dalle-jardin-50', 120, 2400]], -50, { validUntil: d(-20) }),
  )

  // ===================================================================== Livraisons
  const DL = (n: number, order: string, status: Delivery['status'], carrier: string | undefined, planned: number, lots: string[], x: Partial<Delivery> = {}): Delivery => {
    const o = s.orders.find((q) => q.id === order)!
    return { id: `del_${n}`, ref: `LIV-2026-${String(n).padStart(4, '0')}`, orderId: order, carrierId: carrier, driverName: carrier ? 'Chauffeur ' + carrier.slice(4) : undefined, status, plannedDate: d(planned, 9), address: o.deliveryAddress, fee: o.deliveryFee, lotIds: lots, incidents: [], history: [he(d(planned - 1), 'Livraison créée', 'Système')], demo: true, ...x }
  }
  s.deliveries.push(
    DL(1, 'ord_1', 'delivered', 'car_3', -15, ['lot_1', 'lot_2'], { shippedAt: d(-15, 8), deliveredAt: d(-15, 14), proof: { receivedBy: 'Désiré Akpo', note: 'Palettes conformes au bon de livraison.', at: d(-15, 14) } }),
    DL(2, 'ord_2', 'delivered', 'car_3', -14, ['lot_1'], { shippedAt: d(-14, 9), deliveredAt: d(-14, 13), proof: { receivedBy: 'Marie-Claire Ahouandjinou', at: d(-14, 13) } }),
    DL(3, 'ord_3', 'in_transit', 'car_1', -1, ['lot_1', 'lot_2'], { shippedAt: d(-1, 9), tourRef: 'TRN-L-0007' }),
    DL(4, 'ord_4', 'preparing', undefined, 1, ['lot_1', 'lot_2']),
    DL(5, 'ord_8', 'delivered', 'car_2', -4, ['lot_1'], { shippedAt: d(-4, 8), deliveredAt: d(-4, 15), proof: { receivedBy: 'Sylvie Dansou', note: 'Réserves émises à la réception.', at: d(-4, 15) }, incidents: [{ id: 'inc_1', at: d(-4, 15), type: 'damage', description: 'Plusieurs pièces écornées signalées à la réception.', resolved: false }] }),
    DL(6, 'ord_9', 'planned', 'car_2', 2, ['lot_2']),
  )
  s.orders.find((o) => o.id === 'ord_5')!.deliveryId = undefined

  // ===================================================================== Réclamations
  const th = (name: string, body: string, at: number) => ({ id: `m_${hash(body)}`, userName: name, at: d(at), body })
  s.claims.push(
    { id: 'sup_c1', ref: 'SUP-2026-0001', userId: 'usr_pro3', companyId: 'co_hotel', orderId: 'ord_8', deliveryId: 'del_5', kind: 'quality', subject: 'Pièces écornées à la livraison', priority: 'high', status: 'in_review', thread: [th('Sylvie Dansou', 'Plusieurs pavés sont écornés sur deux palettes.', -4), th('Koffi Mensah', 'Nous prenons en charge l’analyse du lot et reviendrons vers vous.', -3)], assignedTo: 'usr_sales', createdAt: d(-4), updatedAt: d(-3), demo: true },
    { id: 'sup_c2', ref: 'SUP-2026-0002', userId: 'usr_client2', orderId: 'ord_12', kind: 'payment', subject: 'Remboursement de l’acompte', priority: 'normal', status: 'resolved', thread: [th('Jean-Baptiste Hounkpatin', 'J’ai annulé ma commande, quand sera remboursé l’acompte ?', -9), th('Koffi Mensah', 'Remboursement simulé effectué.', -8)], assignedTo: 'usr_sales', createdAt: d(-9), updatedAt: d(-8), demo: true },
    { id: 'sup_c3', ref: 'SUP-2026-0003', userId: 'usr_coll2', kind: 'collection', subject: 'Écart entre quantité déclarée et pesée', priority: 'normal', status: 'open', thread: [th('Fatou Kora', 'Ma pesée est inférieure à ce que j’avais déclaré.', -5)], createdAt: d(-5), updatedAt: d(-5), demo: true },
    { id: 'sup_c4', ref: 'SUP-2026-0004', userId: 'usr_distri', companyId: 'co_distri', orderId: 'ord_9', kind: 'delivery', subject: 'Date de livraison à confirmer', priority: 'low', status: 'open', thread: [th('Moussa Bio Sika', 'Pouvez-vous confirmer le créneau de livraison ?', -1)], createdAt: d(-1), updatedAt: d(-1), demo: true },
    { id: 'sup_c5', ref: 'SUP-2026-0005', userId: 'usr_pro1', companyId: 'co_batiplus', orderId: 'ord_1', kind: 'billing', subject: 'Numéro de bon de commande sur la facture', priority: 'low', status: 'resolved', thread: [th('Désiré Akpo', 'Le numéro de BC manque sur la facture fictive.', -17), th('Koffi Mensah', 'Facture simulée régénérée avec le numéro de BC.', -16)], createdAt: d(-17), updatedAt: d(-16), demo: true },
  )

  // ===================================================================== Mouvements de stock (dérivés des données)
  let mv = 0
  const M = (m: Omit<StockMovement, 'id'>) => s.stockMovements.push({ id: `mov_${++mv}`, ...m })
  for (const l of s.rawLots) M({ at: l.receivedAt, type: 'in', itemKind: 'raw', itemId: l.id, qty: l.kgInitial, unit: 'kg', toLocationId: l.locationId, refType: 'receipt', refId: l.receiptId, userId: 'usr_appro', note: l.status === 'rejected' ? 'Entrée en zone de quarantaine puis rejet' : undefined })
  for (const lot of s.productionLots) {
    for (const ri of lot.rawInputs) M({ at: lot.producedAt, type: 'out', itemKind: 'raw', itemId: ri.rawLotId, qty: ri.kg, unit: 'kg', refType: 'work_order', refId: lot.workOrderId, userId: 'usr_prod', note: 'Consommation en production' })
    M({ at: lot.producedAt, type: 'in', itemKind: 'finished', itemId: lot.id, qty: lot.producedQty, unit: 'unit', toLocationId: lot.locationId, refType: 'work_order', refId: lot.workOrderId, userId: 'usr_prod' })
  }
  for (const w of s.workOrders) for (const r of w.reservations) M({ at: w.plannedStart, type: 'reservation', itemKind: 'raw', itemId: r.rawLotId, qty: r.kg, unit: 'kg', refType: 'work_order', refId: w.id, userId: 'usr_prod' })
  for (const o of s.orders) for (const l of o.lines) for (const a of l.allocations) {
    const shipped = ['shipped', 'delivered', 'disputed'].includes(o.status)
    M({ at: shipped ? d(0, 8) : o.updatedAt, type: shipped ? 'out' : 'reservation', itemKind: 'finished', itemId: a.lotId, qty: a.qty, unit: 'unit', refType: 'order', refId: o.id, userId: 'usr_logi' })
  }
  M({ at: d(-7), type: 'loss', itemKind: 'raw', itemId: 'rlot_12', qty: 0, unit: 'kg', userId: 'usr_appro', note: 'Contrôle d’écart : aucun écart constaté' })
  s.stockMovements.sort((a, b) => b.at.localeCompare(a.at))

  // ===================================================================== Environnement
  const polys: PolymerCode[] = ['PET', 'HDPE', 'PP', 'LDPE']
  const octRec = (p: PolymerCode): Omit<EnvRecord, 'id' | 'period' | 'polymer' | 'validated' | 'validatedBy' | 'demo' | 'notes'> => {
    const rls = s.receipts.flatMap((r) => r.lines.filter((l) => l.polymer === p))
    const lotsP = s.rawLots.filter((l) => l.polymer === p)
    const used = lotsP.reduce((a, l) => a + l.kgConsumed, 0)
    return { receivedKg: rls.reduce((a, l) => a + l.weighedKg, 0), acceptedKg: rls.reduce((a, l) => a + l.acceptedKg, 0), rejectedKg: rls.reduce((a, l) => a + l.rejectedKg, 0), usedInProductionKg: used, finishedUnits: Math.round(used / 2.9), finishedKg: Math.round(used * 0.93), lossKg: Math.round(used * 0.07) }
  }
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  months.forEach((period, mi) => {
    polys.forEach((p, pi) => {
      const f = 0.12 + mi * 0.13
      const base = ({ PET: 900, HDPE: 700, PP: 520, LDPE: 260 } as Partial<Record<PolymerCode, number>>)[p] ?? 0
      const rec = mi === 5 ? octRec(p) : (() => {
        const received = Math.round(base * f + pi * 11); const rejected = Math.round(received * (0.05 + pi * 0.008)); const accepted = received - rejected - (mi % 2 ? 6 : 0)
        const used = Math.round(accepted * 0.82)
        return { receivedKg: received, acceptedKg: accepted, rejectedKg: rejected, usedInProductionKg: used, finishedUnits: Math.round(used / 2.9), finishedKg: Math.round(used * 0.93), lossKg: Math.round(used * 0.07) }
      })()
      s.envRecords.push({ id: `env_${period}_${p}`, period, polymer: p, ...rec, validated: mi < 4, validatedBy: mi < 4 ? 'usr_env' : undefined, demo: true })
    })
  })
  const sumEnv = (f: (r: EnvRecord) => number, until = '2026-09') => s.envRecords.filter((r) => r.period <= until).reduce((a, r) => a + f(r), 0)
  const METHOD_COMMON = 'Quantités mesurées à la pesée à la réception et en production, consolidées par mois et par polymère. Aucun calcul d’économie de carbone ni de comparaison avec d’autres matériaux n’est effectué.'
  const IND = (id: string, key: string, label: string, value: number, unit: string, status: EnvIndicator['status'], method: string): EnvIndicator => ({ id, key, label, value, unit, periodFrom: '2026-05', periodTo: '2026-09', methodology: `${method} ${METHOD_COMMON}`, evidenceDocumentIds: status === 'draft' ? [] : ['doc_proof_env'], status, approvedBy: status === 'published' ? 'usr_env' : undefined, approvedAt: status === 'published' ? d(-6) : undefined, demo: true })
  s.envIndicators.push(
    IND('ind_received', 'received_kg', 'Plastique reçu', Math.round(sumEnv((r) => r.receivedKg)), 'kg', 'published', 'Somme des pesées enregistrées à la réception.'),
    IND('ind_rejection', 'rejection_rate', 'Taux de rejet à la réception', Math.round((sumEnv((r) => r.rejectedKg) / sumEnv((r) => r.receivedKg)) * 1000) / 10, '%', 'validated', 'Rejets pesés divisés par les quantités reçues.'),
    IND('ind_used', 'used_kg', 'Matière utilisée en production', Math.round(sumEnv((r) => r.usedInProductionKg)), 'kg', 'validated', 'Somme des consommations de matière enregistrées sur les ordres de fabrication clôturés.'),
    IND('ind_units', 'finished_units', 'Pièces finies fabriquées', Math.round(sumEnv((r) => r.finishedUnits)), 'pièces', 'draft', 'Pièces comptées à la clôture des ordres de fabrication, hors rebuts.'),
  )

  // ===================================================================== Commercial
  const PR = (id: string, name: string, company: string, source: Prospect['source'], interest: Prospect['interest'], status: Prospect['status'], value: number, day: number, next?: number): Prospect => ({ id, name, company, email: `${id.slice(3)}@exemple.demo`, phone: '+229 01 00 00 00 90', source, interest, status, ownerId: 'usr_sales', estimatedValue: value, nextFollowUpAt: next != null ? d(next) : undefined, notes: 'Prospect fictif de démonstration.', createdAt: d(day), demo: true })
  s.prospects.push(
    PR('pro_1', 'Gérard Agbo', 'Immo Littoral (démo)', 'site', 'quote', 'new', 1800000, 0, 1),
    PR('pro_2', 'Aïcha Moumouni', 'Résidences Soleil (démo)', 'referral', 'quote', 'contacted', 2400000, -6, 2),
    PR('pro_3', 'Cédric Dossa', 'Mairie annexe (démo)', 'event', 'pro_services', 'qualified', 4200000, -14, 3),
    PR('pro_4', 'Pélagie Hodonou', 'Quincaillerie Centrale (démo)', 'distributor_request', 'distributor', 'contacted', 900000, -9, -1),
    PR('pro_5', 'Yannick Fassinou', 'Paysages & Jardins (démo)', 'outbound', 'quote', 'qualified', 650000, -11, 4),
    PR('pro_6', 'Rachidatou Idrissou', 'Lotissement Les Acacias (démo)', 'site', 'quote', 'won', 1200000, -35),
    PR('pro_7', 'Sévérin Tokpanou', 'Entreprise Tokpa BTP (démo)', 'referral', 'quote', 'lost', 3000000, -40),
    PR('pro_8', 'Noëlla Gbaguidi', 'Hôtel Bord de Mer (démo)', 'site', 'contact', 'new', 0, 0, 2),
  )
  const IT = (n: number, kind: Interaction['kind'], type: Interaction['subjectType'], id: string, day: number, summary: string, due?: number, done?: boolean): Interaction => ({ id: `int_${n}`, kind, subjectType: type, subjectId: id, userId: 'usr_sales', at: d(day), summary, dueAt: due != null ? d(due) : undefined, done })
  s.interactions.push(
    IT(1, 'call', 'prospect', 'pro_2', -6, 'Premier appel : besoin de 3 000 pavés pour une résidence.'), IT(2, 'reminder', 'prospect', 'pro_2', -6, 'Envoyer la fiche produit Pavé Hexa 20.', 2, false),
    IT(3, 'meeting', 'prospect', 'pro_3', -13, 'Visite de site fictive.'), IT(4, 'email', 'prospect', 'pro_3', -12, 'Envoi de la documentation produit.'), IT(5, 'reminder', 'prospect', 'pro_3', -12, 'Relance après envoi du devis.', 3, false),
    IT(6, 'note', 'company', 'co_batiplus', -20, 'Client ayant passé sa première commande ; intéressé par des volumes plus importants.'), IT(7, 'call', 'company', 'co_terra', -9, 'Suivi après devis.'),
    IT(8, 'reminder', 'quote', 'q_5', -2, 'Relancer sur le devis du pavé renforcé (produit en essais).', 3, false), IT(9, 'email', 'quote', 'q_5', -3, 'Devis envoyé au client.'),
    IT(10, 'reminder', 'prospect', 'pro_4', -9, 'Rappeler pour les conditions distributeur.', -1, false), IT(11, 'call', 'prospect', 'pro_4', -9, 'Intéressé par un contrat distributeur.'),
    IT(12, 'note', 'company', 'co_hotel', -4, 'Réclamation en cours : suivre le dossier SUP-2026-0001.'), IT(13, 'meeting', 'company', 'co_distri', -15, 'Revue trimestrielle des conditions de distribution.'),
    IT(14, 'reminder', 'quote', 'q_6', -1, 'Chiffrer les dalles pour l’hôtel.', 1, false), IT(15, 'reminder', 'prospect', 'pro_1', 0, 'Qualifier le besoin sous 48 h.', 2, false),
  )

  // ===================================================================== Contenu public
  const F = (n: number, category: string, question: string, answer: string): FaqItem => ({ id: `faq_${n}`, category, question, answer, order: n, published: true })
  s.faqs.push(
    F(1, 'Entreprise', 'Qui est EcoBloc ?', 'EcoBloc est le nom de travail d’un projet de transformation de déchets plastiques en matériaux d’aménagement non structurels, au Bénin puis en Afrique de l’Ouest. Ce site est un prototype : les données qu’il affiche sont fictives.'),
    F(2, 'Produits', 'Les produits sont-ils certifiés ?', 'Non. Un matériau recyclé n’est ni testé ni certifié par défaut. Chaque produit affiche son statut : en développement, en test, résultats disponibles ou autorisé à la commercialisation selon notre processus interne. Les données techniques et certifications doivent être confirmées avant toute commercialisation.'),
    F(3, 'Produits', 'Peut-on utiliser ces produits pour des murs ou des éléments porteurs ?', 'Non. Les produits présentés sont non structurels. Aucun usage porteur ou sensible n’est proposé sans preuves, validations et autorisations appropriées.'),
    F(4, 'Commande', 'Comment demander un devis ?', 'Ajoutez des produits à votre liste, renseignez les quantités et l’adresse de livraison, puis envoyez la demande. Notre équipe commerciale prépare un devis que vous consultez dans votre espace.'),
    F(5, 'Commande', 'Quels sont les délais de livraison ?', 'Les délais sont indicatifs et à confirmer à chaque devis, selon la zone et la disponibilité des lots libérés.'),
    F(6, 'Commande', 'Les paiements sont-ils réels ?', 'Non. Dans ce prototype, tous les paiements, factures et remboursements sont simulés. Aucune transaction réelle n’est effectuée.'),
    F(7, 'Traçabilité', 'Comment fonctionne la traçabilité par lot ?', 'Chaque lot de produits finis est relié aux lots de matière première utilisés, à son ordre de fabrication, à son contrôle qualité et aux livraisons qui en sont issues.'),
    F(8, 'Traçabilité', 'Un lot non contrôlé peut-il être vendu ?', 'Non. Seuls les lots libérés par le contrôle qualité, associés à un produit autorisé, peuvent alimenter une commande.'),
    F(9, 'Collecte', 'Quels plastiques acceptez-vous ?', 'Les types de polymères acceptés et leurs critères sont configurables. Actuellement : PET, PEHD, PP et PEBD propres. Le PVC, le PS et les plastiques non identifiés ne sont pas acceptés.'),
    F(10, 'Collecte', 'Comment devenir collecteur ?', 'Créez un compte collecteur ou envoyez la demande depuis la page « Devenir collecteur ». Votre profil est validé par l’équipe approvisionnement avant les premières collectes.'),
    F(11, 'Collecte', 'Les collecteurs sont-ils rémunérés ?', 'Un modèle d’achat au kilo peut être configuré. Dans le prototype, la rémunération est simulée après validation des quantités pesées et acceptées.'),
    F(12, 'Partenaires', 'Comment devenir distributeur ?', 'Envoyez une demande depuis la page « Devenir distributeur ». Les conditions (tarifs, volumes, zones) sont définies avec l’équipe commerciale.'),
    F(13, 'Impact', 'Quels indicateurs d’impact publiez-vous ?', 'Uniquement des quantités mesurées (kilos reçus, acceptés, utilisés, rebuts, pièces fabriquées), avec leur méthodologie. Nous ne publions pas d’économie de carbone sans méthode documentée.'),
    F(14, 'Entreprise', 'Où se trouvent les données de ce site ?', 'Ce sont des données de démonstration. Elles sont enregistrées dans votre navigateur ou, si la base est connectée, dans la base du prototype.'),
  )
  const CS = (n: number, title: string, sector: string, summary: string, challenge: string, approach: string, outcome: string): CaseStudy => ({ id: `cs_${n}`, title, sector, summary, challenge, approach, outcome, published: true, fictional: true })
  s.caseStudies.push(
    CS(1, 'Allée piétonne d’une résidence', 'Résidentiel', 'Cas fictif : des pavés pour une allée d’accès piétonne.', 'Une résidence souhaite remplacer une allée en terre battue sans augmenter fortement son budget.', 'Pose de pavés de 20 cm sur lit de sable, avec suivi du lot livré.', 'Cas démonstratif : aucun résultat réel. Il illustre le parcours devis, livraison et traçabilité.'),
    CS(2, 'Jardin partagé de quartier', 'Collectivités', 'Cas fictif : bordures et dalles pour un jardin communautaire.', 'Délimiter des planches et créer des cheminements simples.', 'Combinaison de bordures de 1 m et de dalles de 40 cm.', 'Cas démonstratif : illustre l’usage non structurel du catalogue.'),
    CS(3, 'Lotissement pilote', 'Promotion immobilière', 'Cas fictif : bordures pour un lotissement en cours d’aménagement.', 'Livrer par tranches avec une documentation de lot pour chaque livraison.', 'Commandes en volume avec calendrier de livraison et justificatifs.', 'Cas démonstratif : aucun contrat réel.'),
    CS(4, 'Circuit de collecte d’une coopérative', 'Collecte', 'Cas fictif : organiser des enlèvements réguliers de plastiques triés.', 'Rendre visibles les quantités pesées et acceptées pour les collecteurs.', 'Demandes d’enlèvement, tournée, pesée à la réception et justificatif.', 'Cas démonstratif : illustre le portail collecteur.'),
  )
  const CB = (key: string, title: string, body: string): ContentBlock => ({ id: `cb_${key.replace('.', '_')}`, key, title, body, published: true, updatedAt: d(-10) })
  s.contentBlocks.push(
    CB('home.hero', 'Accueil — titre', 'Des pavés, dalles et bordures nés de plastiques collectés au Bénin.'),
    CB('home.promise', 'Accueil — engagements', 'Chaque lot est tracé de la collecte à la livraison. Chaque produit affiche son niveau de validation. Rien n’est vendu sans contrôle qualité.'),
    CB('about.story', 'À propos — histoire', 'EcoBloc est un projet de valorisation de déchets plastiques en matériaux d’aménagement non structurels. Ce site est un prototype : la fabrication, les contrats et les certifications présentés sont fictifs.'),
    CB('materials.intro', 'Matériaux — introduction', 'Les plastiques collectés sont triés, contrôlés, broyés puis transformés. Un matériau recyclé n’est ni testé ni certifié par défaut : chaque étape est documentée.'),
    CB('traceability.intro', 'Traçabilité — introduction', 'Du lot de matière au lot de produits livrés : chaque maillon est consultable.'),
    CB('impact.method', 'Impact — méthodologie', METHOD_COMMON),
    CB('legal.terms', 'Conditions générales', 'Conditions de démonstration. Aucune vente réelle ne peut être conclue via ce prototype. Les prix sont indicatifs, les paiements simulés, les délais à confirmer.'),
    CB('legal.privacy', 'Politique de confidentialité', 'Ce prototype enregistre vos données de démonstration dans votre navigateur et, si la base est connectée, dans la base du prototype. N’y saisissez pas de données personnelles réelles sensibles.'),
  )

  // ===================================================================== Notifications, favoris, audit
  const N = (n: number, roles: RoleKey[] | undefined, userId: string | undefined, level: Notification['level'], title: string, body: string, day: number, href?: string): Notification => ({ id: `not_${n}`, roles, userId, level, title, body, at: d(day, 9), read: n % 3 === 0, href })
  s.notifications.push(
    N(1, ['sales'], undefined, 'info', 'Nouvelle demande de devis', 'DV-2026-0007 attend une prise en charge.', 0, '/ops/commercial/devis/q_7'),
    N(2, ['sales'], undefined, 'info', 'Nouvelle demande de devis', 'DV-2026-0008 attend une prise en charge.', 0, '/ops/commercial/devis/q_8'),
    N(3, ['production', 'procurement'], undefined, 'warning', 'Stock matière à surveiller', 'Le stock disponible de PET passe sous le seuil d’alerte.', -1, '/ops/appro/stock'),
    N(4, ['quality'], undefined, 'info', 'Lot en attente de contrôle', 'LOT-2026-0005 attend une demande de contrôle.', -2, '/ops/qualite/controles/qc_5'),
    N(5, ['procurement'], undefined, 'info', 'Collecte à examiner', 'COL-2026-0009 vient d’être déposée.', 0, '/ops/appro/demandes/col_9'),
    N(6, ['logistics'], undefined, 'warning', 'Incident de livraison', 'Pièces écornées signalées sur LIV-2026-0005.', -4, '/ops/logistique/incidents'),
    N(7, undefined, 'usr_pro2', 'success', 'Devis disponible', 'Votre devis DV-2026-0005 est prêt.', -2, '/espace/devis/q_5'),
    N(8, undefined, 'usr_pro1', 'info', 'Commande en préparation', 'CMD-2026-0004 est en préparation.', -1, '/espace/commandes/ord_4'),
    N(9, undefined, 'usr_coll1', 'info', 'Collecte planifiée', 'COL-2026-0006 est prévue dans deux jours.', -2, '/collecte/demandes/col_6'),
    N(10, undefined, 'usr_driver1', 'info', 'Nouvelle collecte', 'Tournée du jour : 3 collectes.', 0, '/terrain'),
    N(11, ['environment'], undefined, 'info', 'Indicateurs à valider', 'Les données de septembre attendent votre validation.', -3, '/ops/environnement/publication'),
    N(12, ['admin'], undefined, 'warning', 'Fournisseur en attente', 'Atelier Ouidah Recyclage attend une validation.', -3, '/admin/partenaires'),
    N(13, undefined, 'usr_client1', 'info', 'Commande créée', 'CMD-2026-0011 attend votre paiement simulé.', 0, '/espace/commandes/ord_11'),
    N(14, ['production'], undefined, 'danger', 'Panne broyeur', 'OF-2026-0007 est en pause.', -1, '/ops/production/ordres/of_7'),
    N(15, ['sales'], undefined, 'warning', 'Relance en retard', 'Rappeler Quincaillerie Centrale (démo).', -1, '/ops/commercial/relances'),
  )
  for (const pid of ['prd_pave-hexa-20', 'prd_dalle-allee-40', 'prd_bordure-jardin-100', 'prd_dalle-terrasse-60']) s.favorites.push({ id: `fav_${pid.slice(4)}`, userId: 'usr_client1', productId: pid, createdAt: d(-8) } as Favorite)

  const A = (n: number, userId: string, userName: string, role: RoleKey, action: AuditEntry['action'], entity: string, entityId: string, summary: string, day: number): AuditEntry => ({ id: `aud_${n}`, at: d(day, 9 + (n % 8)), userId, userName, role, action, entity, entityId, summary })
  let an = 0
  for (const o of s.orders) {
    const u = s.users.find((x) => x.id === o.userId)!
    s.auditLog.push(A(++an, u.id, u.name, u.role, 'create', 'orders', o.id, `Création · ${o.ref}`, Math.round((Date.parse(o.createdAt) - T0) / 86400000)))
  }
  for (const l of s.productionLots) if (l.releasedAt) s.auditLog.push(A(++an, 'usr_qual', 'Chantal Tossou', 'quality', 'status', 'productionLots', l.id, `Statut · ${l.ref} → released`, Math.round((Date.parse(l.releasedAt) - T0) / 86400000)))
  for (const w of s.workOrders) s.auditLog.push(A(++an, 'usr_prod', 'Hervé Gbaguidi', 'production', 'create', 'workOrders', w.id, `Création · ${w.ref}`, Math.round((Date.parse(w.createdAt) - T0) / 86400000)))
  for (const r of s.receipts) s.auditLog.push(A(++an, 'usr_appro', 'Raïssa Dossou', 'procurement', 'create', 'receipts', r.id, `Création · ${r.ref}`, Math.round((Date.parse(r.receivedAt) - T0) / 86400000)))
  for (const p of s.products.slice(0, 6)) s.auditLog.push(A(++an, 'usr_admin', 'Awa Adjovi', 'admin', 'update', 'products', p.id, `Modification · ${p.ref} (validation, documents)`, -12))
  s.auditLog.push(A(++an, 'usr_admin', 'Awa Adjovi', 'admin', 'permission', 'users', 'usr_pro1b', 'Rôle d’équipe attribué · Larissa Tchibozo (acheteur)', -30), A(++an, 'usr_env', 'Estelle Agbodjan', 'environment', 'status', 'envIndicators', 'ind_received', 'Statut · Plastique reçu → published', -6))
  s.auditLog.sort((a, b) => b.at.localeCompare(a.at))

  return s
}
