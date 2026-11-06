<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { CollectionRequest } from '#shared/types/domain'

usePageTitle('Demandes de collecte')
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('collections')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const columns = [
  { key: 'ref', label: 'Demande', sortable: true },
  { key: 'supplier', label: 'Collecteur', value: (c: CollectionRequest) => L.supplierName(c.supplierId) },
  { key: 'estimatedTotalKg', label: 'Estimé', align: 'right' as const, sortable: true, hide: 'sm' as const, value: (c: CollectionRequest) => kg(c.estimatedTotalKg), sortValue: (c: CollectionRequest) => c.estimatedTotalKg },
  { key: 'city', label: 'Ville', hide: 'md' as const, value: (c: CollectionRequest) => c.pickupPoint.city },
  { key: 'scheduledAt', label: 'Enlèvement', hide: 'md' as const, sortable: true, value: (c: CollectionRequest) => (c.scheduledAt ? fdate(c.scheduledAt) : '—'), sortValue: (c: CollectionRequest) => c.scheduledAt ?? '' },
  { key: 'driver', label: 'Chauffeur', hide: 'lg' as const, value: (c: CollectionRequest) => L.userName(c.driverUserId) },
  { key: 'createdAt', label: 'Reçue le', hide: 'lg' as const, sortable: true, value: (c: CollectionRequest) => fdate(c.createdAt), sortValue: (c: CollectionRequest) => c.createdAt },
  { key: 'status', label: 'Statut', value: (c: CollectionRequest) => STATUS.collection[c.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.collection).map(([value, m]) => ({ value, label: m.label })), accessor: (c: CollectionRequest) => c.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Demandes de collecte" description="Examinez, acceptez, planifiez et suivez les collectes déposées par les collecteurs." icon="inbox" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="demandes-collecte" :initial-sort="{ key: 'createdAt', dir: 'desc' }" dense @row-click="(c: CollectionRequest) => navigateTo(`/ops/appro/demandes/${c.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="collection" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="inbox" title="Aucune demande de collecte" hint="Les demandes déposées par les collecteurs apparaissent ici." /></template>
    </UiDataTable>
  </div>
</template>
