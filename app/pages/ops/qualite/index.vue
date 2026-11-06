<script setup lang="ts">
import { fdate, num } from '#shared/utils/format'

usePageTitle('File des contrôles')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

const inspections = computed(() => db.all('qcInspections'))
const openInspections = computed(() => inspections.value.filter((q) => q.status !== 'completed').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)))
const needRequest = computed(() => db.all('productionLots').filter((l) => ['pending_qc', 'quarantine'].includes(l.qcStatus) && !inspections.value.some((q) => q.lotId === l.id && q.status !== 'completed')))
const decided = computed(() => inspections.value.filter((q) => q.decision).sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '')))
const count = (d: string) => decided.value.filter((q) => q.decision === d).length
const rate = computed(() => (decided.value.length ? Math.round((count('accepted') / decided.value.length) * 100) : null))
const request = (id: string) => act(() => svc.quality.request(id), 'Contrôle demandé.')
const may = computed(() => auth.can('quality.inspect'))
</script>

<template>
  <div>
    <UiPageHeader title="File des contrôles" description="Lots à contrôler, contrôles en cours et décisions récentes." icon="layout-dashboard" />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Contrôles en cours" :value="openInspections.length" icon="microscope" :tone="openInspections.length ? 'warning' : 'neutral'" to="/ops/qualite/controles" />
      <UiStat label="Lots à faire contrôler" :value="needRequest.length" icon="shield-question" :tone="needRequest.length ? 'info' : 'neutral'" to="/ops/qualite/lots" />
      <UiStat label="Taux de libération" :value="rate != null ? `${rate} %` : '—'" icon="shield-check" tone="success" hint="Sur les décisions prises" demo />
      <UiStat label="Rejets et quarantaines" :value="count('rejected') + count('quarantine')" icon="shield-alert" :tone="count('rejected') + count('quarantine') ? 'danger' : 'neutral'" to="/ops/qualite/decisions" />
    </div>

    <UiAlert class="mt-5" tone="info" icon="shield-check" title="Règle de libération">Un lot n’est vendable qu’après la saisie de tous les tests obligatoires, conformes aux seuils de démonstration, puis une décision de libération. Un lot non libéré ne peut ni être réservé ni expédié.</UiAlert>

    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      <UiCard title="Contrôles à réaliser" icon="clipboard-check">
        <UiEmpty v-if="!openInspections.length" compact icon="shield-check" title="Aucun contrôle en attente" />
        <ul v-else class="divide-y divide-line">
          <li v-for="q in openInspections" :key="q.id"><NuxtLink :to="`/ops/qualite/controles/${q.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2"><div class="min-w-0 flex-1"><p class="truncate font-medium">{{ q.ref }} <span class="font-normal text-muted">· {{ L.lotRef(q.lotId) }}</span></p><p class="truncate text-[13px] text-muted">{{ L.productName(L.peek('productionLots', q.lotId)?.productId) }} · demandé le {{ fdate(q.requestedAt) }}</p></div><UiStatusBadge kind="inspection" :value="q.status" size="sm" /></NuxtLink></li>
        </ul>
      </UiCard>
      <UiCard title="Lots en attente de demande" icon="boxes">
        <UiEmpty v-if="!needRequest.length" compact icon="boxes" title="Tous les lots sont pris en charge" />
        <ul v-else class="divide-y divide-line">
          <li v-for="l in needRequest" :key="l.id" class="flex items-center gap-3 py-3 text-sm"><div class="min-w-0 flex-1"><NuxtLink :to="`/ops/production/lots/${l.id}`" class="font-medium hover:underline">{{ l.ref }}</NuxtLink><p class="text-[13px] text-muted">{{ L.productName(l.productId) }} · {{ num(l.producedQty) }} pièces</p></div><UiStatusBadge kind="lotQc" :value="l.qcStatus" size="sm" /><UiButton v-if="may" size="sm" variant="outline" icon="microscope" @click="request(l.id)">Contrôler</UiButton></li>
        </ul>
      </UiCard>
    </div>
    <SiteNotice class="mt-6" kind="technical" dense />
  </div>
</template>
