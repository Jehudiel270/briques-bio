<script setup lang="ts">
import { fdate, fmtAddress } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Delivery } from '#shared/types/domain'

/** Table des livraisons. `base` : préfixe de route du détail (ex. /ops/logistique/expeditions). `statuses` limite la liste. */
const props = defineProps<{ base: string; statuses?: Delivery['status'][]; exportName?: string }>()
const db = useDb()
const L = useLookups()
const data = computed(() => db.all('deliveries').filter((d) => !props.statuses || props.statuses.includes(d.status)).sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999')))
const columns = [
  { key: 'ref', label: 'Livraison', sortable: true },
  { key: 'order', label: 'Commande', value: (d: Delivery) => L.orderRef(d.orderId) },
  { key: 'address', label: 'Destination', hide: 'md' as const, value: (d: Delivery) => fmtAddress(d.address) },
  { key: 'plannedDate', label: 'Prévue', sortable: true, hide: 'sm' as const, value: (d: Delivery) => (d.plannedDate ? fdate(d.plannedDate) : 'À planifier'), sortValue: (d: Delivery) => d.plannedDate ?? '9999' },
  { key: 'carrier', label: 'Transporteur', hide: 'lg' as const, value: (d: Delivery) => (d.carrierId ? L.carrierName(d.carrierId) : '—') },
  { key: 'incidents', label: 'Incidents', hide: 'lg' as const, align: 'right' as const, value: (d: Delivery) => d.incidents.filter((i) => !i.resolved).length },
  { key: 'status', label: 'Statut', value: (d: Delivery) => STATUS.delivery[d.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.delivery).map(([value, m]) => ({ value, label: m.label })), accessor: (d: Delivery) => d.status }]
</script>

<template>
  <UiDataTable :rows="data" :columns="columns" :filters="filters" :export-name="exportName ?? 'livraisons'" dense @row-click="(d: Delivery) => navigateTo(`${base}/${d.id}`)">
    <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
    <template #cell-incidents="{ row, value }"><UiBadge v-if="value" tone="danger" size="sm" icon="triangle-alert">{{ value }}</UiBadge><span v-else class="text-muted">—</span></template>
    <template #cell-status="{ row }"><UiStatusBadge kind="delivery" :value="row.status" size="sm" /></template>
    <template #empty><UiEmpty icon="truck" title="Aucune livraison" hint="Une livraison est créée quand une commande passe en préparation." /></template>
  </UiDataTable>
</template>
