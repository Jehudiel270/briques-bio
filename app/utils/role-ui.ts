/**
 * Présentation des rôles : icônes Lucide (sans préfixe), regroupements pour le sélecteur de démonstration
 * et les cartes de comptes de la page de connexion.
 */
import type { RoleKey } from '../../shared/types/domain'

export const ROLE_ICON: Record<RoleKey, string> = {
  visitor: 'eye',
  client: 'user-round',
  pro: 'hard-hat',
  distributor: 'store',
  collector: 'recycle',
  driver: 'truck',
  procurement: 'warehouse',
  production: 'factory',
  quality: 'microscope',
  sales: 'briefcase-business',
  logistics: 'package-check',
  admin: 'shield-check',
  environment: 'leaf',
}

export interface RoleGroup {
  title: string
  roles: RoleKey[]
}

/** Rôles de démonstration, regroupés comme les espaces de l'application */
export const DEMO_ROLE_GROUPS: RoleGroup[] = [
  { title: 'Clients et revendeurs', roles: ['client', 'pro', 'distributor'] },
  { title: 'Collecte sur le terrain', roles: ['collector', 'driver'] },
  { title: 'Équipe interne', roles: ['procurement', 'production', 'quality', 'sales', 'logistics', 'environment'] },
  { title: 'Administration', roles: ['admin'] },
]

/** Explication affichée à l'inscription pour les rôles soumis à validation */
export const ROLES_NEEDING_APPROVAL: RoleKey[] = ['collector', 'distributor']
export const needsApproval = (role: RoleKey | undefined) => !!role && ROLES_NEEDING_APPROVAL.includes(role)
