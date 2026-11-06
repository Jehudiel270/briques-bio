/** Libellés français et teintes des statuts — source unique pour tous les badges de l'interface. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export interface StatusMeta {
  label: string
  tone: Tone
  /** Nom d'icône Lucide (préfixe `lucide:` ajouté par le composant) */
  icon?: string
}

const m = (label: string, tone: Tone, icon?: string): StatusMeta => ({ label, tone, icon })

export const STATUS = {
  validation: {
    development: m('En développement', 'neutral', 'flask-conical'),
    testing: m('En cours de test', 'warning', 'microscope'),
    results: m('Résultats de tests disponibles', 'info', 'clipboard-check'),
    authorized: m('Autorisé à la commercialisation', 'success', 'badge-check'),
  },
  quote: {
    requested: m('Demande reçue', 'info', 'inbox'),
    in_review: m('En cours de chiffrage', 'warning', 'calculator'),
    sent: m('Devis envoyé', 'accent', 'send'),
    accepted: m('Accepté', 'success', 'check-check'),
    declined: m('Refusé', 'danger', 'x-circle'),
    expired: m('Expiré', 'neutral', 'hourglass'),
    converted: m('Converti en commande', 'success', 'shopping-bag'),
  },
  order: {
    pending_payment: m('Paiement en attente', 'warning', 'wallet'),
    confirmed: m('Confirmée', 'info', 'circle-check'),
    in_preparation: m('En préparation', 'accent', 'package-open'),
    ready_to_ship: m('Prête à expédier', 'accent', 'package-check'),
    shipped: m('Expédiée', 'info', 'truck'),
    delivered: m('Livrée', 'success', 'badge-check'),
    cancelled: m('Annulée', 'neutral', 'ban'),
    disputed: m('Litige', 'danger', 'triangle-alert'),
  },
  payment: {
    unpaid: m('Non payée', 'warning', 'circle-dashed'),
    deposit_paid: m('Acompte réglé (simulé)', 'info', 'circle-dot'),
    paid: m('Payée (simulé)', 'success', 'circle-check'),
    partially_refunded: m('Remboursée en partie (simulé)', 'neutral', 'undo-2'),
    refunded: m('Remboursée (simulé)', 'neutral', 'undo-2'),
    disputed: m('Litige de paiement', 'danger', 'triangle-alert'),
  },
  paymentTx: {
    pending: m('En attente', 'warning', 'clock'),
    succeeded: m('Réussi (simulé)', 'success', 'check'),
    failed: m('Échoué', 'danger', 'x'),
    refunded: m('Remboursé (simulé)', 'neutral', 'undo-2'),
  },
  invoice: {
    draft: m('Brouillon', 'neutral', 'file-pen-line'),
    issued: m('Émise (fictive)', 'info', 'file-text'),
    paid: m('Réglée (simulé)', 'success', 'file-check'),
    overdue: m('En retard', 'danger', 'alarm-clock'),
    cancelled: m('Annulée', 'neutral', 'file-x'),
  },
  delivery: {
    to_prepare: m('À préparer', 'warning', 'clipboard-list'),
    preparing: m('En préparation', 'accent', 'package-open'),
    planned: m('Planifiée', 'info', 'calendar-clock'),
    in_transit: m('En transit', 'info', 'truck'),
    delivered: m('Livrée', 'success', 'badge-check'),
    failed: m('Échec de livraison', 'danger', 'triangle-alert'),
    cancelled: m('Annulée', 'neutral', 'ban'),
  },
  collection: {
    submitted: m('Demande envoyée', 'info', 'inbox'),
    under_review: m('En examen', 'warning', 'search-check'),
    planned: m('Planifiée', 'accent', 'calendar-check'),
    en_route: m('Chauffeur en route', 'info', 'truck'),
    collected: m('Collectée', 'accent', 'package-check'),
    weighed: m('Pesée', 'accent', 'scale'),
    received: m('Réceptionnée', 'success', 'badge-check'),
    problem: m('Problème signalé', 'danger', 'triangle-alert'),
    cancelled: m('Annulée', 'neutral', 'ban'),
    rejected: m('Refusée', 'danger', 'x-circle'),
  },
  tour: {
    planned: m('Planifiée', 'info', 'calendar-check'),
    in_progress: m('En cours', 'accent', 'route'),
    done: m('Terminée', 'success', 'flag'),
    cancelled: m('Annulée', 'neutral', 'ban'),
  },
  receiptDecision: {
    accepted: m('Accepté', 'success', 'check'),
    rejected: m('Rejeté', 'danger', 'x'),
    quarantine: m('Quarantaine', 'warning', 'shield-alert'),
    partial: m('Partiel', 'info', 'split'),
  },
  receipt: {
    weighed: m('Pesée enregistrée', 'accent', 'scale'),
    controlled: m('Contrôlée', 'info', 'search-check'),
    closed: m('Clôturée', 'success', 'lock'),
  },
  rawLot: {
    available: m('Disponible', 'success', 'package'),
    quarantine: m('Quarantaine', 'warning', 'shield-alert'),
    rejected: m('Rejeté', 'danger', 'x-circle'),
    depleted: m('Épuisé', 'neutral', 'package-x'),
  },
  workOrder: {
    draft: m('Brouillon', 'neutral', 'file-pen-line'),
    planned: m('Planifié', 'info', 'calendar-check'),
    materials_reserved: m('Matières réservées', 'accent', 'package-check'),
    in_progress: m('En production', 'accent', 'factory'),
    paused: m('En pause', 'warning', 'pause'),
    completed: m('Terminé', 'success', 'flag'),
    cancelled: m('Annulé', 'neutral', 'ban'),
  },
  lotQc: {
    pending_qc: m('Contrôle à demander', 'warning', 'hourglass'),
    in_qc: m('En contrôle', 'info', 'microscope'),
    released: m('Libéré', 'success', 'badge-check'),
    rejected: m('Rejeté', 'danger', 'x-circle'),
    quarantine: m('Quarantaine', 'warning', 'shield-alert'),
  },
  inspection: {
    pending: m('En attente', 'warning', 'hourglass'),
    in_progress: m('En cours', 'info', 'microscope'),
    completed: m('Terminé', 'success', 'check-check'),
  },
  inspectionDecision: {
    accepted: m('Accepté', 'success', 'check'),
    rejected: m('Rejeté', 'danger', 'x'),
    quarantine: m('Quarantaine', 'warning', 'shield-alert'),
  },
  claim: {
    open: m('Ouverte', 'warning', 'message-circle-warning'),
    in_review: m('En traitement', 'info', 'search'),
    resolved: m('Résolue', 'success', 'check'),
    rejected: m('Rejetée', 'danger', 'x'),
  },
  supplier: {
    pending: m('En attente de validation', 'warning', 'hourglass'),
    approved: m('Approuvé', 'success', 'badge-check'),
    suspended: m('Suspendu', 'danger', 'ban'),
  },
  company: {
    prospect: m('Prospect', 'info', 'user-search'),
    active: m('Actif', 'success', 'building-2'),
    suspended: m('Suspendu', 'danger', 'ban'),
  },
  prospect: {
    new: m('Nouveau', 'info', 'sparkles'),
    contacted: m('Contacté', 'accent', 'phone-call'),
    qualified: m('Qualifié', 'warning', 'target'),
    won: m('Gagné', 'success', 'trophy'),
    lost: m('Perdu', 'neutral', 'circle-slash'),
  },
  document: {
    draft: m('Brouillon', 'neutral', 'file-pen-line'),
    internal: m('Interne', 'warning', 'lock'),
    published: m('Publié', 'success', 'globe'),
    archived: m('Archivé', 'neutral', 'archive'),
  },
  indicator: {
    draft: m('Brouillon', 'neutral', 'file-pen-line'),
    validated: m('Validé — non publié', 'warning', 'shield-check'),
    published: m('Publié', 'success', 'globe'),
  },
  user: {
    active: m('Actif', 'success', 'user-check'),
    inactive: m('Désactivé', 'neutral', 'user-x'),
    pending: m('En attente de validation', 'warning', 'user-round-search'),
  },
  stockMovement: {
    in: m('Entrée', 'success', 'arrow-down-to-line'),
    out: m('Sortie', 'warning', 'arrow-up-from-line'),
    transfer: m('Transfert', 'info', 'arrow-left-right'),
    adjustment: m('Ajustement', 'neutral', 'sliders-horizontal'),
    loss: m('Perte', 'danger', 'trash-2'),
    reservation: m('Réservation', 'accent', 'lock'),
    release: m('Libération', 'info', 'lock-open'),
  },
} as const satisfies Record<string, Record<string, StatusMeta>>

export type StatusKind = keyof typeof STATUS

export function statusMeta(kind: StatusKind, value: string | undefined | null): StatusMeta {
  const table = STATUS[kind] as Record<string, StatusMeta>
  return (value && table[value]) || { label: value ?? '—', tone: 'neutral' }
}

export const POLYMER_LABEL: Record<string, string> = {
  PET: 'PET (1)',
  HDPE: 'PEHD (2)',
  PVC: 'PVC (3)',
  LDPE: 'PEBD (4)',
  PP: 'PP (5)',
  PS: 'PS (6)',
  OTHER: 'Autres (7)',
}

export const PATTERN_LABEL: Record<string, string> = {
  paver: 'Pavé',
  slab: 'Dalle',
  kerb: 'Bordure',
  tile: 'Carreau',
  plank: 'Lame',
  block: 'Bloc',
}

export const CLAIM_KIND_LABEL: Record<string, string> = {
  quality: 'Qualité produit',
  delivery: 'Livraison',
  billing: 'Facturation',
  collection: 'Collecte',
  payment: 'Paiement',
  other: 'Autre',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  mobile_money: 'Mobile money (simulé)',
  bank_transfer: 'Virement (simulé)',
  cash: 'Espèces (simulé)',
  card: 'Carte (simulé)',
}

export const SUPPLIER_KIND_LABEL: Record<string, string> = {
  collector_individual: 'Collecteur indépendant',
  collector_org: 'Structure de collecte',
  cooperative: 'Coopérative',
  supplier: 'Fournisseur',
}

export const DOC_KIND_LABEL: Record<string, string> = {
  datasheet: 'Fiche technique',
  test_report: 'Rapport d’essai',
  install_guide: 'Guide de pose',
  safety: 'Sécurité',
  commercial: 'Document commercial',
  proof: 'Justificatif',
  other: 'Autre',
}

/** Mentions légales de prudence réutilisées partout (ne pas affaiblir). */
export const NOTICES = {
  demoData: 'Données de démonstration fictives : aucune fabrication, vente ou contrat réel.',
  technicalUnconfirmed: 'Les données techniques et les certifications doivent être confirmées avant toute commercialisation.',
  simulatedPayment: 'Paiement simulé : aucune transaction réelle n’est effectuée.',
  demoDocument: 'Document de démonstration — non officiel, sans valeur de certificat.',
  leadTime: 'Délai indicatif à confirmer.',
  notStructural: 'Produit non structurel : ne pas utiliser pour des éléments porteurs.',
} as const
