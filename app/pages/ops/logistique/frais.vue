<script setup lang="ts">
import { fcfa } from '#shared/utils/format'
import { canUpdate } from '#shared/utils/permissions'
import type { DeliveryZone } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Frais de livraison')
const db = useDb()
const auth = useAuth()
const settings = useSettings()
const confirm = useConfirm()
const act = useAction()
const mayEdit = computed(() => canUpdate(auth.role.value, 'settings'))
const zones = computed(() => settings.value.zones)
const carriers = computed(() => db.all('carriers').filter((c) => c.status === 'active'))

const columns = [
  { key: 'name', label: 'Zone', sortable: true },
  { key: 'baseFee', label: 'Frais de base', align: 'right' as const, sortable: true, value: (z: DeliveryZone) => fcfa(z.baseFee), sortValue: (z: DeliveryZone) => z.baseFee },
  { key: 'perKmFee', label: 'Par km', align: 'right' as const, hide: 'md' as const, value: (z: DeliveryZone) => (z.perKmFee != null ? fcfa(z.perKmFee) : '—') },
  { key: 'etaDays', label: 'Délai', hide: 'sm' as const },
  { key: 'carriers', label: 'Transporteurs', hide: 'lg' as const, value: (z: DeliveryZone) => carriers.value.filter((c) => c.zones.includes(z.id)).map((c) => c.name).join(', ') || '—' },
  { key: 'active', label: 'Statut', value: (z: DeliveryZone) => (z.active ? 'Active' : 'Inactive') },
]

const open = ref(false)
const editing = ref<DeliveryZone | null>(null)
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom de la zone', type: 'text', required: true, span: 2 },
  { key: 'baseFee', label: 'Frais de base (FCFA)', type: 'currency', required: true, min: 0 },
  { key: 'perKmFee', label: 'Tarif au km (FCFA)', type: 'currency', min: 0 },
  { key: 'etaDays', label: 'Délai annoncé', type: 'text', required: true, hint: 'Reste « à confirmer » tant que la logistique n’est pas validée.' },
  { key: 'active', label: 'Zone active', type: 'switch' },
]
const initial = computed(() => (editing.value ? { ...editing.value } : { baseFee: 0, etaDays: 'à confirmer', active: true }))
const openNew = () => { editing.value = null; open.value = true }
const openEdit = (z: DeliveryZone) => { if (mayEdit.value) { editing.value = z; open.value = true } }

function save(v: Record<string, any>) {
  const next: DeliveryZone = { id: editing.value?.id ?? `zone-${Date.now().toString(36)}`, name: String(v.name), baseFee: Number(v.baseFee ?? 0), perKmFee: v.perKmFee != null && v.perKmFee !== '' ? Number(v.perKmFee) : undefined, etaDays: String(v.etaDays), active: !!v.active }
  const list = editing.value ? zones.value.map((z) => (z.id === next.id ? next : z)) : [...zones.value, next]
  db.update('settings', 'company', { zones: list } as any, { summary: `Zone de livraison · ${next.name}` })
}
async function remove(z: DeliveryZone) {
  if (!(await confirm({ title: `Supprimer la zone « ${z.name} » ?`, message: 'Les transporteurs et produits rattachés à cette zone ne la desserviront plus.', confirmLabel: 'Supprimer', tone: 'danger' }))) return
  await act(() => db.update('settings', 'company', { zones: zones.value.filter((x) => x.id !== z.id) } as any, { summary: `Zone supprimée · ${z.name}` }), 'Zone supprimée.')
}
</script>

<template>
  <div>
    <UiPageHeader title="Frais de livraison" description="Zones desservies, frais de base et délais annoncés. Les délais restent « à confirmer »." icon="badge-dollar-sign">
      <template #actions><UiButton v-if="mayEdit" icon="plus" @click="openNew">Nouvelle zone</UiButton></template>
    </UiPageHeader>
    <UiAlert v-if="!mayEdit" tone="info" icon="lock" title="Consultation seule" class="mb-4">Les zones et les frais sont modifiables par l’administration.</UiAlert>
    <UiDataTable :rows="zones" :columns="columns" export-name="zones-livraison" v-bind="mayEdit ? { onRowClick: openEdit } : {}">
      <template #cell-active="{ row }"><UiBadge :tone="row.active ? 'success' : 'neutral'" size="sm" dot>{{ row.active ? 'Active' : 'Inactive' }}</UiBadge></template>
      <template v-if="mayEdit" #actions="{ row }"><UiButton size="sm" variant="ghost" icon="trash-2" :aria-label="`Supprimer ${row.name}`" @click.stop="remove(row)" /></template>
      <template #empty><UiEmpty icon="map-pinned" title="Aucune zone de livraison" /></template>
    </UiDataTable>
    <SiteNotice class="mt-4" kind="leadTime" dense />
    <UiFormDialog v-model:open="open" :title="editing ? `Modifier · ${editing.name}` : 'Nouvelle zone'" :fields="fields" :initial="initial" submit-label="Enregistrer" @submit="save" />
  </div>
</template>
