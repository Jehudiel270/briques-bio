<script setup lang="ts">
import type { CollectionName } from '#shared/types/domain'
import { canCreate, canRemove, canUpdate } from '#shared/utils/permissions'
import type { FieldDef } from '~/utils/forms'

/**
 * Liste + création / modification / suppression d'une collection (écriture directe via `db`, soumise aux permissions).
 * `columns` / `filters` : voir UiDataTable. `fields` : FieldDef du formulaire.
 * `toValues(row)` : ligne → valeurs du formulaire ; `fromValues(values, row?)` : valeurs → données à enregistrer.
 * `label(row)` : nom de la ligne pour les messages. Slots : `cell-<key>`, `toolbar`, `empty`.
 */
const props = withDefaults(defineProps<{
  collection: CollectionName
  columns: any[]
  fields: FieldDef[]
  title?: string
  description?: string
  icon?: string
  filters?: any[]
  rows?: any[]
  defaults?: Record<string, any>
  toValues?: (row: any) => Record<string, any>
  fromValues?: (values: Record<string, any>, row?: any) => Record<string, any>
  label?: (row: any) => string
  noun?: string
  createLabel?: string
  readonly?: boolean
  embedded?: boolean
  noDelete?: boolean
  exportName?: string
  dialogSize?: 'sm' | 'md' | 'lg' | 'xl'
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  searchPlaceholder?: string
}>(), { noun: 'élément', createLabel: 'Ajouter', dialogSize: 'md' })

const db = useDb()
const auth = useAuth()
const act = useAction()
const confirm = useConfirm()

const data = computed(() => props.rows ?? (db.all(props.collection) as any[]))
const mayCreate = computed(() => !props.readonly && canCreate(auth.role.value, props.collection))
const mayEdit = computed(() => !props.readonly && canUpdate(auth.role.value, props.collection))
const mayRemove = computed(() => !props.readonly && !props.noDelete && canRemove(auth.role.value, props.collection))
const nameOf = (row: any) => props.label?.(row) ?? row?.name ?? row?.title ?? row?.ref ?? props.noun

const open = ref(false)
const editing = ref<any | null>(null)
const initial = computed(() => (editing.value ? (props.toValues ? props.toValues(editing.value) : { ...editing.value }) : { ...(props.defaults ?? {}) }))

function openNew() { editing.value = null; open.value = true }
function openEdit(row: any) { editing.value = row; open.value = true }

function save(values: Record<string, any>) {
  const payload = props.fromValues ? props.fromValues(values, editing.value ?? undefined) : { ...values }
  if (editing.value) db.update(props.collection, editing.value.id, payload as any, { summary: `Modification · ${nameOf({ ...editing.value, ...payload })}` })
  else db.create(props.collection, payload as any, { summary: `Création · ${nameOf(payload)}` })
}

async function remove(row: any) {
  const ok = await confirm({ title: `Supprimer « ${nameOf(row)} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', tone: 'danger' })
  if (!ok) return
  await act(() => db.remove(props.collection, row.id, { summary: `Suppression · ${nameOf(row)}` }), 'Élément supprimé.')
}
</script>

<template>
  <div>
    <UiPageHeader v-if="!embedded && title" :title="title" :description="description" :icon="icon">
      <template #actions><slot name="header-actions" /><UiButton v-if="mayCreate" icon="plus" @click="openNew">{{ createLabel }}</UiButton></template>
    </UiPageHeader>
    <div v-else-if="mayCreate" class="mb-3 flex justify-end"><UiButton icon="plus" size="sm" @click="openNew">{{ createLabel }}</UiButton></div>

    <UiDataTable
      :rows="data" :columns="columns" :filters="filters" :export-name="exportName" :initial-sort="initialSort" :search-placeholder="searchPlaceholder"
      v-bind="mayEdit ? { onRowClick: openEdit } : {}"
    >
      <template v-for="c in columns" :key="c.key" #[`cell-${c.key}`]="slotProps"><slot :name="`cell-${c.key}`" v-bind="slotProps">{{ slotProps.value }}</slot></template>
      <template v-if="mayRemove || $slots['row-actions']" #actions="{ row }"><div class="flex justify-end gap-1"><slot name="row-actions" :row="row" /><UiButton v-if="mayRemove" size="sm" variant="ghost" icon="trash-2" :aria-label="`Supprimer ${nameOf(row)}`" @click.stop="remove(row)" /></div></template>
      <template #toolbar><slot name="toolbar" /></template>
      <template #empty><slot name="empty"><UiEmpty icon="inbox" :title="`Aucun ${noun}`" hint="Ajoutez le premier élément pour commencer."><UiButton v-if="mayCreate" icon="plus" @click="openNew">{{ createLabel }}</UiButton></UiEmpty></slot></template>
    </UiDataTable>

    <UiFormDialog v-model:open="open" :title="editing ? `Modifier · ${nameOf(editing)}` : createLabel" :fields="fields" :initial="initial" :size="dialogSize" @submit="save" />
  </div>
</template>
