<script setup lang="ts">
import { fdatetime } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { QcInspection } from '#shared/types/domain'

usePageTitle('Historique des décisions')
const db = useDb()
const L = useLookups()
const rows = computed(() => db.all('qcInspections').filter((q) => q.decision).sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '')))
const columns = [
  { key: 'decidedAt', label: 'Décidé le', sortable: true, value: (q: QcInspection) => (q.decidedAt ? fdatetime(q.decidedAt) : '—'), sortValue: (q: QcInspection) => q.decidedAt ?? '' },
  { key: 'ref', label: 'Contrôle', sortable: true },
  { key: 'lot', label: 'Lot', value: (q: QcInspection) => L.lotRef(q.lotId) },
  { key: 'product', label: 'Produit', hide: 'md' as const, value: (q: QcInspection) => L.productName(L.peek('productionLots', q.lotId)?.productId) },
  { key: 'decision', label: 'Décision', value: (q: QcInspection) => STATUS.inspectionDecision[q.decision!].label },
  { key: 'by', label: 'Par', hide: 'lg' as const, value: (q: QcInspection) => L.userName(q.decidedBy) },
  { key: 'reason', label: 'Justification', hide: 'lg' as const, value: (q: QcInspection) => q.decisionReason ?? '' },
]
const filters = [{ key: 'decision', label: 'Décision', options: Object.entries(STATUS.inspectionDecision).map(([value, m]) => ({ value, label: m.label })), accessor: (q: QcInspection) => q.decision }]
</script>

<template>
  <div>
    <UiPageHeader title="Historique des décisions" description="Libérations, rejets et quarantaines, avec leur justification." icon="history" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="decisions-qualite" :initial-sort="{ key: 'decidedAt', dir: 'desc' }" dense @row-click="(q: QcInspection) => navigateTo(`/ops/qualite/controles/${q.id}`)">
      <template #cell-decision="{ row }"><UiStatusBadge :kind="'inspectionDecision'" :value="row.decision" size="sm" /></template>
      <template #empty><UiEmpty icon="history" title="Aucune décision" hint="Les décisions apparaissent après la validation d’un contrôle." /></template>
    </UiDataTable>
  </div>
</template>
