<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'
import { POLYMER_LABEL, STATUS } from '#shared/utils/labels'
import type { RawLot } from '#shared/types/domain'

usePageTitle('Lots de matière')
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('rawLots')].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const columns = [
  { key: 'ref', label: 'Lot', sortable: true },
  { key: 'polymer', label: 'Plastique', value: (l: RawLot) => POLYMER_LABEL[l.polymer] },
  { key: 'supplier', label: 'Fournisseur', hide: 'md' as const, value: (l: RawLot) => L.supplierName(l.supplierId) },
  { key: 'kgInitial', label: 'Initial', align: 'right' as const, hide: 'sm' as const, sortable: true, value: (l: RawLot) => kg(l.kgInitial), sortValue: (l: RawLot) => l.kgInitial },
  { key: 'kgAvailable', label: 'Disponible', align: 'right' as const, sortable: true, value: (l: RawLot) => kg(l.kgAvailable), sortValue: (l: RawLot) => l.kgAvailable },
  { key: 'kgReserved', label: 'Réservé', align: 'right' as const, hide: 'lg' as const, value: (l: RawLot) => kg(l.kgReserved) },
  { key: 'location', label: 'Emplacement', hide: 'lg' as const, value: (l: RawLot) => L.locationName(l.locationId) },
  { key: 'receivedAt', label: 'Reçu le', hide: 'md' as const, sortable: true, value: (l: RawLot) => fdate(l.receivedAt), sortValue: (l: RawLot) => l.receivedAt },
  { key: 'status', label: 'Statut', value: (l: RawLot) => STATUS.rawLot[l.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.rawLot).map(([value, m]) => ({ value, label: m.label })), accessor: (l: RawLot) => l.status },
  { key: 'polymer', label: 'Plastique', options: Object.entries(POLYMER_LABEL).map(([value, label]) => ({ value, label })), accessor: (l: RawLot) => l.polymer },
]
</script>

<template>
  <div>
    <UiPageHeader title="Lots de matière" description="Chaque lot est rattaché à sa réception, son fournisseur et ses consommations en production." icon="boxes" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="lots-matiere" :initial-sort="{ key: 'receivedAt', dir: 'desc' }" dense @row-click="(l: RawLot) => navigateTo(`/ops/appro/lots-matiere/${l.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="rawLot" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="boxes" title="Aucun lot de matière" hint="Les lots sont créés à la confirmation d’une réception." /></template>
    </UiDataTable>
  </div>
</template>
