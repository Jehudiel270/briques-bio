<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import { DOC_KIND_LABEL } from '#shared/utils/labels'
import type { TechDocument } from '#shared/types/domain'

usePageTitle('Documents')
const db = useDb()
const L = useLookups()
const rows = computed(() => db.all('documents').filter((d) => d.status === 'published' && d.visibility !== 'internal').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const columns = [
  { key: 'title', label: 'Document', sortable: true },
  { key: 'kind', label: 'Type', value: (d: TechDocument) => DOC_KIND_LABEL[d.kind] ?? d.kind, hide: 'sm' as const },
  { key: 'product', label: 'Produit', value: (d: TechDocument) => (d.productId ? L.productName(d.productId) : '—'), hide: 'md' as const },
  { key: 'version', label: 'Version', hide: 'lg' as const },
  { key: 'updatedAt', label: 'Mis à jour', sortable: true, hide: 'md' as const, value: (d: TechDocument) => fdate(d.updatedAt), sortValue: (d: TechDocument) => d.updatedAt },
]
const filters = [{ key: 'kind', label: 'Type', options: Object.entries(DOC_KIND_LABEL).map(([value, label]) => ({ value, label })), accessor: (d: TechDocument) => d.kind }]
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('documents', openId.value))
</script>

<template>
  <div>
    <UiPageHeader title="Documents" description="Fiches techniques, guides et justificatifs publiés pour vos produits." icon="folder-open" />
    <SiteNotice kind="document" class="mb-5" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" @row-click="(d: TechDocument) => (openId = d.id)">
      <template #cell-title="{ row }"><span class="flex items-center gap-2 font-medium"><Icon name="lucide:file-text" class="size-4 text-primary" aria-hidden="true" />{{ row.title }}</span></template>
      <template #empty><UiEmpty icon="files" title="Aucun document publié" /></template>
    </UiDataTable>

    <UiDialog v-model:open="open" :title="sel?.title ?? 'Document'" :description="sel ? `${sel.ref} · version ${sel.version}` : undefined">
      <div v-if="sel" class="flex flex-col gap-4">
        <UiKeyValue :items="[{ label: 'Type', value: DOC_KIND_LABEL[sel.kind] }, { label: 'Produit', value: sel.productId ? L.productName(sel.productId) : '—' }, { label: 'Format', value: sel.mime }, { label: 'Taille', value: sel.sizeKb ? `${sel.sizeKb} ko` : '—' }, { label: 'Mis à jour', value: fdate(sel.updatedAt) }]" />
        <UiAlert tone="accent" icon="file-warning" title="Document de démonstration">{{ sel.demoNotice }}</UiAlert>
        <a v-if="sel.file?.url" :href="sel.file.url" target="_blank" rel="noopener noreferrer"><UiButton variant="outline" icon="external-link">Ouvrir le fichier</UiButton></a>
        <p v-else class="text-[13px] text-muted">Aucun fichier n’est associé à ce document de démonstration.</p>
      </div>
    </UiDialog>
  </div>
</template>
