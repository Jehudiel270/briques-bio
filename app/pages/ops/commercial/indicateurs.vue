<script setup lang="ts">
import { fcfa, fmonth } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import { downloadCsv } from '~/utils/csv'

usePageTitle('Indicateurs commerciaux')
const db = useDb()
const L = useLookups()
const orders = computed(() => db.all('orders').filter((o) => o.status !== 'cancelled'))
const quotes = computed(() => db.all('quotes'))

const answered = computed(() => quotes.value.filter((q) => ['accepted', 'declined', 'expired'].includes(q.status)))
const accepted = computed(() => quotes.value.filter((q) => q.status === 'accepted'))
const conversion = computed(() => (answered.value.length ? Math.round((accepted.value.length / answered.value.length) * 100) : null))
const collected = computed(() => orders.value.reduce((a, o) => a + o.amountPaid, 0))
const booked = computed(() => orders.value.reduce((a, o) => a + o.total, 0))
const average = computed(() => (orders.value.length ? Math.round(booked.value / orders.value.length) : 0))

const byStatus = computed(() => Object.entries(STATUS.order).map(([k, m]) => ({ label: m.label, value: db.all('orders').filter((o) => o.status === k).length })).filter((d) => d.value > 0))
const months = computed(() => {
  const map = new Map<string, number>()
  for (const o of orders.value) { const k = o.createdAt.slice(0, 7); map.set(k, (map.get(k) ?? 0) + o.total) }
  const keys = [...map.keys()].sort()
  return { labels: keys.map((k) => fmonth(k)), values: keys.map((k) => map.get(k)!) }
})
const topProducts = computed(() => {
  const map = new Map<string, number>()
  for (const o of orders.value) for (const l of o.lines) map.set(l.productId, (map.get(l.productId) ?? 0) + Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100)))
  return [...map.entries()].map(([id, value]) => ({ label: L.productName(id), value })).sort((a, b) => b.value - a.value).slice(0, 6)
})

function exportOrders() {
  downloadCsv('commandes-demo', db.all('orders').map((o) => ({ reference: o.ref, date: o.createdAt.slice(0, 10), client: o.companyId ? L.companyName(o.companyId) : L.userName(o.userId), statut: STATUS.order[o.status].label, paiement: STATUS.payment[o.paymentStatus].label, total_fcfa: o.total, regle_fcfa: o.amountPaid })))
}
function exportQuotes() {
  downloadCsv('devis-demo', quotes.value.map((q) => ({ reference: q.ref, date: q.createdAt.slice(0, 10), client: q.companyId ? L.companyName(q.companyId) : q.contact.name, statut: STATUS.quote[q.status].label, produits: q.lines.map((l) => `${l.label} x${l.qty}`).join(' | ') })))
}
</script>

<template>
  <div>
    <UiPageHeader title="Indicateurs et export" description="Chiffres issus des données de démonstration : à ne pas interpréter comme des résultats réels." icon="chart-column">
      <template #actions>
        <UiButton variant="outline" icon="download" @click="exportQuotes">Export devis (CSV)</UiButton>
        <UiButton icon="download" @click="exportOrders">Export commandes (CSV)</UiButton>
      </template>
    </UiPageHeader>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Commandes enregistrées" :value="fcfa(booked)" icon="package" tone="info" :hint="`${orders.length} commande(s)`" demo />
      <UiStat label="Encaissé (simulé)" :value="fcfa(collected)" icon="wallet" tone="success" demo />
      <UiStat label="Panier moyen" :value="fcfa(average)" icon="shopping-basket" tone="accent" demo />
      <UiStat label="Taux d’acceptation des devis" :value="conversion != null ? `${conversion} %` : '—'" icon="percent" tone="warning" :hint="`${accepted.length} acceptés sur ${answered.length} répondus`" />
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      <UiCard title="Commandes par statut" icon="chart-pie"><ChartDonut v-if="byStatus.length" :data="byStatus" :center="String(orders.length)" center-label="commandes" title="Répartition des commandes par statut" /><UiEmpty v-else compact icon="chart-pie" title="Pas encore de commandes" /></UiCard>
      <UiCard title="Montant commandé par mois" icon="chart-column"><ChartBar v-if="months.values.length" :labels="months.labels" :series="[{ name: 'Montant (FCFA)', values: months.values }]" unit="FCFA" :height="220" title="Montant commandé par mois" /><UiEmpty v-else compact icon="chart-column" title="Pas encore de données" /></UiCard>
      <UiCard title="Produits les plus vendus (montant)" icon="trophy" class="lg:col-span-2"><ChartBar v-if="topProducts.length" :data="topProducts" horizontal unit="FCFA" :height="240" title="Produits par montant commandé" /><UiEmpty v-else compact icon="trophy" title="Pas encore de ventes" /></UiCard>
    </div>
    <SiteNotice class="mt-6" kind="demo" />
  </div>
</template>
