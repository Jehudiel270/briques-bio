/**
 * Carte des routes et navigation d'EcoBloc.
 * Chaque entrée DOIT correspondre à un fichier de page existant (voir docs/CONTRACTS.md).
 */
import type { RoleKey } from '../../shared/types/domain'

export interface NavItem {
  label: string
  to: string
  icon: string // nom Lucide sans préfixe
  roles?: RoleKey[] // si absent : tous les rôles de la zone
  /** Route enfant considérée comme active (préfixe) */
  match?: string
  exact?: boolean
}
export interface NavGroup {
  title?: string
  items: NavItem[]
}

// -------------------------------------------------------------- Vitrine publique
export const PUBLIC_NAV: NavItem[] = [
  { label: 'Catalogue', to: '/catalogue', icon: 'layout-grid', match: '/catalogue' },
  { label: 'Matériaux', to: '/materiaux', icon: 'recycle' },
  { label: 'Traçabilité', to: '/tracabilite', icon: 'qr-code' },
  { label: 'Impact', to: '/impact', icon: 'chart-no-axes-combined' },
  { label: 'Services pros', to: '/services-pro', icon: 'hard-hat' },
]
export const PUBLIC_MORE: NavItem[] = [
  { label: 'Notre démarche', to: '/environnement', icon: 'leaf' },
  { label: 'Études de cas', to: '/etudes-de-cas', icon: 'book-open-check' },
  { label: 'Devenir collecteur', to: '/devenir-collecteur', icon: 'truck' },
  { label: 'Devenir distributeur', to: '/devenir-distributeur', icon: 'store' },
  { label: 'Comparer des produits', to: '/comparer', icon: 'columns-3' },
  { label: 'Questions fréquentes', to: '/faq', icon: 'circle-help' },
  { label: 'À propos', to: '/a-propos', icon: 'building-2' },
  { label: 'Contact', to: '/contact', icon: 'mail' },
]
export const PUBLIC_FOOTER: NavGroup[] = [
  { title: 'Produits', items: [
    { label: 'Catalogue', to: '/catalogue', icon: 'layout-grid' },
    { label: 'Comparer', to: '/comparer', icon: 'columns-3' },
    { label: 'Demander un devis', to: '/devis', icon: 'file-text' },
    { label: 'Ma liste de produits', to: '/panier', icon: 'shopping-basket' },
  ] },
  { title: 'Matière & qualité', items: [
    { label: 'Nos matériaux', to: '/materiaux', icon: 'recycle' },
    { label: 'Traçabilité et qualité', to: '/tracabilite', icon: 'qr-code' },
    { label: 'Démarche environnementale', to: '/environnement', icon: 'leaf' },
    { label: 'Tableau d’impact', to: '/impact', icon: 'chart-no-axes-combined' },
  ] },
  { title: 'Partenaires', items: [
    { label: 'Devenir collecteur', to: '/devenir-collecteur', icon: 'truck' },
    { label: 'Devenir distributeur', to: '/devenir-distributeur', icon: 'store' },
    { label: 'Services pour professionnels', to: '/services-pro', icon: 'hard-hat' },
    { label: 'Études de cas', to: '/etudes-de-cas', icon: 'book-open-check' },
  ] },
  { title: 'Entreprise', items: [
    { label: 'À propos', to: '/a-propos', icon: 'building-2' },
    { label: 'Questions fréquentes', to: '/faq', icon: 'circle-help' },
    { label: 'Contact', to: '/contact', icon: 'mail' },
    { label: 'Confidentialité', to: '/confidentialite', icon: 'shield' },
    { label: 'Conditions générales', to: '/conditions', icon: 'scroll-text' },
  ] },
]

// -------------------------------------------------------------- Espace client (/espace)
export const CLIENT_NAV: NavGroup[] = [
  { items: [
    { label: 'Tableau de bord', to: '/espace', icon: 'layout-dashboard', exact: true },
    { label: 'Catalogue', to: '/espace/catalogue', icon: 'layout-grid' },
    { label: 'Favoris', to: '/espace/favoris', icon: 'heart', roles: ['client'] },
  ] },
  { title: 'Achats', items: [
    { label: 'Devis', to: '/espace/devis', icon: 'file-text', match: '/espace/devis' },
    { label: 'Commandes', to: '/espace/commandes', icon: 'package', match: '/espace/commandes' },
    { label: 'Livraisons', to: '/espace/livraisons', icon: 'truck' },
    { label: 'Suivi des lots', to: '/espace/lots', icon: 'qr-code', roles: ['pro', 'distributor'] },
  ] },
  { title: 'Finances', items: [
    { label: 'Paiements', to: '/espace/paiements', icon: 'wallet' },
    { label: 'Factures & bons de commande', to: '/espace/factures', icon: 'receipt-text', roles: ['pro', 'distributor'] },
    { label: 'Tarifs professionnels', to: '/espace/tarifs', icon: 'badge-percent', roles: ['pro', 'distributor'] },
    { label: 'Documents', to: '/espace/documents', icon: 'folder-open' },
  ] },
  { title: 'Entreprise', items: [
    { label: 'Profil entreprise', to: '/espace/entreprise', icon: 'building-2', roles: ['pro', 'distributor'] },
    { label: 'Équipe', to: '/espace/equipe', icon: 'users', roles: ['pro', 'distributor'] },
    { label: 'Portefeuille clients', to: '/espace/portefeuille', icon: 'contact', roles: ['distributor'] },
  ] },
  { title: 'Compte', items: [
    { label: 'Support & réclamations', to: '/espace/support', icon: 'life-buoy' },
    { label: 'Paramètres', to: '/espace/parametres', icon: 'settings' },
  ] },
]

// -------------------------------------------------------------- Portail collecteur (/collecte) — mobile d'abord
export const COLLECTOR_NAV: NavGroup[] = [
  { items: [
    { label: 'Accueil', to: '/collecte', icon: 'layout-dashboard', exact: true },
    { label: 'Nouvelle demande', to: '/collecte/demandes/nouvelle', icon: 'circle-plus' },
    { label: 'Mes demandes', to: '/collecte/demandes', icon: 'list-checks', match: '/collecte/demandes' },
    { label: 'Historique', to: '/collecte/historique', icon: 'history' },
  ] },
  { title: 'Paiements & suivi', items: [
    { label: 'Justificatifs', to: '/collecte/justificatifs', icon: 'file-check-2' },
    { label: 'Rémunérations', to: '/collecte/paiements', icon: 'wallet' },
    { label: 'Réclamations', to: '/collecte/reclamations', icon: 'message-circle-warning' },
    { label: 'Mon profil', to: '/collecte/profil', icon: 'user-round' },
  ] },
]

// -------------------------------------------------------------- Agent / chauffeur (/terrain) — mobile d'abord
export const DRIVER_NAV: NavGroup[] = [
  { items: [
    { label: 'Aujourd’hui', to: '/terrain', icon: 'route', exact: true },
    { label: 'Mes collectes', to: '/terrain/collectes', icon: 'package-search', match: '/terrain/collectes' },
    { label: 'Tournées', to: '/terrain/tournees', icon: 'map' },
    { label: 'Historique', to: '/terrain/historique', icon: 'history' },
    { label: 'Mon profil', to: '/terrain/profil', icon: 'user-round' },
  ] },
]

// -------------------------------------------------------------- Modules internes (/ops/*)
export const OPS_NAV: Record<string, { title: string; icon: string; roles: RoleKey[]; groups: NavGroup[] }> = {
  appro: {
    title: 'Approvisionnement & stock', icon: 'warehouse', roles: ['procurement', 'admin'],
    groups: [
      { items: [
        { label: 'Tableau de bord', to: '/ops/appro', icon: 'layout-dashboard', exact: true },
        { label: 'Demandes de collecte', to: '/ops/appro/demandes', icon: 'inbox', match: '/ops/appro/demandes' },
        { label: 'Tournées', to: '/ops/appro/tournees', icon: 'route' },
        { label: 'Fournisseurs & collecteurs', to: '/ops/appro/fournisseurs', icon: 'handshake', match: '/ops/appro/fournisseurs' },
      ] },
      { title: 'Réception', items: [
        { label: 'Réceptions & pesées', to: '/ops/appro/receptions', icon: 'scale', match: '/ops/appro/receptions' },
        { label: 'Types de plastique', to: '/ops/appro/polymeres', icon: 'atom' },
        { label: 'Lots de matière', to: '/ops/appro/lots-matiere', icon: 'boxes', match: '/ops/appro/lots-matiere' },
      ] },
      { title: 'Stock', items: [
        { label: 'État du stock', to: '/ops/appro/stock', icon: 'warehouse' },
        { label: 'Mouvements', to: '/ops/appro/mouvements', icon: 'arrow-left-right' },
        { label: 'Inventaire', to: '/ops/appro/inventaire', icon: 'clipboard-check' },
        { label: 'Pertes et écarts', to: '/ops/appro/pertes', icon: 'trending-down' },
      ] },
    ],
  },
  production: {
    title: 'Production', icon: 'factory', roles: ['production', 'admin'],
    groups: [
      { items: [
        { label: 'Tableau de bord', to: '/ops/production', icon: 'layout-dashboard', exact: true },
        { label: 'Ordres de fabrication', to: '/ops/production/ordres', icon: 'clipboard-list', match: '/ops/production/ordres' },
        { label: 'Planification', to: '/ops/production/planning', icon: 'calendar-range' },
        { label: 'Lots produits', to: '/ops/production/lots', icon: 'boxes', match: '/ops/production/lots' },
      ] },
      { title: 'Pilotage', items: [
        { label: 'Rendements', to: '/ops/production/rendements', icon: 'gauge' },
        { label: 'Anomalies et arrêts', to: '/ops/production/anomalies', icon: 'triangle-alert' },
        { label: 'Opérateurs', to: '/ops/production/operateurs', icon: 'users' },
        { label: 'Traçabilité', to: '/ops/production/tracabilite', icon: 'git-branch' },
      ] },
    ],
  },
  qualite: {
    title: 'Qualité', icon: 'microscope', roles: ['quality', 'admin'],
    groups: [
      { items: [
        { label: 'File des contrôles', to: '/ops/qualite', icon: 'layout-dashboard', exact: true },
        { label: 'Contrôles', to: '/ops/qualite/controles', icon: 'clipboard-check', match: '/ops/qualite/controles' },
        { label: 'Lots à libérer', to: '/ops/qualite/lots', icon: 'shield-check' },
      ] },
      { title: 'Référentiel', items: [
        { label: 'Référentiel de tests', to: '/ops/qualite/referentiel', icon: 'list-checks' },
        { label: 'Documents techniques', to: '/ops/qualite/documents', icon: 'files' },
        { label: 'Historique des décisions', to: '/ops/qualite/decisions', icon: 'history' },
      ] },
    ],
  },
  commercial: {
    title: 'Commercial', icon: 'briefcase-business', roles: ['sales', 'admin'],
    groups: [
      { items: [
        { label: 'Tableau de bord', to: '/ops/commercial', icon: 'layout-dashboard', exact: true },
        { label: 'Prospects', to: '/ops/commercial/prospects', icon: 'user-search' },
        { label: 'Clients & entreprises', to: '/ops/commercial/clients', icon: 'building-2', match: '/ops/commercial/clients' },
      ] },
      { title: 'Ventes', items: [
        { label: 'Devis', to: '/ops/commercial/devis', icon: 'file-text', match: '/ops/commercial/devis' },
        { label: 'Commandes', to: '/ops/commercial/commandes', icon: 'package', match: '/ops/commercial/commandes' },
        { label: 'Factures simulées', to: '/ops/commercial/factures', icon: 'receipt-text' },
        { label: 'Relances', to: '/ops/commercial/relances', icon: 'bell-ring' },
        { label: 'Indicateurs & export', to: '/ops/commercial/indicateurs', icon: 'chart-column' },
      ] },
    ],
  },
  logistique: {
    title: 'Logistique & livraison', icon: 'truck', roles: ['logistics', 'admin'],
    groups: [
      { items: [
        { label: 'Tableau de bord', to: '/ops/logistique', icon: 'layout-dashboard', exact: true },
        { label: 'Expéditions', to: '/ops/logistique/expeditions', icon: 'package-check', match: '/ops/logistique/expeditions' },
        { label: 'Tournées', to: '/ops/logistique/tournees', icon: 'route' },
        { label: 'Transporteurs', to: '/ops/logistique/transporteurs', icon: 'truck' },
      ] },
      { title: 'Suivi', items: [
        { label: 'Incidents', to: '/ops/logistique/incidents', icon: 'triangle-alert' },
        { label: 'Historique', to: '/ops/logistique/historique', icon: 'history' },
        { label: 'Frais de livraison', to: '/ops/logistique/frais', icon: 'badge-dollar-sign' },
      ] },
    ],
  },
  environnement: {
    title: 'Environnement & audit', icon: 'leaf', roles: ['environment', 'admin'],
    groups: [
      { items: [
        { label: 'Vue d’ensemble', to: '/ops/environnement', icon: 'layout-dashboard', exact: true },
        { label: 'Données mensuelles', to: '/ops/environnement/donnees', icon: 'table-2' },
        { label: 'Matières et rejets', to: '/ops/environnement/matieres', icon: 'recycle' },
      ] },
      { title: 'Publication', items: [
        { label: 'Méthodologie', to: '/ops/environnement/methodologie', icon: 'book-text' },
        { label: 'Documents de preuve', to: '/ops/environnement/preuves', icon: 'files' },
        { label: 'Validation & publication', to: '/ops/environnement/publication', icon: 'shield-check' },
      ] },
    ],
  },
}

// -------------------------------------------------------------- Administration (/admin)
export const ADMIN_NAV: NavGroup[] = [
  { items: [{ label: 'Vue globale', to: '/admin', icon: 'layout-dashboard', exact: true }] },
  { title: 'Personnes', items: [
    { label: 'Utilisateurs & rôles', to: '/admin/utilisateurs', icon: 'users', match: '/admin/utilisateurs' },
    { label: 'Accès & permissions', to: '/admin/acces', icon: 'key-round' },
    { label: 'Clients', to: '/admin/clients', icon: 'building-2', match: '/admin/clients' },
    { label: 'Partenaires', to: '/admin/partenaires', icon: 'handshake' },
  ] },
  { title: 'Catalogue & prix', items: [
    { label: 'Produits', to: '/admin/produits', icon: 'package', match: '/admin/produits' },
    { label: 'Catégories', to: '/admin/categories', icon: 'folder-tree' },
    { label: 'Prix & grilles', to: '/admin/tarifs', icon: 'badge-percent' },
  ] },
  { title: 'Chaîne industrielle', items: [
    { label: 'Collectes & réceptions', to: '/admin/collectes', icon: 'truck' },
    { label: 'Stocks & matières', to: '/admin/stocks', icon: 'warehouse' },
    { label: 'Production', to: '/admin/production', icon: 'factory' },
    { label: 'Qualité & documentation', to: '/admin/qualite', icon: 'microscope' },
    { label: 'Lots & traçabilité', to: '/admin/lots', icon: 'git-branch', match: '/admin/lots' },
  ] },
  { title: 'Ventes & finances', items: [
    { label: 'Devis', to: '/admin/devis', icon: 'file-text' },
    { label: 'Commandes', to: '/admin/commandes', icon: 'shopping-bag', match: '/admin/commandes' },
    { label: 'Factures simulées', to: '/admin/factures', icon: 'receipt-text' },
    { label: 'Paiements & litiges', to: '/admin/paiements', icon: 'wallet' },
    { label: 'Livraisons', to: '/admin/livraisons', icon: 'package-check' },
    { label: 'Réclamations', to: '/admin/reclamations', icon: 'life-buoy' },
  ] },
  { title: 'Contenu & impact', items: [
    { label: 'Documents', to: '/admin/documents', icon: 'files' },
    { label: 'Pages publiques & FAQ', to: '/admin/contenu', icon: 'newspaper' },
    { label: 'Impact environnemental', to: '/admin/impact', icon: 'leaf' },
    { label: 'Médias Cloudinary', to: '/admin/medias', icon: 'image' },
  ] },
  { title: 'Plateforme', items: [
    { label: 'Paramètres', to: '/admin/parametres', icon: 'settings' },
    { label: 'Apparence & thèmes', to: '/admin/apparence', icon: 'palette' },
    { label: 'Journal d’audit', to: '/admin/audit', icon: 'scroll-text' },
    { label: 'Données de démonstration', to: '/admin/demo', icon: 'flask-conical' },
  ] },
]

/** Zone (clé de OPS_NAV) correspondant à un chemin /ops/<zone>/… */
export function opsZoneOf(path: string): string | null {
  const m = /^\/ops\/([^/]+)/.exec(path)
  return m ? (OPS_NAV[m[1]!] ? m[1]! : null) : null
}

/** Éléments de navigation visibles par un rôle dans un groupe */
export function visibleGroups(groups: NavGroup[], role: RoleKey | undefined): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }))
    .filter((g) => g.items.length)
}

export function isActive(item: NavItem, path: string): boolean {
  if (item.exact) return path === item.to
  const base = item.match ?? item.to
  return path === base || path.startsWith(base + '/')
}
