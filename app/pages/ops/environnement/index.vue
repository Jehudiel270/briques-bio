<script setup lang="ts">
import { fmonth, kg, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'

usePageTitle('Environnement — vue d’ensemble')
const db = useDb()
const records = computed(() => db.all('envRecords'))
const periods = computed(() => [...new Set(records.value.map((r) => r.period))].sort())
const sumBy = (key: 'receivedKg' | 'acceptedKg' | 'rejectedKg' | 'usedInProductionKg' | 'finishedUnits' | 'finishedKg' | 'lossKg', period?: string) => records.value.filter((r) => !period || r.period === period).reduce((a, r) => a + r[key], 0)
const labels = computed(() => periods.value.map(fmonth))
const lineSeries = computed(() => [
  { name: 'Reçu', points: periods.value.map((p) => ({ x: fmonth(p), y: Math.round(sumBy('receivedKg', p)) })) },
  { name: 'Accepté', points: periods.value.map((p) => ({ x: fmonth(p), y: Math.round(sumBy('acceptedKg', p)) })) },
  { name: 'Utilisé en production', points: periods.value.map((p) => ({ x: fmonth(p), y: Math.round(sumBy('usedInProductionKg', p)) })) },
])
const validated = computed(() => records.value.filter((r) => r.validated).length)
const indicators = computed(() => db.all('envIndicators'))
const rejectRate = computed(() => (sumBy('receivedKg') ? Math.round((sumBy('rejectedKg') / sumBy('receivedKg')) * 1000) / 10 : null))
</script>

<template>
  <div>
    <UiPageHeader title="Vue d’ensemble" description="Quantités mesurées de matière collectée, acceptée, utilisée et produite." icon="leaf" />
    <UiAlert tone="info" icon="calculator" title="Aucun calcul automatique d’économie de CO₂" class="mb-5">La plateforme publie uniquement des quantités mesurées (kilos, pièces), avec leur méthodologie. Toute allégation environnementale exige une méthode validée et des preuves.</UiAlert>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Plastique reçu" :value="kg(sumBy('receivedKg'))" icon="truck" tone="info" demo />
      <UiStat label="Accepté" :value="kg(sumBy('acceptedKg'))" icon="circle-check" tone="success" demo />
      <UiStat label="Taux de rejet" :value="rejectRate != null ? `${rejectRate} %` : '—'" icon="circle-x" tone="warning" demo />
      <UiStat label="Pièces produites" :value="num(sumBy('finishedUnits'))" icon="package-check" tone="accent" demo />
    </div>
    <div class="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <UiCard title="Flux mensuels de matière (kg)" icon="chart-line"><ChartLine v-if="periods.length > 1" :series="lineSeries" unit="kg" :height="260" title="Flux mensuels de matière" /><UiEmpty v-else compact icon="chart-line" title="Au moins deux mois de données nécessaires" hint="Lancez une agrégation dans « Données mensuelles »." /><ChartLegend v-if="periods.length > 1" class="mt-3" :items="lineSeries.map((s) => ({ label: s.name }))" /></UiCard>
      <UiCard title="Validation et publication" icon="shield-check">
        <UiKeyValue :items="[{ label: 'Lignes mensuelles validées', value: `${validated} / ${records.length}` }, { label: 'Indicateurs en brouillon', value: String(indicators.filter((i) => i.status === 'draft').length) }, { label: 'Validés', value: String(indicators.filter((i) => i.status === 'validated').length) }, { label: 'Publiés', value: String(indicators.filter((i) => i.status === 'published').length) }]" />
        <ul class="mt-3 space-y-1.5 text-sm"><li v-for="i in indicators.slice(0, 4)" :key="i.id" class="flex items-center justify-between gap-2"><span class="truncate">{{ i.label }}</span><UiStatusBadge kind="indicator" :value="i.status" size="sm" /></li></ul>
        <UiButton class="mt-4" size="sm" variant="outline" iconRight="arrow-right" to="/ops/environnement/publication">Gérer la publication</UiButton>
      </UiCard>
    </div>
    <SiteNotice class="mt-6" kind="demo" dense />
  </div>
</template>
