<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'

usePageTitle('Tableau de bord approvisionnement')
const db = useDb()
const L = useLookups()
const { rawByPolymer } = useStockView()

const toReview = computed(() => db.all('collections').filter((c) => ['submitted', 'under_review'].includes(c.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
const toPlan = computed(() => db.all('collections').filter((c) => c.status === 'planned' && !c.driverUserId))
const toReceive = computed(() => db.all('collections').filter((c) => ['collected', 'weighed'].includes(c.status)))
const problems = computed(() => db.all('collections').filter((c) => c.status === 'problem'))
const lowStock = computed(() => rawByPolymer.value.filter((r) => r.low))
const receipts = computed(() => [...db.all('receipts')].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5))
const totalAvailable = computed(() => rawByPolymer.value.reduce((a, r) => a + r.available, 0))
const totalQuarantine = computed(() => rawByPolymer.value.reduce((a, r) => a + r.quarantine, 0))
const stockBars = computed(() => rawByPolymer.value.filter((r) => r.available || r.quarantine).map((r) => ({ label: r.label, value: Math.round(r.available), tone: r.low ? 'danger' as const : undefined })))
</script>

<template>
  <div>
    <UiPageHeader title="Tableau de bord approvisionnement" description="Collectes à traiter, réceptions et état de la matière première." icon="layout-dashboard">
      <template #actions><UiButton icon="scale" to="/ops/appro/receptions/nouvelle">Nouvelle réception</UiButton></template>
    </UiPageHeader>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Demandes à examiner" :value="toReview.length" icon="inbox" :tone="toReview.length ? 'warning' : 'neutral'" to="/ops/appro/demandes" />
      <UiStat label="À réceptionner" :value="toReceive.length" icon="scale" tone="info" to="/ops/appro/receptions/nouvelle" />
      <UiStat label="Matière disponible" :value="kg(totalAvailable)" icon="boxes" tone="success" to="/ops/appro/stock" />
      <UiStat label="En quarantaine" :value="kg(totalQuarantine)" icon="shield-alert" :tone="totalQuarantine ? 'warning' : 'neutral'" to="/ops/appro/lots-matiere" />
    </div>

    <UiAlert v-if="lowStock.length" tone="warning" icon="trending-down" title="Seuils de matière atteints" class="mt-5">
      {{ lowStock.map((r) => r.label).join(', ') }} : le stock libre est sous le seuil d’alerte configuré. <NuxtLink to="/ops/appro/stock" class="font-medium underline">Voir le stock</NuxtLink>
    </UiAlert>

    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      <UiCard title="Demandes de collecte à traiter" icon="inbox">
        <UiEmpty v-if="!toReview.length && !problems.length" compact icon="inbox" title="Aucune demande en attente" />
        <ul v-else class="divide-y divide-line">
          <li v-for="c in [...toReview, ...problems].slice(0, 6)" :key="c.id">
            <NuxtLink :to="`/ops/appro/demandes/${c.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ c.ref }} <span class="font-normal text-muted">· {{ L.supplierName(c.supplierId) }}</span></p><p class="truncate text-[13px] text-muted">{{ kg(c.estimatedTotalKg) }} estimés · {{ c.pickupPoint.city }} · {{ fdate(c.createdAt) }}</p></div>
              <UiStatusBadge kind="collection" :value="c.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
        <p v-if="toPlan.length" class="mt-3 text-[13px] text-muted">{{ toPlan.length }} collecte(s) planifiée(s) sans chauffeur.</p>
      </UiCard>

      <UiCard title="Matière disponible par plastique" icon="chart-column">
        <ChartBar v-if="stockBars.length" :data="stockBars" horizontal unit="kg" :height="230" title="Matière disponible par plastique" />
        <UiEmpty v-else compact icon="boxes" title="Aucun lot de matière en stock" />
      </UiCard>

      <UiCard title="Dernières réceptions" icon="scale" class="lg:col-span-2">
        <UiEmpty v-if="!receipts.length" compact icon="scale" title="Aucune réception" />
        <ul v-else class="divide-y divide-line">
          <li v-for="r in receipts" :key="r.id">
            <NuxtLink :to="`/ops/appro/receptions/${r.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ r.ref }} <span class="font-normal text-muted">· {{ L.supplierName(r.supplierId) }}</span></p><p class="text-[13px] text-muted">{{ fdate(r.receivedAt) }} · {{ kg(r.weighedKg) }} pesés</p></div>
              <UiStatusBadge kind="receipt" :value="r.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </div>
    <SiteNotice class="mt-6" kind="demo" dense />
  </div>
</template>
