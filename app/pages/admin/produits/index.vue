<script setup lang="ts">
import { fcfa } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Product } from '#shared/types/domain'

usePageTitle('Produits')
const db = useDb()
const act = useAction()
const rows = computed(() => [...db.all('products')].sort((a, b) => a.ref.localeCompare(b.ref)))
const columns = [
  { key: 'ref', label: 'Réf.', sortable: true },
  { key: 'name', label: 'Produit', sortable: true },
  { key: 'category', label: 'Catégorie', hide: 'md' as const, value: (p: Product) => (db.peek('categories', p.categoryId)?.name ?? '—') },
  { key: 'price', label: 'Prix indicatif', align: 'right' as const, hide: 'sm' as const, sortable: true, value: (p: Product) => (p.priceIndicative != null ? fcfa(p.priceIndicative) : 'Sur devis'), sortValue: (p: Product) => p.priceIndicative ?? 0 },
  { key: 'validation', label: 'Validation', value: (p: Product) => STATUS.validation[p.validation].label },
  { key: 'published', label: 'Publication', hide: 'lg' as const, value: (p: Product) => (p.published ? 'Publié' : 'Masqué') },
]
const filters = [
  { key: 'validation', label: 'Validation', options: Object.entries(STATUS.validation).map(([value, m]) => ({ value, label: m.label })), accessor: (p: Product) => p.validation },
  { key: 'published', label: 'Publication', options: [{ value: 'yes', label: 'Publiés' }, { value: 'no', label: 'Masqués' }], accessor: (p: Product) => (p.published ? 'yes' : 'no') },
]
const toggle = (p: Product) => act(() => db.update('products', p.id, { published: !p.published } as any, { summary: `${p.published ? 'Dépublication' : 'Publication'} · ${p.ref}` }), p.published ? 'Produit masqué du catalogue.' : 'Produit publié.')
</script>

<template>
  <div>
    <UiPageHeader title="Produits" description="Catalogue complet : fiches, photos, prix indicatifs et statut de validation." icon="package">
      <template #actions><UiButton icon="plus" to="/admin/produits/nouveau">Nouveau produit</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" dense export-name="produits" @row-click="(p: Product) => navigateTo(`/admin/produits/${p.id}`)">
      <template #cell-name="{ row }"><div class="flex items-center gap-3"><UiImage :media="row.photos[0]" :product="row" :alt="row.name" ratio="1/1" :width="120" class="size-10 shrink-0 rounded-md" /><span class="font-medium">{{ row.name }}</span></div></template>
      <template #cell-validation="{ row }"><UiStatusBadge kind="validation" :value="row.validation" size="sm" /></template>
      <template #cell-published="{ row }"><UiBadge :tone="row.published ? 'success' : 'neutral'" size="sm" dot>{{ row.published ? 'Publié' : 'Masqué' }}</UiBadge></template>
      <template #actions="{ row }"><UiButton size="sm" variant="ghost" :icon="row.published ? 'eye-off' : 'eye'" @click.stop="toggle(row)">{{ row.published ? 'Masquer' : 'Publier' }}</UiButton></template>
      <template #empty><UiEmpty icon="package" title="Aucun produit" hint="Créez votre premier produit."><UiButton icon="plus" to="/admin/produits/nouveau">Nouveau produit</UiButton></UiEmpty></template>
    </UiDataTable>
  </div>
</template>
