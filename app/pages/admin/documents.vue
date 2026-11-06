<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import { DOC_KIND_LABEL, STATUS } from '#shared/utils/labels'
import type { TechDocument } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Documents')
const db = useDb()
const auth = useAuth()
const L = useLookups()
const kindOptions = Object.entries(DOC_KIND_LABEL).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(STATUS.document).map(([value, m]) => ({ value, label: m.label }))
const visOptions = [{ value: 'internal', label: 'Interne' }, { value: 'customers', label: 'Clients connectés' }, { value: 'public', label: 'Public' }]
const fields = computed<FieldDef[]>(() => [
  { key: 'title', label: 'Titre', type: 'text', required: true, span: 2 },
  { key: 'kind', label: 'Nature', type: 'select', required: true, options: kindOptions },
  { key: 'productId', label: 'Produit', type: 'select', options: [{ value: '', label: 'Aucun' }, ...db.all('products').map((p) => ({ value: p.id, label: p.name }))] },
  { key: 'status', label: 'Statut', type: 'select', required: true, options: statusOptions },
  { key: 'visibility', label: 'Visibilité', type: 'select', required: true, options: visOptions },
  { key: 'version', label: 'Version', type: 'text', required: true },
  { key: 'demoNotice', label: 'Mention obligatoire', type: 'text', required: true, span: 2 },
  { key: 'file', label: 'Fichier (Cloudinary)', type: 'media', folder: 'documents', span: 2 },
])
const columns = [
  { key: 'ref', label: 'Réf.', sortable: true },
  { key: 'title', label: 'Document', sortable: true },
  { key: 'kind', label: 'Nature', hide: 'sm' as const, value: (d: TechDocument) => DOC_KIND_LABEL[d.kind] },
  { key: 'product', label: 'Produit', hide: 'md' as const, value: (d: TechDocument) => (d.productId ? L.productName(d.productId) : '—') },
  { key: 'version', label: 'Version', hide: 'lg' as const },
  { key: 'updatedAt', label: 'Mis à jour', hide: 'lg' as const, sortable: true, value: (d: TechDocument) => fdate(d.updatedAt), sortValue: (d: TechDocument) => d.updatedAt },
  { key: 'status', label: 'Statut', value: (d: TechDocument) => STATUS.document[d.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: statusOptions, accessor: (d: TechDocument) => d.status },
  { key: 'kind', label: 'Nature', options: kindOptions, accessor: (d: TechDocument) => d.kind },
]
const toValues = (d: TechDocument) => ({ ...d, productId: d.productId ?? '' })
const fromValues = (v: Record<string, any>, row?: TechDocument) => {
  const now = new Date().toISOString()
  return {
    ref: row?.ref ?? db.nextRef('documents', 'DOC'), title: v.title, kind: v.kind, productId: v.productId || undefined, status: v.status, visibility: v.visibility, version: v.version,
    mime: row?.mime ?? (v.file ? 'application/pdf' : 'application/pdf'), file: v.file || undefined, demoNotice: v.demoNotice, uploadedBy: row?.uploadedBy ?? auth.user.value?.id,
    createdAt: row?.createdAt ?? now, updatedAt: now, demo: true,
  }
}
</script>

<template>
  <div>
    <WsCrud collection="documents" title="Documents techniques" description="Fiches techniques, rapports d’essais et preuves. Chaque document porte la mention de démonstration." icon="files" :columns="columns" :fields="fields" :filters="filters" noun="document" create-label="Nouveau document" :defaults="{ kind: 'datasheet', status: 'draft', visibility: 'internal', version: '0.1', demoNotice: 'Document fictif de démonstration — non officiel, sans valeur de certificat.' }" :to-values="toValues" :from-values="fromValues" export-name="documents" dialog-size="lg">
      <template #cell-status="{ row }"><UiStatusBadge kind="document" :value="row.status" size="sm" /></template>
    </WsCrud>
    <SiteNotice class="mt-4" kind="document" dense />
  </div>
</template>
