<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'

usePageTitle('Historique')
const db = useDb()
const done = ['received', 'cancelled', 'rejected']
const rows = computed(() => db.all('collections').filter((c) => done.includes(c.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const acceptedOf = (collectionId: string) => db.all('receipts').filter((r) => r.collectionId === collectionId).reduce((a, r) => a + r.lines.reduce((s, l) => s + l.acceptedKg, 0), 0)
const totalAccepted = computed(() => rows.value.reduce((a, c) => a + acceptedOf(c.id), 0))
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Historique" description="Vos collectes terminées et les quantités acceptées." icon="history" />
    <UiStat label="Total accepté" :value="kg(totalAccepted)" icon="badge-check" tone="success" :hint="`${rows.length} collecte(s)`" demo />
    <UiEmpty v-if="!rows.length" icon="history" title="Aucune collecte terminée" hint="Les collectes réceptionnées, annulées ou refusées apparaîtront ici." />
    <ul v-else class="flex flex-col gap-3">
      <li v-for="c in rows" :key="c.id">
        <NuxtLink :to="`/collecte/demandes/${c.id}`" class="card block min-h-16 p-4 transition-colors hover:border-primary/50">
          <div class="flex items-start justify-between gap-3"><div><p class="font-display font-semibold">{{ c.ref }}</p><p class="text-[13px] text-muted">{{ fdate(c.updatedAt) }} · {{ c.pickupPoint.label }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></div>
          <p class="tnum mt-2 text-sm"><span class="text-muted">Estimé</span> {{ kg(c.estimatedTotalKg) }}<template v-if="c.status === 'received'"> · <span class="text-muted">accepté</span> <strong class="text-success">{{ kg(acceptedOf(c.id)) }}</strong></template></p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
