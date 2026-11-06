<script setup lang="ts">
import type { Category } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Catégories')
const db = useDb()
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom', type: 'text', required: true },
  { key: 'order', label: 'Ordre d’affichage', type: 'number', required: true, min: 1 },
  { key: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 3 },
  { key: 'published', label: 'Visible dans le catalogue public', type: 'switch', span: 2 },
]
const columns = [
  { key: 'order', label: '#', sortable: true, width: '3.5rem' },
  { key: 'name', label: 'Catégorie', sortable: true },
  { key: 'products', label: 'Produits', align: 'right' as const, value: (c: Category) => db.all('products').filter((p) => p.categoryId === c.id).length },
  { key: 'description', label: 'Description', hide: 'md' as const },
  { key: 'published', label: 'Visibilité', value: (c: Category) => (c.published ? 'Publiée' : 'Masquée') },
]
const fromValues = (v: Record<string, any>, row?: Category) => ({ name: v.name, slug: row?.slug ?? slugify(String(v.name)), description: v.description, order: Number(v.order), published: !!v.published })
</script>

<template>
  <WsCrud collection="categories" title="Catégories" description="Familles de produits du catalogue public : ordre et visibilité." icon="folder-tree" :columns="columns" :fields="fields" noun="catégorie" create-label="Nouvelle catégorie" :defaults="{ published: true, order: 10 }" :from-values="fromValues" export-name="categories" :initial-sort="{ key: 'order', dir: 'asc' }">
    <template #cell-published="{ row }"><UiBadge :tone="row.published ? 'success' : 'neutral'" size="sm" dot>{{ row.published ? 'Publiée' : 'Masquée' }}</UiBadge></template>
  </WsCrud>
</template>
