<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Invoice } from '#shared/types/domain'

/** Table des factures fictives (aucune valeur comptable). `orderBase` : préfixe de route des commandes. */
const props = defineProps<{ orderBase: string }>()
const db = useDb()
const L = useLookups()
const data = computed(() => [...db.all('invoices')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const total = computed(() => data.value.filter((i) => i.status !== 'cancelled').reduce((a, i) => a + i.amount, 0))
const unpaid = computed(() => data.value.filter((i) => ['issued', 'overdue'].includes(i.status)).reduce((a, i) => a + i.amount, 0))
const columns = [
  { key: 'ref', label: 'Facture', sortable: true },
  { key: 'client', label: 'Client', value: (i: Invoice) => (i.companyId ? L.companyName(i.companyId) : L.userName(i.userId)) },
  { key: 'order', label: 'Commande', hide: 'sm' as const, value: (i: Invoice) => L.orderRef(i.orderId) },
  { key: 'issuedAt', label: 'Émise le', sortable: true, hide: 'md' as const, value: (i: Invoice) => (i.issuedAt ? fdate(i.issuedAt) : '—'), sortValue: (i: Invoice) => i.issuedAt ?? '' },
  { key: 'dueAt', label: 'Échéance', hide: 'lg' as const, value: (i: Invoice) => (i.dueAt ? fdate(i.dueAt) : '—') },
  { key: 'amount', label: 'Montant', align: 'right' as const, sortable: true, value: (i: Invoice) => fcfa(i.amount), sortValue: (i: Invoice) => i.amount },
  { key: 'status', label: 'Statut', value: (i: Invoice) => STATUS.invoice[i.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.invoice).map(([value, m]) => ({ value, label: m.label })), accessor: (i: Invoice) => i.status }]
</script>

<template>
  <div class="flex flex-col gap-4">
    <SiteNotice kind="document" dense />
    <div class="grid gap-4 sm:grid-cols-2">
      <UiStat label="Facturé (fictif)" :value="fcfa(total)" icon="receipt-text" tone="info" demo />
      <UiStat label="Non réglé (fictif)" :value="fcfa(unpaid)" icon="clock" tone="warning" demo />
    </div>
    <UiDataTable :rows="data" :columns="columns" :filters="filters" export-name="factures-simulees" dense @row-click="(i: Invoice) => navigateTo(`${props.orderBase}/${i.orderId}`)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="invoice" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="receipt-text" title="Aucune facture" hint="Une facture fictive est émise à l’acceptation d’un devis." /></template>
    </UiDataTable>
  </div>
</template>
