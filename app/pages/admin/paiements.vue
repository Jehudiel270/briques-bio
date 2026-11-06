<script setup lang="ts">
import { fcfa, fdatetime } from '#shared/utils/format'
import { PAYMENT_METHOD_LABEL, STATUS } from '#shared/utils/labels'
import type { Payment } from '#shared/types/domain'

usePageTitle('Paiements et litiges')
const db = useDb()
const L = useLookups()
const tab = ref('payments')
const payments = computed(() => [...db.all('payments')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const disputed = computed(() => db.all('orders').filter((o) => ['disputed', 'partially_refunded', 'refunded', 'failed'].includes(o.paymentStatus)))
const sum = (f: (p: Payment) => boolean) => payments.value.filter(f).reduce((a, p) => a + p.amount, 0)
const received = computed(() => sum((p) => p.status === 'succeeded' && p.kind !== 'refund'))
const refunded = computed(() => sum((p) => p.kind === 'refund' && p.status !== 'failed'))
const pending = computed(() => sum((p) => p.status === 'pending'))
const tabs = computed(() => [{ value: 'payments', label: 'Transactions simulées', count: payments.value.length }, { value: 'disputes', label: 'Litiges et remboursements', count: disputed.value.length }])
const KIND = { deposit: 'Acompte', balance: 'Solde', full: 'Paiement intégral', refund: 'Remboursement' } as const
const columns = [
  { key: 'ref', label: 'Référence', sortable: true },
  { key: 'order', label: 'Commande', hide: 'sm' as const, value: (p: Payment) => L.orderRef(p.orderId) },
  { key: 'client', label: 'Client', hide: 'md' as const, value: (p: Payment) => L.userName(p.userId) },
  { key: 'kind', label: 'Nature', hide: 'md' as const, value: (p: Payment) => KIND[p.kind] },
  { key: 'method', label: 'Moyen', hide: 'lg' as const, value: (p: Payment) => PAYMENT_METHOD_LABEL[p.method] },
  { key: 'createdAt', label: 'Date', sortable: true, hide: 'sm' as const, value: (p: Payment) => fdatetime(p.paidAt ?? p.createdAt), sortValue: (p: Payment) => p.createdAt },
  { key: 'amount', label: 'Montant', align: 'right' as const, sortable: true, value: (p: Payment) => `${p.kind === 'refund' ? '− ' : ''}${fcfa(p.amount)}`, sortValue: (p: Payment) => p.amount },
  { key: 'status', label: 'Statut', value: (p: Payment) => STATUS.paymentTx[p.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.paymentTx).map(([value, m]) => ({ value, label: m.label })), accessor: (p: Payment) => p.status },
  { key: 'kind', label: 'Nature', options: Object.entries(KIND).map(([value, label]) => ({ value, label })), accessor: (p: Payment) => p.kind },
  { key: 'method', label: 'Moyen', options: Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label })), accessor: (p: Payment) => p.method },
]
</script>

<template>
  <div>
    <UiPageHeader title="Paiements et litiges" description="Transactions simulées : aucune opération bancaire ou Mobile Money réelle n’est effectuée." icon="wallet" />
    <SiteNotice kind="simulated" class="mb-5" />
    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <UiStat label="Encaissé (simulé)" :value="fcfa(received)" icon="wallet" tone="success" demo /><UiStat label="En attente" :value="fcfa(pending)" icon="clock" tone="warning" demo /><UiStat label="Remboursé (simulé)" :value="fcfa(refunded)" icon="undo-2" tone="danger" demo />
    </div>
    <UiTabs v-model="tab" :items="tabs" aria-label="Paiements ou litiges" class="mb-4" />
    <UiDataTable v-if="tab === 'payments'" :rows="payments" :columns="columns" :filters="filters" dense export-name="paiements-simules" :initial-sort="{ key: 'createdAt', dir: 'desc' }" @row-click="(p: Payment) => navigateTo(`/admin/commandes/${p.orderId}`)">
      <template #cell-status="{ row }"><UiStatusBadge kind="paymentTx" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="wallet" title="Aucune transaction" /></template>
    </UiDataTable>
    <div v-else>
      <UiEmpty v-if="!disputed.length" icon="shield-check" title="Aucun litige de paiement" hint="Les commandes contestées, échouées ou remboursées apparaissent ici." />
      <ul v-else class="card divide-y divide-line">
        <li v-for="o in disputed" :key="o.id"><NuxtLink :to="`/admin/commandes/${o.id}`" class="flex items-center gap-3 p-4 hover:bg-surface-2/60"><div class="min-w-0 flex-1"><p class="font-medium">{{ o.ref }}</p><p class="text-[13px] text-muted">{{ o.companyId ? L.companyName(o.companyId) : L.userName(o.userId) }} · réglé {{ fcfa(o.amountPaid) }} sur {{ fcfa(o.total) }}</p></div><UiStatusBadge kind="payment" :value="o.paymentStatus" size="sm" /></NuxtLink></li>
      </ul>
    </div>
  </div>
</template>
