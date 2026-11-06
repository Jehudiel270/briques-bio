<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import type { PortfolioClient } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Portefeuille clients')
const db = useDb()
const auth = useAuth()
const settings = useSettings()
const confirm = useConfirm()
const act = useAction()

const company = computed(() => db.peek('companies', auth.user.value?.companyId))
const enabled = computed(() => settings.value.features.distributorPortfolio)
const rows = computed(() => company.value?.portfolio ?? [])

const formOpen = ref(false)
const editing = ref<PortfolioClient | null>(null)
const fields: FieldDef[] = [
  { key: 'name', label: 'Client final', type: 'text', required: true, span: 2 },
  { key: 'city', label: 'Ville', type: 'text', required: true },
  { key: 'contact', label: 'Contact', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
]
const openNew = () => { editing.value = null; formOpen.value = true }
const openEdit = (c: PortfolioClient) => { editing.value = c; formOpen.value = true }
function save(v: Record<string, any>) {
  const list = editing.value
    ? rows.value.map((c) => (c.id === editing.value!.id ? { ...c, name: v.name, city: v.city, contact: v.contact, notes: v.notes } : c))
    : [...rows.value, { id: `pc_${Date.now()}`, name: v.name, city: v.city, contact: v.contact, notes: v.notes }]
  db.update('companies', company.value!.id, { portfolio: list } as any, { summary: `Portefeuille clients · ${v.name}` })
}
async function remove(c: PortfolioClient) {
  if (!(await confirm({ title: `Retirer ${c.name} ?`, message: 'Ce client final sera supprimé de votre portefeuille.', confirmLabel: 'Retirer', tone: 'danger' }))) return
  await act(() => db.update('companies', company.value!.id, { portfolio: rows.value.filter((x) => x.id !== c.id) } as any, { summary: `Client retiré du portefeuille · ${c.name}` }), 'Client retiré du portefeuille.')
}
const columns = [
  { key: 'name', label: 'Client final', sortable: true },
  { key: 'city', label: 'Ville', sortable: true, hide: 'sm' as const },
  { key: 'contact', label: 'Contact', hide: 'md' as const, value: (c: PortfolioClient) => c.contact ?? '—' },
  { key: 'lastOrderAt', label: 'Dernière commande', hide: 'md' as const, value: (c: PortfolioClient) => (c.lastOrderAt ? fdate(c.lastOrderAt) : '—'), sortValue: (c: PortfolioClient) => c.lastOrderAt ?? '' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Portefeuille clients" description="Vos clients finaux, pour suivre les produits que vous revendez." icon="contact">
      <template #actions><UiButton v-if="enabled && company" icon="user-plus" @click="openNew">Ajouter un client</UiButton></template>
    </UiPageHeader>
    <UiEmpty v-if="!enabled" icon="toggle-left" title="Fonction désactivée" hint="Le portefeuille clients est désactivé dans les paramètres de la plateforme." />
    <UiEmpty v-else-if="!company" icon="building-2" title="Aucune entreprise rattachée" />
    <UiDataTable v-else :rows="rows" :columns="columns" @row-click="openEdit">
      <template #actions="{ row }"><UiButton size="sm" variant="ghost" icon="trash-2" :aria-label="`Retirer ${row.name}`" @click.stop="remove(row)" /></template>
      <template #empty><UiEmpty icon="contact" title="Portefeuille vide" hint="Ajoutez vos clients finaux pour suivre leurs achats."><UiButton icon="user-plus" @click="openNew">Ajouter un client</UiButton></UiEmpty></template>
    </UiDataTable>
    <UiFormDialog v-model:open="formOpen" :title="editing ? 'Modifier le client' : 'Ajouter un client'" :fields="fields" :initial="editing ?? {}" @submit="save" />
  </div>
</template>
