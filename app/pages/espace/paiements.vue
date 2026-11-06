<script setup lang="ts">
import { fcfa, fdatetime } from '#shared/utils/format'
import { PAYMENT_METHOD_LABEL, STATUS } from '#shared/utils/labels'
import type { Payment } from '#shared/types/domain'

usePageTitle('Mes paiements')
const db = useDb()
const L = useLookups()
const rows = computed(() => [...db.all('payments')].sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt)))
const paid = computed(() => rows.value.filter((p) => p.status === 'succeeded' && p.kind !== 'refund').reduce((a, p) => a + p.amount, 0))
const refunded = computed(() => rows.value.filter((p) => p.kind === 'refund').reduce((a, p) => a + p.amount, 0))
const columns = [
  { key: 'ref', label: 'Référence', sortable: true },
  { key: 'date', label: 'Date', sortable: true, hide: 'sm' as const, value: (p: Payment) => fdatetime(p.paidAt ?? p.createdAt), sortValue: (p: Payment) => p.paidAt ?? p.createdAt },
  { key: 'order', label: 'Commande', value: (p: Payment) => L.orderRef(p.orderId) },
  { key: 'method', label: 'Moyen', hide: 'md' as const, value: (p: Payment) => PAYMENT_METHOD_LABEL[p.method] },
  { key: 'amount', label: 'Montant', align: 'right' as const, sortable: true, value: (p: Payment) => `${p.kind === 'refund' ? '− ' : ''}${fcfa(p.amount)}`, sortValue: (p: Payment) => p.amount },
  { key: 'status', label: 'Statut', value: (p: Payment) => STATUS.paymentTx[p.status].label },
]
</script>

<template>
  <div>
    <UiPageHeader title="Mes paiements" description="Historique des règlements simulés. Aucune transaction réelle n’est effectuée." icon="wallet" />
    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <UiStat label="Réglé (simulé)" :value="fcfa(paid)" icon="circle-check" tone="success" demo />
      <UiStat label="Remboursé (simulé)" :value="fcfa(refunded)" icon="undo-2" tone="neutral" demo />
      <UiStat label="Paiements" :value="rows.length" icon="receipt" tone="info" />
    </div>
    <UiDataTable :rows="rows" :columns="columns" export-name="mes-paiements" :initial-sort="{ key: 'date', dir: 'desc' }">
      <template #cell-ref="{ row }"><span class="tnum font-medium">{{ row.ref }}</span></template>
      <template #cell-order="{ row }"><NuxtLink :to="`/espace/commandes/${row.orderId}`" class="hover:underline">{{ L.orderRef(row.orderId) }}</NuxtLink></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="paymentTx" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="wallet" title="Aucun paiement" hint="Les règlements apparaissent ici après le paiement d’une commande." /></template>
    </UiDataTable>
    <div class="mt-5"><SiteNotice kind="simulated" /></div>
  </div>
</template>
