<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'

usePageTitle('Tournées')
const db = useDb()
const auth = useAuth()
const tours = computed(() => db.all('tours').filter((t) => t.driverUserId === auth.user.value?.id).sort((a, b) => b.date.localeCompare(a.date)))
const stops = (ids: string[]) => ids.map((id) => db.peek('collections', id)).filter((c): c is NonNullable<typeof c> => !!c)
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Tournées" description="Vos tournées planifiées et leurs arrêts." icon="map" />
    <UiEmpty v-if="!tours.length" icon="map" title="Aucune tournée" hint="L’équipe approvisionnement planifie vos tournées." />
    <ul v-else class="flex flex-col gap-4">
      <li v-for="t in tours" :key="t.id" class="card p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="font-display font-semibold">{{ t.ref }}</p><p class="text-[13px] text-muted">{{ fdate(t.date) }} · {{ t.vehicle }}</p></div><UiStatusBadge kind="tour" :value="t.status" size="sm" /></div>
        <ol class="mt-3 flex flex-col gap-2">
          <li v-for="(c, i) in stops(t.collectionIds)" :key="c.id">
            <NuxtLink :to="`/terrain/collectes/${c.id}`" class="flex min-h-12 items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <span class="tnum grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">{{ c.pickupPoint.label }}</p><p class="tnum text-[12px] text-muted">{{ kg(c.estimatedTotalKg) }}</p></div>
              <UiStatusBadge kind="collection" :value="c.status" size="sm" no-icon />
            </NuxtLink>
          </li>
        </ol>
        <p v-if="t.distanceKm" class="mt-3 text-[13px] text-muted">Distance prévue : {{ t.distanceKm }} km</p>
      </li>
    </ul>
  </div>
</template>
