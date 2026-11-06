<script setup lang="ts">
import { fdate, fcfa, kg } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Receipt } from '#shared/types/domain'

usePageTitle('Réceptions et pesées')
const db = useDb()
const L = useLookups()
const auth = useAuth()
const rows = computed(() => [...db.all('receipts')].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const waiting = computed(() => db.all('collections').filter((c) => ['collected', 'weighed'].includes(c.status)))
const acceptedOf = (r: Receipt) => r.lines.reduce((a, l) => a + l.acceptedKg, 0)
const columns = [
  { key: 'ref', label: 'Réception', sortable: true },
  { key: 'supplier', label: 'Fournisseur', value: (r: Receipt) => L.supplierName(r.supplierId) },
  { key: 'receivedAt', label: 'Date', sortable: true, hide: 'sm' as const, value: (r: Receipt) => fdate(r.receivedAt), sortValue: (r: Receipt) => r.receivedAt },
  { key: 'weighedKg', label: 'Pesé', align: 'right' as const, sortable: true, value: (r: Receipt) => kg(r.weighedKg), sortValue: (r: Receipt) => r.weighedKg },
  { key: 'accepted', label: 'Accepté', align: 'right' as const, hide: 'md' as const, value: (r: Receipt) => kg(acceptedOf(r)), sortValue: (r: Receipt) => acceptedOf(r) },
  { key: 'payout', label: 'Rémunération (simulée)', align: 'right' as const, hide: 'lg' as const, value: (r: Receipt) => (r.payout ? fcfa(r.payout.amount) : '—') },
  { key: 'status', label: 'Statut', value: (r: Receipt) => STATUS.receipt[r.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.receipt).map(([value, m]) => ({ value, label: m.label })), accessor: (r: Receipt) => r.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Réceptions et pesées" description="Pesée à l’arrivée, décision par type de plastique et création des lots de matière." icon="scale">
      <template #actions><UiButton v-if="auth.can('receipts.manage')" icon="plus" to="/ops/appro/receptions/nouvelle">Nouvelle réception</UiButton></template>
    </UiPageHeader>
    <UiAlert v-if="waiting.length" tone="info" icon="truck" :title="`${waiting.length} collecte(s) attendent d’être réceptionnée(s)`" class="mb-4">
      <span v-for="c in waiting" :key="c.id" class="mr-2 inline-block"><NuxtLink :to="`/ops/appro/receptions/nouvelle?collection=${c.id}`" class="font-medium underline">{{ c.ref }}</NuxtLink></span>
    </UiAlert>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="receptions" :initial-sort="{ key: 'receivedAt', dir: 'desc' }" dense @row-click="(r: Receipt) => navigateTo(`/ops/appro/receptions/${r.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="receipt" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="scale" title="Aucune réception" hint="Réceptionnez une collecte pour créer les lots de matière." /></template>
    </UiDataTable>
  </div>
</template>
