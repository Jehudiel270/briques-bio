<script setup lang="ts">
import { fdatetime, kg, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { StockMovement } from '#shared/types/domain'

usePageTitle('Mouvements de stock')
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('stockMovements')].sort((a, b) => b.at.localeCompare(a.at)))
const itemRef = (m: StockMovement) => (m.itemKind === 'raw' ? L.rawLotRef(m.itemId) : L.lotRef(m.itemId))
const itemLink = (m: StockMovement) => (m.itemKind === 'raw' ? `/ops/appro/lots-matiere/${m.itemId}` : `/ops/production/lots/${m.itemId}`)
const qty = (m: StockMovement) => (m.unit === 'kg' ? kg(m.qty) : `${num(m.qty)} pièces`)
const columns = [
  { key: 'at', label: 'Date', sortable: true, value: (m: StockMovement) => fdatetime(m.at), sortValue: (m: StockMovement) => m.at },
  { key: 'type', label: 'Type', value: (m: StockMovement) => STATUS.stockMovement[m.type].label },
  { key: 'item', label: 'Lot', value: itemRef },
  { key: 'qty', label: 'Quantité', align: 'right' as const, sortable: true, value: qty, sortValue: (m: StockMovement) => m.qty },
  { key: 'from', label: 'Origine', hide: 'lg' as const, value: (m: StockMovement) => L.locationName(m.fromLocationId) },
  { key: 'to', label: 'Destination', hide: 'lg' as const, value: (m: StockMovement) => L.locationName(m.toLocationId) },
  { key: 'user', label: 'Par', hide: 'md' as const, value: (m: StockMovement) => L.userName(m.userId) },
  { key: 'note', label: 'Note', hide: 'lg' as const, value: (m: StockMovement) => m.note ?? '' },
]
const filters = [
  { key: 'type', label: 'Type', options: Object.entries(STATUS.stockMovement).map(([value, m]) => ({ value, label: m.label })), accessor: (m: StockMovement) => m.type },
  { key: 'kind', label: 'Nature', options: [{ value: 'raw', label: 'Matière première' }, { value: 'finished', label: 'Produits finis' }], accessor: (m: StockMovement) => m.itemKind },
]
</script>

<template>
  <div>
    <UiPageHeader title="Mouvements de stock" description="Journal complet des entrées, sorties, réservations, transferts, ajustements et pertes." icon="arrow-left-right" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="mouvements-stock" :initial-sort="{ key: 'at', dir: 'desc' }" dense>
      <template #cell-type="{ row }"><UiStatusBadge kind="stockMovement" :value="row.type" size="sm" /></template>
      <template #cell-item="{ row }"><NuxtLink :to="itemLink(row)" class="font-medium hover:underline">{{ itemRef(row) }}</NuxtLink></template>
      <template #empty><UiEmpty icon="arrow-left-right" title="Aucun mouvement" /></template>
    </UiDataTable>
  </div>
</template>
