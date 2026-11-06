<script setup lang="ts">
import { fdatetime } from '#shared/utils/format'
import type { Delivery, Incident } from '#shared/types/domain'

usePageTitle('Incidents de livraison')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

type Row = { id: string; delivery: Delivery; incident: Incident }
const TYPE: Record<string, string> = { delay: 'Retard', damage: 'Pièces abîmées', absent: 'Client absent', address: 'Adresse introuvable', vehicle: 'Panne véhicule', other: 'Autre' }

const tab = ref('open')
const all = computed<Row[]>(() => db.all('deliveries').flatMap((d) => d.incidents.map((i) => ({ id: i.id, delivery: d, incident: i }))))
const open = computed(() => all.value.filter((r) => !r.incident.resolved))
const done = computed(() => all.value.filter((r) => r.incident.resolved))
const shown = computed(() => (tab.value === 'open' ? open.value : done.value))
const tabs = computed(() => [{ value: 'open', label: 'Ouverts', icon: 'triangle-alert', count: open.value.length }, { value: 'done', label: 'Résolus', icon: 'check', count: done.value.length }])
const manage = computed(() => auth.can('delivery.manage'))

const columns = [
  { key: 'at', label: 'Date', sortable: true, value: (r: Row) => fdatetime(r.incident.at), sortValue: (r: Row) => r.incident.at },
  { key: 'delivery', label: 'Livraison', value: (r: Row) => r.delivery.ref },
  { key: 'order', label: 'Commande', hide: 'md' as const, value: (r: Row) => L.orderRef(r.delivery.orderId) },
  { key: 'type', label: 'Type', value: (r: Row) => TYPE[r.incident.type] ?? r.incident.type },
  { key: 'description', label: 'Description', hide: 'sm' as const, value: (r: Row) => r.incident.description },
]
const filters = [{ key: 'type', label: 'Type', options: Object.entries(TYPE).map(([value, label]) => ({ value, label })), accessor: (r: Row) => r.incident.type }]
const resolve = (r: Row) => act(() => svc.deliveries.resolveIncident(r.delivery.id, r.incident.id), 'Incident marqué comme résolu.')
</script>

<template>
  <div>
    <UiPageHeader title="Incidents de livraison" description="Retards, avaries, absences : chaque incident reste visible jusqu’à sa résolution." icon="triangle-alert" />
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les incidents" class="mb-4" />
    <UiDataTable :rows="shown" :columns="columns" :filters="filters" export-name="incidents-livraison" dense @row-click="(r: Row) => navigateTo(`/ops/logistique/expeditions/${r.delivery.id}`)">
      <template #cell-delivery="{ row }"><span class="font-medium">{{ row.delivery.ref }}</span></template>
      <template #cell-description="{ row }"><span class="line-clamp-2">{{ row.incident.description }}</span></template>
      <template v-if="manage && tab === 'open'" #actions="{ row }"><UiButton size="sm" variant="outline" icon="check" @click.stop="resolve(row)">Résoudre</UiButton></template>
      <template #empty><UiEmpty :icon="tab === 'open' ? 'shield-check' : 'inbox'" :title="tab === 'open' ? 'Aucun incident ouvert' : 'Aucun incident résolu'" /></template>
    </UiDataTable>
  </div>
</template>
