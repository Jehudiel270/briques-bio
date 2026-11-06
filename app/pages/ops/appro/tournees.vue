<script setup lang="ts">
import { fdate, fdatetime, kg } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'

usePageTitle('Tournées de collecte')
const db = useDb()
const L = useLookups()
const tab = ref('active')
const all = computed(() => [...db.all('tours')].sort((a, b) => b.date.localeCompare(a.date)))
const active = computed(() => all.value.filter((t) => ['planned', 'in_progress'].includes(t.status)))
const past = computed(() => all.value.filter((t) => ['done', 'cancelled'].includes(t.status)))
const shown = computed(() => (tab.value === 'active' ? active.value : past.value))
const tabs = computed(() => [{ value: 'active', label: 'À venir et en cours', count: active.value.length }, { value: 'past', label: 'Terminées', count: past.value.length }])
const colsOf = (t: { collectionIds: string[] }) => t.collectionIds.map((id) => db.peek('collections', id)).filter(Boolean) as NonNullable<ReturnType<typeof db.peek<'collections'>>>[]
</script>

<template>
  <div>
    <UiPageHeader title="Tournées de collecte" description="Regroupement des enlèvements par chauffeur et par jour." icon="route" />
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les tournées" class="mb-4" />
    <UiEmpty v-if="!shown.length" icon="route" title="Aucune tournée" hint="Une tournée se crée automatiquement quand vous planifiez une collecte." />
    <div v-else class="grid gap-5 lg:grid-cols-2">
      <UiCard v-for="t in shown" :key="t.id" :title="t.ref" icon="route" :description="`${fdate(t.date)} · ${L.userName(t.driverUserId)} · ${t.vehicle}`">
        <template #actions><UiStatusBadge kind="tour" :value="t.status" size="sm" /></template>
        <ul class="divide-y divide-line">
          <li v-for="col in colsOf(t)" :key="col.id">
            <NuxtLink :to="`/ops/appro/demandes/${col.id}`" class="flex items-center gap-3 py-2.5 text-sm hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2">
              <Icon name="lucide:map-pin" class="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate"><span class="font-medium">{{ col.ref }}</span> · {{ col.pickupPoint.label }}<span class="text-muted"> · {{ kg(col.recordedKg ?? col.estimatedTotalKg) }}</span></span>
              <span class="text-[13px] text-muted">{{ STATUS.collection[col.status].label }}</span>
            </NuxtLink>
          </li>
        </ul>
        <p v-if="!t.collectionIds.length" class="text-sm text-muted">Aucune collecte rattachée.</p>
        <p v-if="t.startedAt || t.endedAt" class="mt-3 text-[13px] text-muted">{{ t.startedAt ? `Départ ${fdatetime(t.startedAt)}` : '' }}{{ t.endedAt ? ` · retour ${fdatetime(t.endedAt)}` : '' }}{{ t.distanceKm ? ` · ${t.distanceKm} km` : '' }}</p>
      </UiCard>
    </div>
  </div>
</template>
