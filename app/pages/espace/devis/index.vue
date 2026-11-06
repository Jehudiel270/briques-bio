<script setup lang="ts">
import { computeTotals } from '#shared/services/pricing'
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Quote } from '#shared/types/domain'

usePageTitle('Mes devis')
const db = useDb()
const rows = computed(() => [...db.all('quotes')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const totalOf = (q: Quote) => (q.lines.some((l) => l.unitPrice != null) ? computeTotals({ lines: q.lines, discountPct: q.discountPct, deliveryFee: q.deliveryFee, depositPct: q.depositPct }).total : null)
const columns = [
  { key: 'ref', label: 'Référence', sortable: true },
  { key: 'createdAt', label: 'Demandé le', sortable: true, hide: 'sm' as const, value: (q: Quote) => fdate(q.createdAt), sortValue: (q: Quote) => q.createdAt },
  { key: 'lines', label: 'Produits', hide: 'md' as const, value: (q: Quote) => q.lines.map((l) => l.label).join(', ') },
  { key: 'total', label: 'Total TTC', align: 'right' as const, sortable: true, value: (q: Quote) => (totalOf(q) != null ? fcfa(totalOf(q)) : 'À chiffrer'), sortValue: (q: Quote) => totalOf(q) ?? 0 },
  { key: 'status', label: 'Statut', value: (q: Quote) => STATUS.quote[q.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.quote).map(([value, m]) => ({ value, label: m.label })), accessor: (q: Quote) => q.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Mes devis" description="Suivez vos demandes, comparez les offres reçues et acceptez celle qui vous convient." icon="file-text">
      <template #actions><UiButton icon="file-plus-2" to="/devis">Nouvelle demande</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" empty-title="Aucun devis" empty-hint="Ajoutez des produits à votre liste puis envoyez une demande de devis." :initial-sort="{ key: 'createdAt', dir: 'desc' }" @row-click="(q: Quote) => navigateTo(`/espace/devis/${q.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="quote" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="file-text" title="Aucun devis" hint="Ajoutez des produits à votre liste puis envoyez une demande de devis."><UiButton icon="layout-grid" to="/catalogue">Voir le catalogue</UiButton></UiEmpty></template>
    </UiDataTable>
  </div>
</template>
