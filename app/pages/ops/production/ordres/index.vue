<script setup lang="ts">
import { fdate, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { WorkOrder } from '#shared/types/domain'

usePageTitle('Ordres de fabrication')
const db = useDb()
const auth = useAuth()
const L = useLookups()
const rows = computed(() => [...db.all('workOrders')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const columns = [
  { key: 'ref', label: 'Ordre', sortable: true },
  { key: 'product', label: 'Produit', value: (w: WorkOrder) => L.productName(w.productId) },
  { key: 'plannedQty', label: 'Prévu', align: 'right' as const, sortable: true, value: (w: WorkOrder) => num(w.plannedQty), sortValue: (w: WorkOrder) => w.plannedQty },
  { key: 'producedQty', label: 'Produit', align: 'right' as const, hide: 'sm' as const, value: (w: WorkOrder) => num(w.producedQty) },
  { key: 'plannedStart', label: 'Début prévu', hide: 'md' as const, sortable: true, value: (w: WorkOrder) => fdate(w.plannedStart), sortValue: (w: WorkOrder) => w.plannedStart },
  { key: 'plannedEnd', label: 'Fin prévue', hide: 'lg' as const, value: (w: WorkOrder) => fdate(w.plannedEnd) },
  { key: 'status', label: 'Statut', value: (w: WorkOrder) => STATUS.workOrder[w.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.workOrder).map(([value, m]) => ({ value, label: m.label })), accessor: (w: WorkOrder) => w.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Ordres de fabrication" description="Planifiez, réservez la matière, suivez la production et clôturez pour créer un lot." icon="clipboard-list">
      <template #actions><UiButton v-if="auth.can('production.manage')" icon="plus" to="/ops/production/ordres/nouveau">Nouvel ordre</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="ordres-fabrication" :initial-sort="{ key: 'plannedStart', dir: 'desc' }" dense @row-click="(w: WorkOrder) => navigateTo(`/ops/production/ordres/${w.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="workOrder" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="clipboard-list" title="Aucun ordre de fabrication" hint="Créez un ordre pour lancer une production."><UiButton v-if="auth.can('production.manage')" icon="plus" to="/ops/production/ordres/nouveau">Nouvel ordre</UiButton></UiEmpty></template>
    </UiDataTable>
  </div>
</template>
