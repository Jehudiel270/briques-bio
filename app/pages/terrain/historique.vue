<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'

usePageTitle('Historique')
const db = useDb()
const auth = useAuth()
const rows = computed(() => db.all('collections').filter((c) => c.driverUserId === auth.user.value?.id && ['weighed', 'received', 'cancelled'].includes(c.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const total = computed(() => rows.value.reduce((a, c) => a + (c.recordedKg ?? 0), 0))
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Historique" description="Vos collectes terminées." icon="history" />
    <UiStat label="Poids relevé (total)" :value="kg(total)" icon="scale" tone="accent" :hint="`${rows.length} collecte(s)`" />
    <UiEmpty v-if="!rows.length" icon="history" title="Aucune collecte terminée" />
    <ul v-else class="flex flex-col gap-3">
      <li v-for="c in rows" :key="c.id">
        <NuxtLink :to="`/terrain/collectes/${c.id}`" class="card block min-h-16 p-4">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display font-semibold">{{ c.ref }}</p><p class="truncate text-[13px] text-muted">{{ fdate(c.updatedAt) }} · {{ c.pickupPoint.label }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></div>
          <p v-if="c.recordedKg != null" class="tnum mt-2 text-sm"><span class="text-muted">Relevé</span> {{ kg(c.recordedKg) }}</p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
