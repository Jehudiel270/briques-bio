<script setup lang="ts">
import { fdate, fmtAddress } from '#shared/utils/format'

usePageTitle('Tableau de bord logistique')
const db = useDb()
const L = useLookups()

const deliveries = computed(() => db.all('deliveries'))
const toPrepare = computed(() => deliveries.value.filter((d) => ['to_prepare', 'preparing'].includes(d.status)))
const planned = computed(() => deliveries.value.filter((d) => d.status === 'planned'))
const inTransit = computed(() => deliveries.value.filter((d) => d.status === 'in_transit'))
const failed = computed(() => deliveries.value.filter((d) => d.status === 'failed'))
const openIncidents = computed(() => deliveries.value.flatMap((d) => d.incidents.filter((i) => !i.resolved).map((i) => ({ d, i }))))
const awaitingStock = computed(() => db.all('orders').filter((o) => o.awaitingStock && o.status !== 'cancelled'))
const upcoming = computed(() => deliveries.value.filter((d) => ['planned', 'in_transit', 'preparing', 'to_prepare'].includes(d.status)).sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999')).slice(0, 7))
const readyLots = computed(() => db.all('productionLots').filter((l) => l.qcStatus === 'released' && l.availableQty > 0).reduce((a, l) => a + l.availableQty, 0))
</script>

<template>
  <div>
    <UiPageHeader title="Tableau de bord logistique" description="Livraisons à préparer, à expédier et incidents en cours." icon="layout-dashboard">
      <template #actions><UiButton variant="outline" icon="package-check" to="/ops/logistique/expeditions">Toutes les expéditions</UiButton></template>
    </UiPageHeader>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="À préparer" :value="toPrepare.length" icon="clipboard-list" tone="warning" to="/ops/logistique/expeditions" />
      <UiStat label="Planifiées" :value="planned.length" icon="calendar-clock" tone="info" to="/ops/logistique/tournees" />
      <UiStat label="En transit" :value="inTransit.length" icon="truck" tone="accent" to="/ops/logistique/tournees" />
      <UiStat label="Incidents ouverts" :value="openIncidents.length" icon="triangle-alert" :tone="openIncidents.length ? 'danger' : 'success'" to="/ops/logistique/incidents" />
      <UiStat label="Échecs de livraison" :value="failed.length" icon="circle-x" :tone="failed.length ? 'danger' : 'neutral'" to="/ops/logistique/historique" />
      <UiStat label="Commandes en attente de lots" :value="awaitingStock.length" icon="hourglass" :tone="awaitingStock.length ? 'warning' : 'neutral'" />
      <UiStat label="Pièces libérées disponibles" :value="readyLots" icon="boxes" tone="success" hint="Lots validés par la qualité" />
      <UiStat label="Livrées (total)" :value="deliveries.filter((d) => d.status === 'delivered').length" icon="badge-check" tone="neutral" to="/ops/logistique/historique" />
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <UiCard title="Prochaines expéditions" icon="calendar-range">
        <UiEmpty v-if="!upcoming.length" compact icon="package-check" title="Aucune expédition à venir" hint="Une livraison apparaît dès qu’une commande passe en préparation." />
        <ul v-else class="divide-y divide-line">
          <li v-for="d in upcoming" :key="d.id">
            <NuxtLink :to="`/ops/logistique/expeditions/${d.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ d.ref }} <span class="font-normal text-muted">· {{ L.orderRef(d.orderId) }}</span></p>
                <p class="truncate text-[13px] text-muted">{{ d.plannedDate ? fdate(d.plannedDate) : 'À planifier' }} · {{ fmtAddress(d.address) }}{{ d.carrierId ? ` · ${L.carrierName(d.carrierId)}` : '' }}</p>
              </div>
              <UiStatusBadge kind="delivery" :value="d.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <div class="flex flex-col gap-5">
        <UiCard title="Incidents à traiter" icon="triangle-alert">
          <UiEmpty v-if="!openIncidents.length" compact icon="shield-check" title="Aucun incident ouvert" />
          <ul v-else class="space-y-3">
            <li v-for="x in openIncidents.slice(0, 4)" :key="x.i.id" class="text-sm">
              <NuxtLink :to="`/ops/logistique/expeditions/${x.d.id}`" class="font-medium hover:underline">{{ x.d.ref }}</NuxtLink>
              <p class="text-[13px] text-muted">{{ x.i.description }}</p>
            </li>
          </ul>
        </UiCard>
        <UiCard v-if="awaitingStock.length" title="Commandes sans lots réservés" icon="hourglass">
          <ul class="space-y-2 text-sm"><li v-for="o in awaitingStock.slice(0, 4)" :key="o.id" class="flex items-center justify-between gap-2"><span class="font-medium">{{ o.ref }}</span><UiBadge tone="warning" size="sm" icon="hourglass">En attente</UiBadge></li></ul>
          <p class="mt-3 text-[13px] text-muted">Seuls les lots libérés par la qualité peuvent être expédiés.</p>
        </UiCard>
      </div>
    </div>
  </div>
</template>
