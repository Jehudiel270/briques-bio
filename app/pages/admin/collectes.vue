<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { CollectionRequest, Receipt, Tour } from '#shared/types/domain'

usePageTitle('Collectes et réceptions')
const db = useDb()
const L = useLookups()
const tab = ref('collections')
const cols = computed(() => [...db.all('collections')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const recs = computed(() => [...db.all('receipts')].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const tours = computed(() => [...db.all('tours')].sort((a, b) => b.date.localeCompare(a.date)))
const tabs = computed(() => [{ value: 'collections', label: 'Demandes', count: cols.value.length }, { value: 'receipts', label: 'Réceptions', count: recs.value.length }, { value: 'tours', label: 'Tournées', count: tours.value.length }])
const weighed = computed(() => recs.value.reduce((a, r) => a + r.weighedKg, 0))
const accepted = computed(() => recs.value.reduce((a, r) => a + r.lines.reduce((x, l) => x + l.acceptedKg, 0), 0))
const open = computed(() => cols.value.filter((c) => !['received', 'rejected', 'cancelled'].includes(c.status)).length)

const colCols = [
  { key: 'ref', label: 'Demande', sortable: true }, { key: 'supplier', label: 'Collecteur', value: (c: CollectionRequest) => L.supplierName(c.supplierId) },
  { key: 'kg', label: 'Estimé', align: 'right' as const, hide: 'sm' as const, value: (c: CollectionRequest) => kg(c.estimatedTotalKg) }, { key: 'createdAt', label: 'Reçue le', hide: 'md' as const, sortable: true, value: (c: CollectionRequest) => fdate(c.createdAt), sortValue: (c: CollectionRequest) => c.createdAt },
  { key: 'status', label: 'Statut', value: (c: CollectionRequest) => STATUS.collection[c.status].label },
]
const recCols = [
  { key: 'ref', label: 'Réception', sortable: true }, { key: 'supplier', label: 'Fournisseur', value: (r: Receipt) => L.supplierName(r.supplierId) },
  { key: 'weighed', label: 'Pesé', align: 'right' as const, value: (r: Receipt) => kg(r.weighedKg) }, { key: 'receivedAt', label: 'Date', hide: 'md' as const, sortable: true, value: (r: Receipt) => fdate(r.receivedAt), sortValue: (r: Receipt) => r.receivedAt },
  { key: 'status', label: 'Statut', value: (r: Receipt) => STATUS.receipt[r.status].label },
]
const tourCols = [
  { key: 'ref', label: 'Tournée', sortable: true }, { key: 'date', label: 'Date', sortable: true, value: (t: Tour) => fdate(t.date), sortValue: (t: Tour) => t.date },
  { key: 'driver', label: 'Chauffeur', hide: 'sm' as const, value: (t: Tour) => L.userName(t.driverUserId) }, { key: 'n', label: 'Collectes', align: 'right' as const, value: (t: Tour) => t.collectionIds.length },
  { key: 'status', label: 'Statut', value: (t: Tour) => STATUS.tour[t.status].label },
]
</script>

<template>
  <div>
    <UiPageHeader title="Collectes et réceptions" description="Supervision de l’approvisionnement : demandes, pesées et tournées." icon="truck">
      <template #actions><UiButton variant="outline" icon="arrow-right" to="/ops/appro">Espace approvisionnement</UiButton></template>
    </UiPageHeader>
    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <UiStat label="Collectes en cours" :value="open" icon="truck" tone="info" /><UiStat label="Matière pesée" :value="kg(weighed)" icon="scale" tone="success" demo /><UiStat label="Matière acceptée" :value="kg(accepted)" icon="circle-check" tone="accent" demo />
    </div>
    <UiTabs v-model="tab" :items="tabs" aria-label="Type d’enregistrement" class="mb-4" />
    <UiDataTable v-if="tab === 'collections'" :rows="cols" :columns="colCols" dense export-name="collectes" @row-click="(c: CollectionRequest) => navigateTo(`/ops/appro/demandes/${c.id}`)">
      <template #cell-status="{ row }"><UiStatusBadge kind="collection" :value="row.status" size="sm" /></template>
    </UiDataTable>
    <UiDataTable v-else-if="tab === 'receipts'" :rows="recs" :columns="recCols" dense export-name="receptions" @row-click="(r: Receipt) => navigateTo(`/ops/appro/receptions/${r.id}`)">
      <template #cell-status="{ row }"><UiStatusBadge kind="receipt" :value="row.status" size="sm" /></template>
    </UiDataTable>
    <UiDataTable v-else :rows="tours" :columns="tourCols" dense export-name="tournees" @row-click="() => navigateTo('/ops/appro/tournees')">
      <template #cell-status="{ row }"><UiStatusBadge kind="tour" :value="row.status" size="sm" /></template>
    </UiDataTable>
  </div>
</template>
