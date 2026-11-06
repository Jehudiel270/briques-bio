import type { RoleKey } from '../types/domain'

export interface RoleMeta {
  key: RoleKey
  letter: string
  label: string
  short: string
  description: string
  /** Page d'accueil après connexion */
  home: string
  space: 'public' | 'client' | 'field' | 'ops' | 'admin'
  /** Teinte d'avatar / pastille */
  hue: number
}

export const ROLES: Record<RoleKey, RoleMeta> = {
  visitor: { key: 'visitor', letter: 'A', label: 'Visiteur', short: 'Visiteur', description: 'Explore le catalogue et prépare une demande de devis.', home: '/', space: 'public', hue: 200 },
  client: { key: 'client', letter: 'B', label: 'Client particulier', short: 'Particulier', description: 'Commande pour son habitat ou son jardin.', home: '/espace', space: 'client', hue: 150 },
  pro: { key: 'pro', letter: 'C', label: 'Client professionnel', short: 'Professionnel', description: 'Entreprise de construction, artisan ou acheteur en volume.', home: '/espace', space: 'client', hue: 170 },
  collector: { key: 'collector', letter: 'D', label: 'Collecteur de déchets', short: 'Collecteur', description: 'Déclare et fait enlever des déchets plastiques.', home: '/collecte', space: 'field', hue: 95 },
  driver: { key: 'driver', letter: 'E', label: 'Agent de collecte / chauffeur', short: 'Chauffeur', description: 'Exécute les enlèvements et enregistre les preuves.', home: '/terrain', space: 'field', hue: 60 },
  procurement: { key: 'procurement', letter: 'F', label: 'Approvisionnement & stock', short: 'Appro', description: 'Planifie les collectes, réceptionne et stocke les matières.', home: '/ops/appro', space: 'ops', hue: 120 },
  production: { key: 'production', letter: 'G', label: 'Responsable de production', short: 'Production', description: 'Pilote les ordres de fabrication et les lots.', home: '/ops/production', space: 'ops', hue: 35 },
  quality: { key: 'quality', letter: 'H', label: 'Technicien qualité', short: 'Qualité', description: 'Contrôle, libère ou bloque les lots.', home: '/ops/qualite', space: 'ops', hue: 260 },
  sales: { key: 'sales', letter: 'I', label: 'Responsable commercial', short: 'Commercial', description: 'Gère prospects, devis, commandes et facturation simulée.', home: '/ops/commercial', space: 'ops', hue: 20 },
  logistics: { key: 'logistics', letter: 'J', label: 'Logistique & livraison', short: 'Logistique', description: 'Prépare, expédie et prouve les livraisons.', home: '/ops/logistique', space: 'ops', hue: 215 },
  distributor: { key: 'distributor', letter: 'K', label: 'Distributeur / revendeur', short: 'Distributeur', description: 'Commande en gros avec ses conditions dédiées.', home: '/espace', space: 'client', hue: 300 },
  admin: { key: 'admin', letter: 'L', label: 'Administrateur général', short: 'Admin', description: 'Supervise toute la plateforme.', home: '/admin', space: 'admin', hue: 0 },
  environment: { key: 'environment', letter: 'M', label: 'Environnement & audit', short: 'Environnement', description: 'Valide les indicateurs avant publication.', home: '/ops/environnement', space: 'ops', hue: 135 },
}

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[]

export const CLIENT_ROLES: RoleKey[] = ['client', 'pro', 'distributor']
export const STAFF_ROLES: RoleKey[] = ['procurement', 'production', 'quality', 'sales', 'logistics', 'environment', 'admin']
export const FIELD_ROLES: RoleKey[] = ['collector', 'driver']
/** Rôles qu'un visiteur peut choisir à l'inscription (les autres sont attribués par l'administration) */
export const SELF_SIGNUP_ROLES: RoleKey[] = ['client', 'pro', 'collector', 'distributor']

export const homeFor = (role: RoleKey | undefined) => ROLES[role ?? 'visitor']?.home ?? '/'
export const roleLabel = (role: RoleKey | undefined) => ROLES[role ?? 'visitor']?.label ?? 'Visiteur'
