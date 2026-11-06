<script setup lang="ts">
import { DOC_KIND_LABEL } from '#shared/utils/labels'
import type { EnvIndicator, MediaRef } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Documents de preuve')
const db = useDb()
const auth = useAuth()
const act = useAction()
const may = computed(() => auth.can('env.manage'))
const indicators = computed(() => db.all('envIndicators'))
const docs = computed(() => db.all('documents').filter((d) => ['proof', 'test_report', 'datasheet', 'other'].includes(d.kind) && d.status !== 'archived'))
const docOf = (id: string) => db.peek('documents', id)
const docOptions = computed(() => docs.value.map((d) => ({ value: d.id, label: `${d.ref} · ${d.title}` })))

const target = ref<EnvIndicator | null>(null)
const open = ref(false)
const evFields = computed<FieldDef[]>(() => [{ key: 'evidenceDocumentIds', label: 'Documents de preuve', type: 'multiselect', options: docOptions.value, span: 2 }])
const attach = (i: EnvIndicator) => { target.value = i; open.value = true }
const save = (v: Record<string, any>) => db.update('envIndicators', target.value!.id, { evidenceDocumentIds: v.evidenceDocumentIds ?? [] } as any, { summary: `Preuves · ${target.value!.label}` })

const upOpen = ref(false)
const upFields: FieldDef[] = [
  { key: 'title', label: 'Titre du document', type: 'text', required: true, span: 2 },
  { key: 'kind', label: 'Nature', type: 'select', required: true, options: [{ value: 'proof', label: DOC_KIND_LABEL.proof ?? 'Preuve' }, { value: 'test_report', label: DOC_KIND_LABEL.test_report ?? 'Rapport d’essai' }, { value: 'other', label: 'Autre' }] },
  { key: 'version', label: 'Version', type: 'text', required: true },
  { key: 'file', label: 'Fichier (Cloudinary)', type: 'media', folder: 'qualite', span: 2 },
]
function upload(v: Record<string, any>) {
  const now = new Date().toISOString()
  db.create('documents', { ref: db.nextRef('documents', 'DOC'), title: v.title, kind: v.kind, status: 'internal', visibility: 'internal', version: v.version, mime: 'application/pdf', file: (v.file as MediaRef | undefined) || undefined, demoNotice: 'Document fictif de démonstration — non officiel, sans valeur de certificat.', uploadedBy: auth.user.value?.id, createdAt: now, updatedAt: now, demo: true } as any, { summary: `Document de preuve · ${v.title}` })
}
</script>

<template>
  <div>
    <UiPageHeader title="Documents de preuve" description="Rattachez des pièces justificatives (pesées, rapports) à chaque indicateur avant de le publier." icon="files">
      <template #actions><UiButton v-if="may" icon="upload" @click="upOpen = true">Ajouter un document</UiButton></template>
    </UiPageHeader>
    <UiEmpty v-if="!indicators.length" icon="files" title="Aucun indicateur" hint="Créez un indicateur dans « Validation & publication »." />
    <div v-else class="flex flex-col gap-4">
      <UiCard v-for="i in indicators" :key="i.id" :title="i.label" icon="shield-check" :description="`${i.periodFrom} → ${i.periodTo}`">
        <template #actions><UiStatusBadge kind="indicator" :value="i.status" size="sm" /></template>
        <UiAlert v-if="!i.evidenceDocumentIds.length" tone="warning" icon="file-warning" dense>Aucune preuve rattachée : un indicateur sans preuve ne devrait pas être publié.</UiAlert>
        <ul v-else class="divide-y divide-line text-sm"><li v-for="d in i.evidenceDocumentIds" :key="d" class="flex items-center justify-between gap-3 py-2.5"><span class="font-medium">{{ docOf(d)?.title ?? d }}</span><span class="text-muted">{{ docOf(d)?.ref }} · v{{ docOf(d)?.version }}</span></li></ul>
        <UiButton v-if="may && i.status !== 'published'" class="mt-3" size="sm" variant="outline" icon="paperclip" @click="attach(i)">Gérer les preuves</UiButton>
      </UiCard>
    </div>
    <SiteNotice class="mt-5" kind="document" dense />
    <UiFormDialog v-model:open="open" :title="`Preuves · ${target?.label ?? ''}`" :fields="evFields" :initial="{ evidenceDocumentIds: target?.evidenceDocumentIds ?? [] }" submit-label="Enregistrer" @submit="save" />
    <UiFormDialog v-model:open="upOpen" title="Ajouter un document de preuve" :fields="upFields" :initial="{ kind: 'proof', version: '1.0' }" submit-label="Ajouter" @submit="upload" />
  </div>
</template>
