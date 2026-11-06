<script setup lang="ts">
import { fdate, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
const polyNames = (codes: readonly string[], sep = ', ') => codes.map((c) => POLYMER_LABEL[c] ?? c).join(sep)

usePageTitle('Mes demandes')
const db = useDb()
const tab = ref('active')
const rows = computed(() => [...db.all('collections')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const ACTIVE = ['submitted', 'under_review', 'planned', 'en_route', 'collected', 'weighed', 'problem']
const shown = computed(() => rows.value.filter((c) => (tab.value === 'active' ? ACTIVE.includes(c.status) : !ACTIVE.includes(c.status))))
const tabs = computed(() => [
  { value: 'active', label: 'En cours', count: rows.value.filter((c) => ACTIVE.includes(c.status)).length },
  { value: 'done', label: 'Terminées', count: rows.value.filter((c) => !ACTIVE.includes(c.status)).length },
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Mes demandes" icon="list-checks">
      <template #actions><UiButton icon="circle-plus" to="/collecte/demandes/nouvelle">Nouvelle</UiButton></template>
    </UiPageHeader>
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les demandes" />
    <UiEmpty v-if="!shown.length" icon="inbox" title="Aucune demande" :hint="tab === 'active' ? 'Déposez une demande d’enlèvement quand vous avez des plastiques triés.' : 'Vos demandes terminées apparaîtront ici.'">
      <UiButton v-if="tab === 'active'" icon="circle-plus" to="/collecte/demandes/nouvelle">Nouvelle demande</UiButton>
    </UiEmpty>
    <ul v-else class="flex flex-col gap-3">
      <li v-for="c in shown" :key="c.id">
        <NuxtLink :to="`/collecte/demandes/${c.id}`" class="card block min-h-16 p-4 transition-colors hover:border-primary/50">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display font-semibold">{{ c.ref }}</p><p class="truncate text-[13px] text-muted">{{ c.pickupPoint.label }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></div>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span class="tnum font-medium">{{ kg(c.estimatedTotalKg) }}</span>
            <span class="text-muted">{{ polyNames(c.polymers.map((p) => p.code), ' · ') }}</span>
            <span class="ml-auto text-[13px] text-muted">{{ c.scheduledAt ? `Enlèvement ${fdate(c.scheduledAt)}` : `Envoyée ${fdate(c.createdAt)}` }}</span>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
