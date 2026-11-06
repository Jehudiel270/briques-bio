<script setup lang="ts">
import { kg, num } from '#shared/utils/format'
import { POLYMER_LABEL, STATUS } from '#shared/utils/labels'
import type { ProductionLot, RawLot } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Inventaire')
const db = useDb()
const svc = useServices()
const auth = useAuth()
const L = useLookups()
const may = computed(() => auth.can('stock.manage'))
const tab = ref('raw')
const raws = computed(() => db.all('rawLots').filter((l) => l.status !== 'depleted' || l.kgAvailable > 0))
const fins = computed(() => db.all('productionLots').filter((l) => l.availableQty > 0 || l.reservedQty > 0))
const tabs = computed(() => [{ value: 'raw', label: 'Matière première', count: raws.value.length }, { value: 'finished', label: 'Produits finis', count: fins.value.length }])

type Target = { kind: 'raw'; row: RawLot } | { kind: 'finished'; row: ProductionLot }
const adjustTarget = ref<Target | null>(null); const adjustOpen = ref(false)
const moveTarget = ref<Target | null>(null); const moveOpen = ref(false)
const adjustFields = computed<FieldDef[]>(() => [
  { key: 'physical', label: adjustTarget.value?.kind === 'raw' ? 'Quantité comptée (kg)' : 'Quantité comptée (pièces)', type: 'number', required: true, min: 0, step: adjustTarget.value?.kind === 'raw' ? 0.1 : 1, hint: 'Les quantités réservées ne peuvent pas être réduites.' },
  { key: 'reason', label: 'Motif de l’écart', type: 'textarea', required: true, span: 2, rows: 3 },
])
const moveFields = computed<FieldDef[]>(() => [{ key: 'toLocationId', label: 'Destination', type: 'select', required: true, options: db.all('stockLocations').filter((loc) => moveTarget.value?.kind === 'finished' ? loc.kind === 'finished' : loc.kind !== 'finished').map((loc) => ({ value: loc.id, label: `${loc.name} (${loc.code})` })), span: 2 }])
const adjustInitial = computed(() => (adjustTarget.value ? { physical: adjustTarget.value.kind === 'raw' ? adjustTarget.value.row.kgAvailable : adjustTarget.value.row.availableQty } : {}))
const openAdjust = (t: Target) => { adjustTarget.value = t; adjustOpen.value = true }
const openMove = (t: Target) => { moveTarget.value = t; moveOpen.value = true }
function adjust(v: Record<string, any>) {
  const t = adjustTarget.value!
  return t.kind === 'raw' ? svc.inventory.adjustRaw(t.row.id, Number(v.physical), String(v.reason)) : svc.inventory.adjustFinished(t.row.id, Number(v.physical), String(v.reason))
}
const move = (v: Record<string, any>) => svc.inventory.transfer({ itemKind: moveTarget.value!.kind, itemId: moveTarget.value!.row.id, toLocationId: String(v.toLocationId) })

const rawCols = [
  { key: 'ref', label: 'Lot', sortable: true }, { key: 'polymer', label: 'Plastique', value: (l: RawLot) => POLYMER_LABEL[l.polymer] },
  { key: 'kgAvailable', label: 'Théorique', align: 'right' as const, sortable: true, value: (l: RawLot) => kg(l.kgAvailable), sortValue: (l: RawLot) => l.kgAvailable },
  { key: 'kgReserved', label: 'Réservé', align: 'right' as const, hide: 'sm' as const, value: (l: RawLot) => kg(l.kgReserved) },
  { key: 'loc', label: 'Emplacement', hide: 'md' as const, value: (l: RawLot) => L.locationName(l.locationId) },
  { key: 'status', label: 'Statut', hide: 'sm' as const, value: (l: RawLot) => STATUS.rawLot[l.status].label },
]
const finCols = [
  { key: 'ref', label: 'Lot', sortable: true }, { key: 'product', label: 'Produit', value: (l: ProductionLot) => L.productName(l.productId) },
  { key: 'availableQty', label: 'Théorique', align: 'right' as const, sortable: true, value: (l: ProductionLot) => num(l.availableQty), sortValue: (l: ProductionLot) => l.availableQty },
  { key: 'reservedQty', label: 'Réservé', align: 'right' as const, hide: 'sm' as const, value: (l: ProductionLot) => num(l.reservedQty) },
  { key: 'loc', label: 'Emplacement', hide: 'md' as const, value: (l: ProductionLot) => L.locationName(l.locationId) },
  { key: 'qc', label: 'Qualité', hide: 'sm' as const, value: (l: ProductionLot) => STATUS.lotQc[l.qcStatus].label },
]
</script>

<template>
  <div>
    <UiPageHeader title="Inventaire" description="Comptez, corrigez les écarts et déplacez les lots entre emplacements. Chaque opération est tracée." icon="clipboard-check" />
    <UiAlert v-if="!may" tone="info" icon="lock" title="Consultation seule" class="mb-4">Les ajustements sont réservés à l’approvisionnement et à l’administration.</UiAlert>
    <UiTabs v-model="tab" :items="tabs" aria-label="Type de stock" class="mb-4" />
    <UiDataTable v-if="tab === 'raw'" :rows="raws" :columns="rawCols" dense export-name="inventaire-matiere">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template v-if="may" #actions="{ row }"><div class="flex gap-1"><UiButton size="sm" variant="outline" icon="clipboard-pen" @click.stop="openAdjust({ kind: 'raw', row })">Ajuster</UiButton><UiButton size="sm" variant="ghost" icon="move-right" aria-label="Déplacer" @click.stop="openMove({ kind: 'raw', row })" /></div></template>
    </UiDataTable>
    <UiDataTable v-else :rows="fins" :columns="finCols" dense export-name="inventaire-produits-finis">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template v-if="may" #actions="{ row }"><div class="flex gap-1"><UiButton size="sm" variant="outline" icon="clipboard-pen" @click.stop="openAdjust({ kind: 'finished', row })">Ajuster</UiButton><UiButton size="sm" variant="ghost" icon="move-right" aria-label="Déplacer" @click.stop="openMove({ kind: 'finished', row })" /></div></template>
    </UiDataTable>

    <UiFormDialog v-model:open="adjustOpen" :title="`Ajuster ${adjustTarget?.row.ref ?? ''}`" :fields="adjustFields" :initial="adjustInitial" submit-label="Enregistrer l’ajustement" @submit="adjust" />
    <UiFormDialog v-model:open="moveOpen" :title="`Déplacer ${moveTarget?.row.ref ?? ''}`" :fields="moveFields" submit-label="Déplacer" @submit="move" />
  </div>
</template>
