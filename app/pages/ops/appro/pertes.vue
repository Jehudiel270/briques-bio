<script setup lang="ts">
import { fdatetime, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { StockMovement } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Pertes et écarts')
const db = useDb()
const svc = useServices()
const auth = useAuth()
const L = useLookups()
const open = ref(false)

const lossRows = computed(() => db.all('stockMovements').filter((m) => m.type === 'loss' || (m.type === 'adjustment' && m.qty < 0)).sort((a, b) => b.at.localeCompare(a.at)))
const totalLoss = computed(() => lossRows.value.filter((m) => m.itemKind === 'raw').reduce((a, m) => a + Math.abs(m.qty), 0))
const rawLoss = computed(() => lossRows.value.filter((m) => m.type === 'loss').length)
const lots = computed(() => db.all('rawLots').filter((l) => l.kgAvailable > 0).map((l) => ({ value: l.id, label: `${l.ref} · ${POLYMER_LABEL[l.polymer]} · ${kg(l.kgAvailable)}` })))
const fields = computed<FieldDef[]>(() => [
  { key: 'rawLotId', label: 'Lot de matière', type: 'select', required: true, options: lots.value, span: 2 },
  { key: 'kg', label: 'Quantité perdue (kg)', type: 'number', required: true, min: 0.1, step: 0.1 },
  { key: 'reason', label: 'Motif', type: 'textarea', required: true, span: 2, rows: 3 },
])
const record = (v: Record<string, any>) => svc.inventory.recordLoss(String(v.rawLotId), Number(v.kg), String(v.reason))
const itemRef = (m: StockMovement) => (m.itemKind === 'raw' ? L.rawLotRef(m.itemId) : L.lotRef(m.itemId))
const columns = [
  { key: 'at', label: 'Date', sortable: true, value: (m: StockMovement) => fdatetime(m.at), sortValue: (m: StockMovement) => m.at },
  { key: 'type', label: 'Type', value: (m: StockMovement) => (m.type === 'loss' ? 'Perte' : 'Écart d’inventaire') },
  { key: 'item', label: 'Lot', value: itemRef },
  { key: 'qty', label: 'Quantité', align: 'right' as const, value: (m: StockMovement) => (m.unit === 'kg' ? kg(Math.abs(m.qty)) : `${Math.abs(m.qty)} pièces`) },
  { key: 'by', label: 'Par', hide: 'md' as const, value: (m: StockMovement) => L.userName(m.userId) },
  { key: 'note', label: 'Motif', hide: 'sm' as const, value: (m: StockMovement) => m.note ?? '' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Pertes et écarts" description="Pertes déclarées et écarts d’inventaire négatifs, avec leur motif." icon="trending-down">
      <template #actions><UiButton v-if="auth.can('stock.manage')" icon="plus" @click="open = true">Déclarer une perte</UiButton></template>
    </UiPageHeader>
    <div class="mb-5 grid gap-4 sm:grid-cols-2"><UiStat label="Matière perdue (cumul)" :value="kg(totalLoss)" icon="trending-down" tone="danger" /><UiStat label="Pertes déclarées" :value="rawLoss" icon="clipboard-x" tone="warning" /></div>
    <UiDataTable :rows="lossRows" :columns="columns" dense export-name="pertes-ecarts" :initial-sort="{ key: 'at', dir: 'desc' }">
      <template #empty><UiEmpty icon="shield-check" title="Aucune perte enregistrée" hint="Déclarez une perte pour qu’elle soit tracée et retirée du stock." /></template>
    </UiDataTable>
    <UiFormDialog v-model:open="open" title="Déclarer une perte de matière" description="La quantité est retirée du lot ; les quantités réservées ne sont pas touchables." :fields="fields" submit-label="Enregistrer la perte" @submit="record" />
  </div>
</template>
