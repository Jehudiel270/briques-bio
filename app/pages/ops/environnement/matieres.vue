<script setup lang="ts">
import { kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'

usePageTitle('Matières et rejets')
const db = useDb()
const rows = computed(() => Object.keys(POLYMER_LABEL).map((code) => {
  const of = db.all('envRecords').filter((r) => r.polymer === code)
  const s = (k: 'receivedKg' | 'acceptedKg' | 'rejectedKg' | 'usedInProductionKg' | 'lossKg') => of.reduce((a, r) => a + r[k], 0)
  const received = s('receivedKg')
  return { code, label: POLYMER_LABEL[code]!, received, accepted: s('acceptedKg'), rejected: s('rejectedKg'), used: s('usedInProductionKg'), loss: s('lossKg'), rate: received ? Math.round((s('rejectedKg') / received) * 1000) / 10 : null }
}).filter((r) => r.received > 0))
const bars = computed(() => ({ labels: rows.value.map((r) => r.label), series: [{ name: 'Accepté', values: rows.value.map((r) => Math.round(r.accepted)), tone: 'success' as const }, { name: 'Rejeté', values: rows.value.map((r) => Math.round(r.rejected)), tone: 'danger' as const }] }))
const donut = computed(() => rows.value.map((r) => ({ label: r.label, value: Math.round(r.received) })))
const columns = [
  { key: 'label', label: 'Plastique', sortable: true },
  { key: 'received', label: 'Reçu', align: 'right' as const, sortable: true, value: (r: any) => kg(r.received), sortValue: (r: any) => r.received },
  { key: 'accepted', label: 'Accepté', align: 'right' as const, hide: 'sm' as const, value: (r: any) => kg(r.accepted) },
  { key: 'rejected', label: 'Rejeté', align: 'right' as const, value: (r: any) => kg(r.rejected) },
  { key: 'rate', label: 'Taux de rejet', align: 'right' as const, sortable: true, value: (r: any) => (r.rate != null ? `${r.rate} %` : '—'), sortValue: (r: any) => r.rate ?? 0 },
  { key: 'used', label: 'En production', align: 'right' as const, hide: 'md' as const, value: (r: any) => kg(r.used) },
  { key: 'loss', label: 'Pertes', align: 'right' as const, hide: 'md' as const, value: (r: any) => kg(r.loss) },
]
</script>

<template>
  <div>
    <UiPageHeader title="Matières et rejets" description="Répartition par type de plastique, taux de rejet et pertes (données agrégées)." icon="recycle" />
    <div class="grid gap-5 lg:grid-cols-2">
      <UiCard title="Accepté et rejeté (kg)" icon="chart-column"><ChartBar v-if="rows.length" :labels="bars.labels" :series="bars.series" stacked unit="kg" :height="240" title="Accepté et rejeté par plastique" /><UiEmpty v-else compact icon="chart-column" title="Pas encore de données" hint="Agrégez un mois dans « Données mensuelles »." /></UiCard>
      <UiCard title="Origine des plastiques reçus" icon="chart-pie"><ChartDonut v-if="donut.length" :data="donut" unit="kg" center-label="reçus" :center="kg(rows.reduce((a, r) => a + r.received, 0))" title="Répartition des plastiques reçus" /><UiEmpty v-else compact icon="chart-pie" title="Pas encore de données" /></UiCard>
    </div>
    <UiCard class="mt-5" title="Détail par plastique" icon="table-2" padding="none"><UiDataTable :rows="rows" :columns="columns" row-key="code" dense :searchable="false" export-name="matieres-rejets" /></UiCard>
    <SiteNotice class="mt-5" kind="demo" dense />
  </div>
</template>
