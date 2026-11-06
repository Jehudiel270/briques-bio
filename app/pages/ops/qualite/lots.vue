<script setup lang="ts">
import { fdate, num } from '#shared/utils/format'
import type { ProductionLot } from '#shared/types/domain'

usePageTitle('Lots à libérer')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()
const tab = ref('todo')
const lots = computed(() => [...db.all('productionLots')].sort((a, b) => b.producedAt.localeCompare(a.producedAt)))
const groups = computed(() => ({
  todo: lots.value.filter((l) => ['pending_qc', 'in_qc'].includes(l.qcStatus)),
  quarantine: lots.value.filter((l) => l.qcStatus === 'quarantine'),
  released: lots.value.filter((l) => l.qcStatus === 'released'),
  rejected: lots.value.filter((l) => l.qcStatus === 'rejected'),
}))
const tabs = computed(() => [
  { value: 'todo', label: 'À contrôler', count: groups.value.todo.length },
  { value: 'quarantine', label: 'Quarantaine', count: groups.value.quarantine.length },
  { value: 'released', label: 'Libérés', count: groups.value.released.length },
  { value: 'rejected', label: 'Rejetés', count: groups.value.rejected.length },
])
const shown = computed(() => groups.value[tab.value as keyof typeof groups.value] ?? [])
const openInspection = (l: ProductionLot) => db.all('qcInspections').find((q) => q.lotId === l.id && q.status !== 'completed')
const last = (l: ProductionLot) => db.all('qcInspections').filter((q) => q.lotId === l.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0]
const request = (l: ProductionLot) => act(() => svc.quality.request(l.id), 'Contrôle demandé.')
const may = computed(() => auth.can('quality.inspect') || auth.can('production.manage'))
</script>

<template>
  <div>
    <UiPageHeader title="Lots à libérer" description="Seuls les lots libérés alimentent les commandes et les expéditions." icon="shield-check" />
    <UiTabs v-model="tab" :items="tabs" aria-label="Statut qualité des lots" class="mb-4" />
    <UiEmpty v-if="!shown.length" icon="boxes" title="Aucun lot dans cette catégorie" />
    <ul v-else class="card divide-y divide-line">
      <li v-for="l in shown" :key="l.id" class="flex flex-wrap items-center gap-3 p-4">
        <div class="min-w-0 flex-1"><NuxtLink :to="`/ops/production/lots/${l.id}`" class="font-medium hover:underline">{{ l.ref }}</NuxtLink><p class="text-[13px] text-muted">{{ L.productName(l.productId) }} · {{ num(l.producedQty) }} pièces · produit le {{ fdate(l.producedAt) }}</p></div>
        <UiStatusBadge kind="lotQc" :value="l.qcStatus" size="sm" />
        <UiButton v-if="openInspection(l)" size="sm" icon="clipboard-check" :to="`/ops/qualite/controles/${openInspection(l)!.id}`">Ouvrir le contrôle</UiButton>
        <UiButton v-else-if="['pending_qc', 'quarantine'].includes(l.qcStatus) && may" size="sm" variant="outline" icon="microscope" @click="request(l)">Demander un contrôle</UiButton>
        <UiButton v-else-if="last(l)" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/qualite/controles/${last(l)!.id}`">Dernier contrôle</UiButton>
      </li>
    </ul>
  </div>
</template>
