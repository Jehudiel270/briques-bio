<script setup lang="ts">
import { fdate, fmtAddress } from '#shared/utils/format'
import type { Delivery } from '#shared/types/domain'

usePageTitle('Tournées de livraison')
const db = useDb()
const L = useLookups()

const active = computed(() => db.all('deliveries').filter((d) => ['planned', 'in_transit'].includes(d.status)))
const byDay = computed(() => {
  const map = new Map<string, Delivery[]>()
  for (const d of active.value) { const k = d.plannedDate?.slice(0, 10) ?? 'none'; map.set(k, [...(map.get(k) ?? []), d]) }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({
    day, items,
    carriers: [...new Set(items.map((d) => d.carrierId))].map((id) => (id ? L.carrierName(id) : 'Sans transporteur')),
  }))
})
</script>

<template>
  <div>
    <UiPageHeader title="Tournées de livraison" description="Livraisons planifiées ou en transit, regroupées par jour." icon="route" />
    <UiEmpty v-if="!byDay.length" icon="route" title="Aucune tournée à venir" hint="Planifiez une expédition depuis sa fiche pour qu’elle apparaisse ici.">
      <UiButton icon="package-check" to="/ops/logistique/expeditions">Voir les expéditions</UiButton>
    </UiEmpty>
    <div v-else class="flex flex-col gap-5">
      <UiCard v-for="g in byDay" :key="g.day" :title="g.day === 'none' ? 'Sans date prévue' : fdate(g.day)" icon="calendar-days" :description="`${g.items.length} livraison(s) · ${g.carriers.join(', ')}`">
        <ul class="divide-y divide-line">
          <li v-for="d in g.items" :key="d.id">
            <NuxtLink :to="`/ops/logistique/expeditions/${d.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <Icon :name="d.status === 'in_transit' ? 'lucide:truck' : 'lucide:calendar-clock'" class="size-5 shrink-0 text-muted" aria-hidden="true" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ d.ref }} <span class="font-normal text-muted">· {{ L.orderRef(d.orderId) }}</span></p>
                <p class="truncate text-[13px] text-muted">{{ fmtAddress(d.address) }}{{ d.carrierId ? ` · ${L.carrierName(d.carrierId)}` : '' }}{{ d.driverName ? ` · ${d.driverName}` : '' }}</p>
              </div>
              <UiStatusBadge kind="delivery" :value="d.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>
