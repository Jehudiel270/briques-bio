<script setup lang="ts">
import { fdate, kg, num } from '#shared/utils/format'

usePageTitle('Tableau de bord production')
const db = useDb()
const L = useLookups()
const { rawByPolymer } = useStockView()

const orders = computed(() => db.all('workOrders'))
const open = computed(() => orders.value.filter((w) => !['completed', 'cancelled'].includes(w.status)))
const running = computed(() => orders.value.filter((w) => w.status === 'in_progress'))
const done = computed(() => orders.value.filter((w) => w.status === 'completed'))
const produced = computed(() => done.value.reduce((a, w) => a + w.producedQty, 0))
const scrap = computed(() => done.value.reduce((a, w) => a + w.scrapQty, 0))
const scrapRate = computed(() => (produced.value + scrap.value ? Math.round((scrap.value / (produced.value + scrap.value)) * 1000) / 10 : null))
const awaitingQc = computed(() => db.all('productionLots').filter((l) => ['pending_qc', 'in_qc'].includes(l.qcStatus)))
const events = computed(() => db.all('productionEvents').filter((e) => !e.resolved).sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
const available = computed(() => rawByPolymer.value.reduce((a, r) => a + r.free, 0))
const upcoming = computed(() => open.value.slice().sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)).slice(0, 6))
const waitingOrders = computed(() => db.all('orders').filter((o) => o.awaitingStock && o.status !== 'cancelled').length)
</script>

<template>
  <div>
    <UiPageHeader title="Tableau de bord production" description="Ordres de fabrication, rendements et anomalies en cours." icon="layout-dashboard">
      <template #actions><UiButton icon="plus" to="/ops/production/ordres/nouveau">Nouvel ordre</UiButton></template>
    </UiPageHeader>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Ordres ouverts" :value="open.length" icon="clipboard-list" tone="info" to="/ops/production/ordres" :hint="`${running.length} en production`" />
      <UiStat label="Pièces produites (clôturés)" :value="num(produced)" icon="package-check" tone="success" />
      <UiStat label="Taux de rebut" :value="scrapRate != null ? `${scrapRate} %` : '—'" icon="trash-2" :tone="scrapRate != null && scrapRate > 8 ? 'warning' : 'neutral'" to="/ops/production/rendements" />
      <UiStat label="Lots en attente qualité" :value="awaitingQc.length" icon="microscope" :tone="awaitingQc.length ? 'warning' : 'neutral'" to="/ops/production/lots" />
      <UiStat label="Matière libre" :value="kg(available)" icon="recycle" tone="accent" />
      <UiStat label="Anomalies ouvertes" :value="events.length" icon="triangle-alert" :tone="events.length ? 'danger' : 'success'" to="/ops/production/anomalies" />
      <UiStat label="Commandes en attente de lots" :value="waitingOrders" icon="hourglass" :tone="waitingOrders ? 'warning' : 'neutral'" hint="Production à lancer" />
      <UiStat label="Ordres clôturés" :value="done.length" icon="badge-check" tone="neutral" />
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <UiCard title="Ordres à suivre" icon="clipboard-list">
        <UiEmpty v-if="!upcoming.length" compact icon="clipboard-list" title="Aucun ordre ouvert" hint="Créez un ordre de fabrication pour planifier la production.">
          <UiButton icon="plus" to="/ops/production/ordres/nouveau">Nouvel ordre</UiButton>
        </UiEmpty>
        <ul v-else class="divide-y divide-line">
          <li v-for="w in upcoming" :key="w.id">
            <NuxtLink :to="`/ops/production/ordres/${w.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ w.ref }} <span class="font-normal text-muted">· {{ L.productName(w.productId) }}</span></p><p class="text-[13px] text-muted">{{ num(w.plannedQty) }} pièces · {{ fdate(w.plannedStart) }} → {{ fdate(w.plannedEnd) }}</p></div>
              <UiStatusBadge kind="workOrder" :value="w.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
      <div class="flex flex-col gap-5">
        <UiCard title="Anomalies ouvertes" icon="triangle-alert">
          <UiEmpty v-if="!events.length" compact icon="shield-check" title="Aucune anomalie ouverte" />
          <ul v-else class="space-y-3 text-sm"><li v-for="e in events.slice(0, 4)" :key="e.id"><NuxtLink :to="`/ops/production/ordres/${e.workOrderId}`" class="font-medium hover:underline">{{ L.workOrderRef(e.workOrderId) }}</NuxtLink><p class="text-[13px] text-muted">{{ e.description }}</p></li></ul>
        </UiCard>
        <UiCard title="Lots à contrôler" icon="microscope">
          <UiEmpty v-if="!awaitingQc.length" compact icon="shield-check" title="Rien en attente" />
          <ul v-else class="space-y-2 text-sm"><li v-for="l in awaitingQc.slice(0, 5)" :key="l.id" class="flex items-center justify-between gap-2"><NuxtLink :to="`/ops/production/lots/${l.id}`" class="font-medium hover:underline">{{ l.ref }}</NuxtLink><UiStatusBadge kind="lotQc" :value="l.qcStatus" size="sm" /></li></ul>
        </UiCard>
      </div>
    </div>
    <SiteNotice class="mt-6" kind="technical" dense />
  </div>
</template>
