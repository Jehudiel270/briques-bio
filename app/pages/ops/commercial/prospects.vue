<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Prospect } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Prospects')
const db = useDb()
const L = useLookups()
const INTEREST: Record<string, string> = { contact: 'Contact', quote: 'Devis', collector: 'Collecteur', distributor: 'Distributeur', supplier: 'Fournisseur', pro_services: 'Services pro' }
const SOURCE: Record<string, string> = { site: 'Site web', referral: 'Recommandation', event: 'Événement', outbound: 'Prospection', distributor_request: 'Demande distributeur' }
const users = computed(() => db.all('users').filter((u) => ['sales', 'admin'].includes(u.role)).map((u) => ({ value: u.id, label: u.name })))
const fields = computed<FieldDef[]>(() => [
  { key: 'name', label: 'Nom du contact', type: 'text', required: true },
  { key: 'company', label: 'Entreprise', type: 'text' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'source', label: 'Source', type: 'select', required: true, options: Object.entries(SOURCE).map(([value, label]) => ({ value, label })) },
  { key: 'interest', label: 'Objet', type: 'select', options: Object.entries(INTEREST).map(([value, label]) => ({ value, label })) },
  { key: 'status', label: 'Statut', type: 'select', required: true, options: Object.entries(STATUS.prospect).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'ownerId', label: 'Responsable', type: 'select', options: users.value },
  { key: 'estimatedValue', label: 'Valeur estimée (FCFA)', type: 'currency', min: 0 },
  { key: 'nextFollowUpAt', label: 'Prochaine relance', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
])
const columns = [
  { key: 'name', label: 'Contact', sortable: true, value: (p: Prospect) => p.name },
  { key: 'company', label: 'Entreprise', hide: 'sm' as const, value: (p: Prospect) => p.company ?? '—' },
  { key: 'interest', label: 'Objet', hide: 'md' as const, value: (p: Prospect) => (p.interest ? INTEREST[p.interest] : '—') },
  { key: 'source', label: 'Source', hide: 'lg' as const, value: (p: Prospect) => SOURCE[p.source] },
  { key: 'owner', label: 'Responsable', hide: 'lg' as const, value: (p: Prospect) => (p.ownerId ? L.userName(p.ownerId) : 'Non attribué') },
  { key: 'value', label: 'Valeur', align: 'right' as const, hide: 'md' as const, sortable: true, value: (p: Prospect) => (p.estimatedValue ? fcfa(p.estimatedValue) : '—'), sortValue: (p: Prospect) => p.estimatedValue ?? 0 },
  { key: 'nextFollowUpAt', label: 'Relance', hide: 'md' as const, sortable: true, value: (p: Prospect) => (p.nextFollowUpAt ? fdate(p.nextFollowUpAt) : '—'), sortValue: (p: Prospect) => p.nextFollowUpAt ?? '9999' },
  { key: 'status', label: 'Statut', value: (p: Prospect) => STATUS.prospect[p.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.prospect).map(([value, m]) => ({ value, label: m.label })), accessor: (p: Prospect) => p.status },
  { key: 'interest', label: 'Objet', options: Object.entries(INTEREST).map(([value, label]) => ({ value, label })), accessor: (p: Prospect) => p.interest ?? '' },
]
const toValues = (p: Prospect) => ({ ...p, nextFollowUpAt: p.nextFollowUpAt?.slice(0, 10) })
const fromValues = (v: Record<string, any>) => ({ ...v, nextFollowUpAt: v.nextFollowUpAt ? new Date(`${v.nextFollowUpAt}T09:00:00`).toISOString() : undefined, createdAt: v.createdAt ?? new Date().toISOString(), demo: true })
</script>

<template>
  <WsCrud collection="prospects" title="Prospects" description="Demandes reçues via le site (contact, collecteurs, distributeurs, services pro) et prospection active." icon="user-search" :columns="columns" :fields="fields" :filters="filters" noun="prospect" create-label="Nouveau prospect" :defaults="{ status: 'new', source: 'outbound' }" :to-values="toValues" :from-values="fromValues" export-name="prospects" :initial-sort="{ key: 'nextFollowUpAt', dir: 'asc' }" dialog-size="lg">
    <template #cell-status="{ row }"><UiStatusBadge kind="prospect" :value="row.status" size="sm" /></template>
  </WsCrud>
</template>
