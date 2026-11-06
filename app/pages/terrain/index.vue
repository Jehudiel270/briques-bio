<script setup lang="ts">
import { fdate, fdatetime, kg } from '#shared/utils/format'

usePageTitle('Aujourd’hui')
const db = useDb()
const auth = useAuth()
const L = useLookups()

const mine = computed(() => db.all('collections').filter((c) => c.driverUserId === auth.user.value?.id))
const todo = computed(() => mine.value.filter((c) => ['planned', 'en_route', 'collected', 'problem'].includes(c.status)).sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')))
const doneToday = computed(() => mine.value.filter((c) => ['weighed', 'received'].includes(c.status) && c.updatedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)))
const weighedKg = computed(() => doneToday.value.reduce((a, c) => a + (c.recordedKg ?? 0), 0))
const tour = computed(() => db.all('tours').filter((t) => t.driverUserId === auth.user.value?.id && ['planned', 'in_progress'].includes(t.status)).sort((a, b) => a.date.localeCompare(b.date))[0])
const NEXT: Record<string, string> = { planned: 'Démarrer', en_route: 'Confirmer l’enlèvement', collected: 'Valider la pesée', problem: 'Reprendre' }
</script>

<template>
  <div class="flex flex-col gap-5">
    <UiPageHeader :title="`Bonjour ${auth.user.value?.name.split(' ')[0] ?? ''}`" :description="fdate(new Date())" icon="route" />

    <UiCard v-if="tour" icon="map">
      <div class="flex items-center justify-between gap-3">
        <div><p class="font-display font-semibold">{{ tour.ref }}</p><p class="text-[13px] text-muted">{{ fdate(tour.date) }} · {{ tour.vehicle }} · {{ tour.collectionIds.length }} arrêt(s)</p></div>
        <UiStatusBadge kind="tour" :value="tour.status" size="sm" />
      </div>
    </UiCard>

    <div class="grid grid-cols-3 gap-3">
      <UiStat label="À faire" :value="todo.length" icon="list-todo" tone="info" />
      <UiStat label="Faites" :value="doneToday.length" icon="check-check" tone="success" />
      <UiStat label="Relevés" :value="kg(weighedKg)" icon="scale" tone="accent" />
    </div>

    <section aria-labelledby="todo-title">
      <h2 id="todo-title" class="mb-3 font-display text-lg font-semibold">À faire</h2>
      <UiEmpty v-if="!todo.length" icon="party-popper" title="Rien à faire pour l’instant" hint="Les nouvelles collectes planifiées apparaîtront ici." />
      <ul v-else class="flex flex-col gap-3">
        <li v-for="c in todo" :key="c.id" class="card p-4">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display font-semibold">{{ c.ref }}</p><p class="truncate text-sm">{{ c.pickupPoint.label }}</p><p class="truncate text-[13px] text-muted">{{ c.pickupPoint.line }}, {{ c.pickupPoint.city }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></div>
          <div class="mt-2 flex items-center justify-between text-[13px] text-muted"><span>{{ c.scheduledAt ? fdatetime(c.scheduledAt) : 'Heure à confirmer' }}</span><span class="tnum">{{ kg(c.estimatedTotalKg) }} estimés · {{ L.supplierName(c.supplierId) }}</span></div>
          <UiButton class="mt-3" block size="lg" :icon="c.status === 'problem' ? 'rotate-ccw' : 'arrow-right'" :to="`/terrain/collectes/${c.id}`">{{ NEXT[c.status] }}</UiButton>
        </li>
      </ul>
    </section>
  </div>
</template>
