<script setup lang="ts">
import { fdatetime, kg } from '#shared/utils/format'

usePageTitle('Mes collectes')
const db = useDb()
const auth = useAuth()
const tab = ref('todo')
const mine = computed(() => db.all('collections').filter((c) => c.driverUserId === auth.user.value?.id).sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt)))
const groups: Record<string, string[]> = { todo: ['planned', 'en_route', 'collected'], issues: ['problem'], done: ['weighed', 'received', 'cancelled'] }
const shown = computed(() => mine.value.filter((c) => groups[tab.value]!.includes(c.status)))
const tabs = computed(() => [
  { value: 'todo', label: 'À faire', count: mine.value.filter((c) => groups.todo!.includes(c.status)).length },
  { value: 'issues', label: 'Problèmes', count: mine.value.filter((c) => groups.issues!.includes(c.status)).length },
  { value: 'done', label: 'Terminées', count: mine.value.filter((c) => groups.done!.includes(c.status)).length },
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Mes collectes" icon="package-search" />
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les collectes" />
    <UiEmpty v-if="!shown.length" icon="package-search" title="Aucune collecte" hint="Rien dans cette catégorie." />
    <ul v-else class="flex flex-col gap-3">
      <li v-for="c in shown" :key="c.id">
        <NuxtLink :to="`/terrain/collectes/${c.id}`" class="card block min-h-16 p-4 transition-colors hover:border-primary/50">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display font-semibold">{{ c.ref }}</p><p class="truncate text-[13px] text-muted">{{ c.pickupPoint.label }}, {{ c.pickupPoint.city }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></div>
          <p class="tnum mt-2 text-sm"><span class="text-muted">{{ c.scheduledAt ? fdatetime(c.scheduledAt) : 'À planifier' }}</span> · {{ kg(c.recordedKg ?? c.estimatedTotalKg) }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
