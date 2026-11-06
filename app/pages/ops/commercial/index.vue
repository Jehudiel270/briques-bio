<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'

usePageTitle('Tableau de bord commercial')
const db = useDb()
const L = useLookups()

const quotes = computed(() => db.all('quotes'))
const orders = computed(() => db.all('orders'))
const prospects = computed(() => db.all('prospects'))
const toTake = computed(() => quotes.value.filter((q) => q.status === 'requested'))
const toPrice = computed(() => quotes.value.filter((q) => q.status === 'in_review'))
const waiting = computed(() => quotes.value.filter((q) => q.status === 'sent'))
const toPrepare = computed(() => orders.value.filter((o) => o.status === 'confirmed'))
const awaitingStock = computed(() => orders.value.filter((o) => o.awaitingStock))
const newProspects = computed(() => prospects.value.filter((p) => p.status === 'new'))
const pipeline = computed(() => prospects.value.filter((p) => ['new', 'contacted', 'qualified'].includes(p.status)).reduce((a, p) => a + (p.estimatedValue ?? 0), 0))
const queue = computed(() => [...toTake.value, ...toPrice.value].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6))
const reminders = computed(() => db.all('interactions').filter((i) => i.kind === 'reminder' && !i.done && i.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!)).slice(0, 5))
</script>

<template>
  <div>
    <UiPageHeader title="Tableau de bord commercial" description="Demandes à traiter, offres en attente de réponse et commandes à lancer." icon="layout-dashboard">
      <template #actions><UiButton variant="outline" icon="chart-column" to="/ops/commercial/indicateurs">Indicateurs</UiButton></template>
    </UiPageHeader>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Demandes à prendre" :value="toTake.length" icon="inbox" tone="info" to="/ops/commercial/devis" />
      <UiStat label="Devis à chiffrer" :value="toPrice.length" icon="calculator" tone="warning" to="/ops/commercial/devis" />
      <UiStat label="Offres en attente" :value="waiting.length" icon="send" tone="accent" to="/ops/commercial/devis" />
      <UiStat label="Commandes à lancer" :value="toPrepare.length" icon="package-open" tone="success" to="/ops/commercial/commandes" />
      <UiStat label="En attente de lots" :value="awaitingStock.length" icon="hourglass" tone="danger" to="/ops/commercial/commandes" />
      <UiStat label="Nouveaux prospects" :value="newProspects.length" icon="user-search" tone="info" to="/ops/commercial/prospects" />
      <UiStat label="Pipeline estimé (fictif)" :value="fcfa(pipeline)" icon="trending-up" tone="neutral" demo />
      <UiStat label="Commandes (total)" :value="orders.length" icon="package" tone="neutral" to="/ops/commercial/commandes" />
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <UiCard title="File des devis à traiter" icon="list-todo">
        <UiEmpty v-if="!queue.length" compact icon="party-popper" title="Aucune demande en attente" />
        <ul v-else class="divide-y divide-line">
          <li v-for="q in queue" :key="q.id">
            <NuxtLink :to="`/ops/commercial/devis/${q.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ q.ref }} <span class="font-normal text-muted">· {{ q.companyId ? L.companyName(q.companyId) : q.contact.name }}</span></p><p class="truncate text-[13px] text-muted">{{ q.lines.map((l) => l.label).join(', ') }} · {{ fdate(q.createdAt) }}</p></div>
              <UiStatusBadge kind="quote" :value="q.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
      <UiCard title="Relances à faire" icon="bell-ring">
        <template #actions><UiButton size="sm" variant="ghost" iconRight="arrow-right" to="/ops/commercial/relances">Tout voir</UiButton></template>
        <UiEmpty v-if="!reminders.length" compact icon="bell-off" title="Aucune relance prévue" />
        <ul v-else class="space-y-3"><li v-for="r in reminders" :key="r.id" class="text-sm"><p class="font-medium">{{ r.summary }}</p><p class="text-[13px] text-muted">À faire le {{ fdate(r.dueAt) }}</p></li></ul>
      </UiCard>
    </div>
  </div>
</template>
