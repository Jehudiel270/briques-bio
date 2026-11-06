<script setup lang="ts">
import { STATUS } from '#shared/utils/labels'
import type { Company } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Clients et entreprises')
const db = useDb()
const grids = computed(() => db.all('priceGrids').map((g) => ({ value: g.id, label: g.name })))
const fields = computed<FieldDef[]>(() => [
  { key: 'name', label: 'Raison sociale', type: 'text', required: true, span: 2 },
  { key: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'client', label: 'Client professionnel' }, { value: 'distributor', label: 'Distributeur' }] },
  { key: 'status', label: 'Statut', type: 'select', required: true, options: Object.entries(STATUS.company).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'billingEmail', label: 'E-mail de facturation', type: 'email', required: true },
  { key: 'taxId', label: 'Identifiant fiscal', type: 'text' },
  { key: 'line', label: 'Adresse', type: 'text', required: true },
  { key: 'city', label: 'Ville', type: 'text', required: true },
  { key: 'paymentTermsDays', label: 'Délai de paiement (jours)', type: 'number', min: 0, max: 120 },
  { key: 'creditLimit', label: 'Plafond de crédit (FCFA)', type: 'currency', min: 0 },
  { key: 'priceGridId', label: 'Grille tarifaire', type: 'select', options: [{ value: '', label: 'Tarif public' }, ...grids.value] },
])
const columns = [
  { key: 'name', label: 'Entreprise', sortable: true },
  { key: 'kind', label: 'Type', hide: 'sm' as const, value: (c: Company) => (c.kind === 'distributor' ? 'Distributeur' : 'Client pro') },
  { key: 'city', label: 'Ville', hide: 'md' as const, value: (c: Company) => c.address.city },
  { key: 'orders', label: 'Commandes', align: 'right' as const, hide: 'md' as const, value: (c: Company) => db.all('orders').filter((o) => o.companyId === c.id).length },
  { key: 'contacts', label: 'Contacts', align: 'right' as const, hide: 'lg' as const, value: (c: Company) => c.contacts.length },
  { key: 'status', label: 'Statut', value: (c: Company) => STATUS.company[c.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.company).map(([value, m]) => ({ value, label: m.label })), accessor: (c: Company) => c.status },
  { key: 'kind', label: 'Type', options: [{ value: 'client', label: 'Client pro' }, { value: 'distributor', label: 'Distributeur' }], accessor: (c: Company) => c.kind },
]
const toValues = (c: Company) => ({ ...c, line: c.address.line, city: c.address.city, priceGridId: c.priceGridId ?? '' })
const fromValues = (v: Record<string, any>, row?: Company) => ({
  name: v.name, kind: v.kind, status: v.status, billingEmail: v.billingEmail, taxId: v.taxId, paymentTermsDays: Number(v.paymentTermsDays) || 0, creditLimit: v.creditLimit,
  priceGridId: v.priceGridId || undefined, address: { ...(row?.address ?? { country: 'Bénin' }), line: v.line, city: v.city },
  contacts: row?.contacts ?? [], createdAt: row?.createdAt ?? new Date().toISOString(), demo: true,
})
</script>

<template>
  <WsCrud collection="companies" title="Clients et entreprises" description="Comptes professionnels et distributeurs : conditions, grille tarifaire, contacts." icon="building-2" :columns="columns" :fields="fields" :filters="filters" noun="entreprise" create-label="Nouvelle entreprise" :defaults="{ kind: 'client', status: 'active', paymentTermsDays: 30 }" :to-values="toValues" :from-values="fromValues" export-name="clients" dialog-size="lg" no-delete>
    <template #cell-name="{ row }"><NuxtLink :to="`/admin/clients/${row.id}`" class="font-medium hover:underline" @click.stop>{{ row.name }}</NuxtLink></template>
    <template #cell-status="{ row }"><UiStatusBadge kind="company" :value="row.status" size="sm" /></template>
  </WsCrud>
</template>
