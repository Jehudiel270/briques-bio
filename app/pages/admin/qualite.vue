<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { QcInspection } from '#shared/types/domain'

usePageTitle('Qualité et documentation')
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('qcInspections')].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)))
const lotOf = (q: QcInspection) => L.peek('productionLots', q.lotId)
const columns = [
  { key: 'ref', label: 'Contrôle', sortable: true },
  { key: 'lot', label: 'Lot', value: (q: QcInspection) => L.lotRef(q.lotId) },
  { key: 'product', label: 'Produit', hide: 'sm' as const, value: (q: QcInspection) => L.productName(lotOf(q)?.productId) },
  { key: 'requestedAt', label: 'Demandé le', hide: 'md' as const, sortable: true, value: (q: QcInspection) => fdate(q.requestedAt), sortValue: (q: QcInspection) => q.requestedAt },
  { key: 'assigned', label: 'Technicien', hide: 'lg' as const, value: (q: QcInspection) => L.userName(q.assignedTo) },
  { key: 'status', label: 'Avancement', value: (q: QcInspection) => STATUS.inspection[q.status].label },
  { key: 'decision', label: 'Décision', value: (q: QcInspection) => (q.decision ? STATUS.inspectionDecision[q.decision].label : '—') },
]
const filters = [
  { key: 'status', label: 'Avancement', options: Object.entries(STATUS.inspection).map(([value, m]) => ({ value, label: m.label })), accessor: (q: QcInspection) => q.status },
  { key: 'decision', label: 'Décision', options: Object.entries(STATUS.inspectionDecision).map(([value, m]) => ({ value, label: m.label })), accessor: (q: QcInspection) => q.decision },
]
</script>

<template>
  <div>
    <UiPageHeader title="Contrôles qualité" description="Saisie des résultats d’essais et décisions de libération, rejet ou quarantaine." icon="clipboard-check" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="controles-qualite" :initial-sort="{ key: 'requestedAt', dir: 'desc' }" dense @row-click="(q: QcInspection) => navigateTo(`/ops/qualite/controles/${q.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="inspection" :value="row.status" size="sm" /></template>
      <template #cell-decision="{ row }"><UiStatusBadge v-if="row.decision" kind="inspectionDecision" :value="row.decision" size="sm" /><span v-else class="text-muted">—</span></template>
      <template #empty><UiEmpty icon="clipboard-check" title="Aucun contrôle" hint="Un contrôle est créé quand on demande l’inspection d’un lot." /></template>
    </UiDataTable>
  </div>
</template>
