<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Order } from '#shared/types/domain'

usePageTitle('Mes commandes')
const db = useDb()
const rows = computed(() => [...db.all('orders')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const columns = [
  { key: 'ref', label: 'Référence', sortable: true },
  { key: 'createdAt', label: 'Date', sortable: true, hide: 'sm' as const, value: (o: Order) => fdate(o.createdAt), sortValue: (o: Order) => o.createdAt },
  { key: 'lines', label: 'Produits', hide: 'md' as const, value: (o: Order) => o.lines.map((l) => l.label).join(', ') },
  { key: 'total', label: 'Total', align: 'right' as const, sortable: true, value: (o: Order) => fcfa(o.total), sortValue: (o: Order) => o.total },
  { key: 'payment', label: 'Paiement', hide: 'lg' as const, value: (o: Order) => STATUS.payment[o.paymentStatus].label },
  { key: 'status', label: 'Statut', value: (o: Order) => STATUS.order[o.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.order).map(([value, m]) => ({ value, label: m.label })), accessor: (o: Order) => o.status },
  { key: 'payment', label: 'Paiement', options: Object.entries(STATUS.payment).map(([value, m]) => ({ value, label: m.label })), accessor: (o: Order) => o.paymentStatus },
]
</script>

<template>
  <div>
    <UiPageHeader title="Mes commandes" description="Paiement simulé, préparation, livraison et traçabilité de chaque commande." icon="package">
      <template #actions><UiButton icon="file-plus-2" to="/devis">Demander un devis</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="mes-commandes" :initial-sort="{ key: 'createdAt', dir: 'desc' }" @row-click="(o: Order) => navigateTo(`/espace/commandes/${o.id}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-payment="{ row }"><UiStatusBadge kind="payment" :value="row.paymentStatus" size="sm" /></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="order" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="package-open" title="Aucune commande" hint="Acceptez un devis ou commandez un produit autorisé à la vente."><UiButton icon="layout-grid" to="/catalogue">Voir le catalogue</UiButton></UiEmpty></template>
    </UiDataTable>
  </div>
</template>
