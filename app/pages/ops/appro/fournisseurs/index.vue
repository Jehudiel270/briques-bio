<script setup lang="ts">
import { POLYMER_LABEL, SUPPLIER_KIND_LABEL, STATUS } from '#shared/utils/labels'
import type { Supplier } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Fournisseurs et collecteurs')
const polymerOptions = Object.entries(POLYMER_LABEL).map(([value, label]) => ({ value, label }))
const kindOptions = Object.entries(SUPPLIER_KIND_LABEL).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(STATUS.supplier).map(([value, m]) => ({ value, label: m.label }))
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom', type: 'text', required: true, span: 2 },
  { key: 'kind', label: 'Type', type: 'select', required: true, options: kindOptions },
  { key: 'status', label: 'Statut', type: 'select', required: true, options: statusOptions },
  { key: 'contactName', label: 'Contact', type: 'text', required: true },
  { key: 'phone', label: 'Téléphone', type: 'tel', required: true },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'paymentModel', label: 'Rémunération', type: 'select', required: true, options: [{ value: 'per_kg', label: 'Au kilo (simulée)' }, { value: 'none', label: 'Sans rémunération' }] },
  { key: 'line', label: 'Adresse', type: 'text', required: true },
  { key: 'city', label: 'Ville', type: 'text', required: true },
  { key: 'polymers', label: 'Plastiques collectés', type: 'multiselect', options: polymerOptions, span: 2 },
  { key: 'notes', label: 'Notes internes', type: 'textarea', span: 2, rows: 3 },
]
const columns = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'kind', label: 'Type', hide: 'sm' as const, value: (s: Supplier) => SUPPLIER_KIND_LABEL[s.kind] },
  { key: 'contact', label: 'Contact', hide: 'md' as const, value: (s: Supplier) => `${s.contactName} · ${s.phone}` },
  { key: 'city', label: 'Ville', hide: 'lg' as const, value: (s: Supplier) => s.address.city },
  { key: 'polymers', label: 'Plastiques', hide: 'lg' as const, value: (s: Supplier) => s.polymers.join(', ') || '—' },
  { key: 'status', label: 'Statut', value: (s: Supplier) => STATUS.supplier[s.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: statusOptions, accessor: (s: Supplier) => s.status },
  { key: 'kind', label: 'Type', options: kindOptions, accessor: (s: Supplier) => s.kind },
]
const toValues = (s: Supplier) => ({ ...s, line: s.address.line, city: s.address.city })
const fromValues = (v: Record<string, any>, row?: Supplier) => ({
  name: v.name, kind: v.kind, status: v.status, contactName: v.contactName, phone: v.phone, email: v.email || undefined, paymentModel: v.paymentModel,
  address: { ...(row?.address ?? {}), line: v.line, city: v.city }, polymers: v.polymers ?? [], notes: v.notes || undefined, createdAt: row?.createdAt ?? new Date().toISOString(), demo: true,
})
const navigate = (s: Supplier) => navigateTo(`/ops/appro/fournisseurs/${s.id}`)
</script>

<template>
  <div>
    <WsCrud collection="suppliers" title="Fournisseurs et collecteurs" description="Partenaires qui apportent la matière : agrément, plastiques acceptés, rémunération simulée." icon="handshake" :columns="columns" :fields="fields" :filters="filters" noun="fournisseur" create-label="Nouveau partenaire" :defaults="{ kind: 'collector_individual', status: 'pending', paymentModel: 'per_kg', polymers: [] }" :to-values="toValues" :from-values="fromValues" export-name="fournisseurs" dialog-size="lg">
      <template #cell-name="{ row }"><NuxtLink :to="`/ops/appro/fournisseurs/${row.id}`" class="font-medium hover:underline" @click.stop>{{ row.name }}</NuxtLink></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="supplier" :value="row.status" size="sm" /></template>
    </WsCrud>
  </div>
</template>
