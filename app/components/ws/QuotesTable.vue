<script setup lang="ts">
import { computeTotals } from '#shared/services/pricing'
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Quote } from '#shared/types/domain'

/** Table des devis. `base` : préfixe de route du détail (ex. /ops/commercial/devis). */
const props = defineProps<{ base: string; rows?: Quote[] }>()
const db = useDb()
const L = useLookups()
const data = computed(() => [...(props.rows ?? db.all('quotes'))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const totalOf = (q: Quote) => (q.lines.some((l) => l.unitPrice != null) ? computeTotals({ lines: q.lines, discountPct: q.discountPct, deliveryFee: q.deliveryFee, depositPct: q.depositPct }).total : null)
const columns = [
  { key: 'ref', label: 'Devis', sortable: true },
  { key: 'client', label: 'Client', value: (q: Quote) => (q.companyId ? L.companyName(q.companyId) : q.contact.name) },
  { key: 'createdAt', label: 'Demandé le', sortable: true, hide: 'md' as const, value: (q: Quote) => fdate(q.createdAt), sortValue: (q: Quote) => q.createdAt },
  { key: 'lines', label: 'Produits', hide: 'lg' as const, value: (q: Quote) => q.lines.map((l) => l.label).join(', ') },
  { key: 'total', label: 'Total', align: 'right' as const, sortable: true, value: (q: Quote) => (totalOf(q) != null ? fcfa(totalOf(q)) : 'À chiffrer'), sortValue: (q: Quote) => totalOf(q) ?? 0 },
  { key: 'assignedTo', label: 'Responsable', hide: 'lg' as const, value: (q: Quote) => (q.assignedTo ? L.userName(q.assignedTo) : 'Non attribué') },
  { key: 'status', label: 'Statut', value: (q: Quote) => STATUS.quote[q.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.quote).map(([value, m]) => ({ value, label: m.label })), accessor: (q: Quote) => q.status }]
</script>

<template>
  <UiDataTable :rows="data" :columns="columns" :filters="filters" export-name="devis" :initial-sort="{ key: 'createdAt', dir: 'desc' }" dense @row-click="(q: Quote) => navigateTo(`${base}/${q.id}`)">
    <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
    <template #cell-status="{ row }"><UiStatusBadge kind="quote" :value="row.status" size="sm" /></template>
    <template #empty><UiEmpty icon="file-text" title="Aucun devis" hint="Les demandes de devis des clients apparaîtront ici." /></template>
  </UiDataTable>
</template>
