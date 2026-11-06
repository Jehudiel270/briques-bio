<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Order } from '#shared/types/domain'

/** Table des commandes. `base` : préfixe de route du détail (ex. /ops/commercial/commandes). */
const props = defineProps<{ base: string; rows?: Order[] }>()
const db = useDb()
const L = useLookups()
const data = computed(() => [...(props.rows ?? db.all('orders'))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const clientOf = (o: Order) => (o.companyId ? L.companyName(o.companyId) : L.userName(o.userId))
const columns = [
  { key: 'ref', label: 'Commande', sortable: true },
  { key: 'client', label: 'Client', value: clientOf },
  { key: 'createdAt', label: 'Date', sortable: true, hide: 'md' as const, value: (o: Order) => fdate(o.createdAt), sortValue: (o: Order) => o.createdAt },
  { key: 'total', label: 'Total', align: 'right' as const, sortable: true, value: (o: Order) => fcfa(o.total), sortValue: (o: Order) => o.total },
  { key: 'paid', label: 'Réglé', align: 'right' as const, hide: 'lg' as const, value: (o: Order) => fcfa(o.amountPaid), sortValue: (o: Order) => o.amountPaid },
  { key: 'payment', label: 'Paiement', hide: 'lg' as const, value: (o: Order) => STATUS.payment[o.paymentStatus].label },
  { key: 'status', label: 'Statut', value: (o: Order) => STATUS.order[o.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.order).map(([value, m]) => ({ value, label: m.label })), accessor: (o: Order) => o.status },
  { key: 'payment', label: 'Paiement', options: Object.entries(STATUS.payment).map(([value, m]) => ({ value, label: m.label })), accessor: (o: Order) => o.paymentStatus },
]
</script>

<template>
  <UiDataTable :rows="data" :columns="columns" :filters="filters" export-name="commandes" :initial-sort="{ key: 'createdAt', dir: 'desc' }" dense @row-click="(o: Order) => navigateTo(`${base}/${o.id}`)">
    <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span><UiBadge v-if="row.awaitingStock" class="ml-2" tone="warning" size="sm" icon="hourglass">Attente lots</UiBadge></template>
    <template #cell-payment="{ row }"><UiStatusBadge kind="payment" :value="row.paymentStatus" size="sm" /></template>
    <template #cell-status="{ row }"><UiStatusBadge kind="order" :value="row.status" size="sm" /></template>
    <template #empty><UiEmpty icon="package" title="Aucune commande" hint="Les commandes issues des devis ou des commandes directes apparaîtront ici." /></template>
  </UiDataTable>
</template>
