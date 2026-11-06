<script setup lang="ts">
import { fdatetime } from '#shared/utils/format'
import type { ProductionEvent } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Anomalies et arrêts')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()
const tab = ref('open')
const all = computed(() => [...db.all('productionEvents')].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
const shown = computed(() => all.value.filter((e) => (tab.value === 'open' ? !e.resolved : e.resolved)))
const tabs = computed(() => [{ value: 'open', label: 'Ouvertes', count: all.value.filter((e) => !e.resolved).length }, { value: 'done', label: 'Résolues', count: all.value.filter((e) => e.resolved).length }])
const typeLabel = { anomaly: 'Anomalie', stop: 'Arrêt', note: 'Note' } as const
const sevLabel = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' } as const
const sevTone = { low: 'neutral', medium: 'warning', high: 'danger' } as const
const stopMinutes = computed(() => all.value.filter((e) => e.type === 'stop').reduce((a, e) => a + (e.durationMin ?? 0), 0))
const columns = [
  { key: 'startedAt', label: 'Date', sortable: true, value: (e: ProductionEvent) => fdatetime(e.startedAt), sortValue: (e: ProductionEvent) => e.startedAt },
  { key: 'wo', label: 'Ordre', value: (e: ProductionEvent) => L.workOrderRef(e.workOrderId) },
  { key: 'type', label: 'Type', hide: 'sm' as const, value: (e: ProductionEvent) => typeLabel[e.type] },
  { key: 'severity', label: 'Gravité', value: (e: ProductionEvent) => sevLabel[e.severity] },
  { key: 'description', label: 'Description', hide: 'md' as const },
  { key: 'duration', label: 'Durée', align: 'right' as const, hide: 'lg' as const, value: (e: ProductionEvent) => (e.durationMin ? `${e.durationMin} min` : '—') },
]
const open = ref(false)
const fields = computed<FieldDef[]>(() => [
  { key: 'workOrderId', label: 'Ordre de fabrication', type: 'select', required: true, options: db.all('workOrders').filter((w) => !['cancelled'].includes(w.status)).map((w) => ({ value: w.id, label: `${w.ref} · ${L.productName(w.productId)}` })), span: 2 },
  { key: 'type', label: 'Type', type: 'select', required: true, options: Object.entries(typeLabel).map(([value, label]) => ({ value, label })) },
  { key: 'severity', label: 'Gravité', type: 'select', required: true, options: Object.entries(sevLabel).map(([value, label]) => ({ value, label })) },
  { key: 'durationMin', label: 'Durée (min)', type: 'number', min: 0 },
  { key: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 3 },
])
const create = (v: Record<string, any>) => svc.production.logEvent(String(v.workOrderId), { type: v.type, severity: v.severity, description: String(v.description), durationMin: v.durationMin != null && v.durationMin !== '' ? Number(v.durationMin) : undefined })
const toggle = (e: ProductionEvent) => act(() => db.update('productionEvents', e.id, { resolved: !e.resolved } as any, { summary: e.resolved ? 'Anomalie rouverte' : 'Anomalie résolue' }), e.resolved ? 'Anomalie rouverte.' : 'Anomalie résolue.')
</script>

<template>
  <div>
    <UiPageHeader title="Anomalies et arrêts" description="Incidents de production, arrêts machine et notes de ligne." icon="triangle-alert">
      <template #actions><UiButton v-if="auth.can('production.manage')" icon="plus" @click="open = true">Signaler</UiButton></template>
    </UiPageHeader>
    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <UiStat label="Ouvertes" :value="all.filter((e) => !e.resolved).length" icon="triangle-alert" tone="danger" />
      <UiStat label="Gravité élevée" :value="all.filter((e) => e.severity === 'high' && !e.resolved).length" icon="octagon-alert" tone="warning" />
      <UiStat label="Temps d’arrêt cumulé" :value="`${stopMinutes} min`" icon="timer" tone="info" />
    </div>
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les anomalies" class="mb-4" />
    <UiDataTable :rows="shown" :columns="columns" dense export-name="anomalies">
      <template #cell-wo="{ row }"><NuxtLink :to="`/ops/production/ordres/${row.workOrderId}`" class="font-medium hover:underline">{{ L.workOrderRef(row.workOrderId) }}</NuxtLink></template>
      <template #cell-severity="{ row }"><UiBadge :tone="sevTone[row.severity as 'low']" size="sm" dot>{{ sevLabel[row.severity as 'low'] }}</UiBadge></template>
      <template v-if="auth.can('production.manage')" #actions="{ row }"><UiButton size="sm" variant="ghost" :icon="row.resolved ? 'rotate-ccw' : 'check'" @click.stop="toggle(row)">{{ row.resolved ? 'Rouvrir' : 'Résoudre' }}</UiButton></template>
      <template #empty><UiEmpty icon="shield-check" :title="tab === 'open' ? 'Aucune anomalie ouverte' : 'Aucune anomalie résolue'" /></template>
    </UiDataTable>
    <UiFormDialog v-model:open="open" title="Signaler une anomalie" :fields="fields" :initial="{ type: 'anomaly', severity: 'medium' }" submit-label="Enregistrer" @submit="create" />
  </div>
</template>
