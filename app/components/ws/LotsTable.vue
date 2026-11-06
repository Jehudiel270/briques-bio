<script setup lang="ts">
import { fdate, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { ProductionLot } from '#shared/types/domain'

/** Table des lots de produits finis avec statut qualité. `base` : préfixe de route de la fiche lot. */
const props = defineProps<{ base: string }>()
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('productionLots')].sort((a, b) => b.producedAt.localeCompare(a.producedAt)))
const columns = [
  { key: 'ref', label: 'Lot', sortable: true },
  { key: 'product', label: 'Produit', value: (l: ProductionLot) => L.productName(l.productId) },
  { key: 'producedQty', label: 'Produit', align: 'right' as const, sortable: true, hide: 'sm' as const, value: (l: ProductionLot) => num(l.producedQty), sortValue: (l: ProductionLot) => l.producedQty },
  { key: 'availableQty', label: 'Disponible', align: 'right' as const, sortable: true, value: (l: ProductionLot) => num(l.availableQty), sortValue: (l: ProductionLot) => l.availableQty },
  { key: 'reservedQty', label: 'Réservé', align: 'right' as const, hide: 'md' as const, value: (l: ProductionLot) => num(l.reservedQty) },
  { key: 'shippedQty', label: 'Expédié', align: 'right' as const, hide: 'lg' as const, value: (l: ProductionLot) => num(l.shippedQty) },
  { key: 'producedAt', label: 'Produit le', hide: 'md' as const, sortable: true, value: (l: ProductionLot) => fdate(l.producedAt), sortValue: (l: ProductionLot) => l.producedAt },
  { key: 'qcStatus', label: 'Qualité', value: (l: ProductionLot) => STATUS.lotQc[l.qcStatus].label },
]
const filters = [{ key: 'qcStatus', label: 'Qualité', options: Object.entries(STATUS.lotQc).map(([value, m]) => ({ value, label: m.label })), accessor: (l: ProductionLot) => l.qcStatus }]
</script>

<template>
  <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="lots-produits" :initial-sort="{ key: 'producedAt', dir: 'desc' }" dense @row-click="(l: ProductionLot) => navigateTo(`${props.base}/${l.id}`)">
    <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
    <template #cell-qcStatus="{ row }"><UiStatusBadge kind="lotQc" :value="row.qcStatus" size="sm" /></template>
    <template #empty><UiEmpty icon="boxes" title="Aucun lot produit" hint="Un lot est créé à la clôture d’un ordre de fabrication." /></template>
  </UiDataTable>
</template>
