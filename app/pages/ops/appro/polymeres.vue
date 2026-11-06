<script setup lang="ts">
import { fcfa } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import { canUpdate } from '#shared/utils/permissions'
import type { PolymerCode, PolymerRule } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Types de plastique')
const auth = useAuth()
const settings = useSettings()
const mayEdit = computed(() => canUpdate(auth.role.value, 'settings'))
const rules = computed(() => settings.value.polymers)
const db = useDb()

const columns = [
  { key: 'code', label: 'Plastique', sortable: true, value: (p: PolymerRule) => POLYMER_LABEL[p.code] ?? p.code },
  { key: 'accepted', label: 'Accepté', value: (p: PolymerRule) => (p.accepted ? 'Oui' : 'Non') },
  { key: 'pricePerKg', label: 'Prix d’achat (simulé)', align: 'right' as const, sortable: true, value: (p: PolymerRule) => `${fcfa(p.pricePerKg)}/kg`, sortValue: (p: PolymerRule) => p.pricePerKg },
  { key: 'maxContaminationPct', label: 'Contamination max.', align: 'right' as const, hide: 'sm' as const, value: (p: PolymerRule) => `${p.maxContaminationPct} %` },
  { key: 'threshold', label: 'Seuil d’alerte stock', align: 'right' as const, hide: 'md' as const, value: (p: PolymerRule) => (settings.value.rawThresholdsKg[p.code] != null ? `${settings.value.rawThresholdsKg[p.code]} kg` : '—') },
  { key: 'criteria', label: 'Critères d’acceptation', hide: 'lg' as const },
]
const fields: FieldDef[] = [
  { key: 'accepted', label: 'Plastique accepté à la réception', type: 'switch', span: 2 },
  { key: 'pricePerKg', label: 'Prix d’achat simulé (FCFA/kg)', type: 'currency', required: true, min: 0 },
  { key: 'maxContaminationPct', label: 'Contamination maximale (%)', type: 'number', required: true, min: 0, max: 100 },
  { key: 'threshold', label: 'Seuil d’alerte de stock (kg)', type: 'number', min: 0 },
  { key: 'criteria', label: 'Critères d’acceptation', type: 'textarea', required: true, span: 2, rows: 3 },
]
const open = ref(false)
const editing = ref<PolymerRule | null>(null)
const initial = computed(() => (editing.value ? { ...editing.value, threshold: settings.value.rawThresholdsKg[editing.value.code] ?? null } : {}))
const edit = (p: PolymerRule) => { if (!mayEdit.value) return; editing.value = p; open.value = true }
function save(v: Record<string, any>) {
  const code = editing.value!.code as PolymerCode
  const polymers = rules.value.map((p) => (p.code === code ? { ...p, accepted: !!v.accepted, pricePerKg: Number(v.pricePerKg), maxContaminationPct: Number(v.maxContaminationPct), criteria: String(v.criteria) } : p))
  const thresholds = { ...settings.value.rawThresholdsKg }
  if (v.threshold == null || v.threshold === '') delete thresholds[code]; else thresholds[code] = Number(v.threshold)
  db.update('settings', 'company', { polymers, rawThresholdsKg: thresholds } as any, { summary: `Règle plastique · ${POLYMER_LABEL[code]}` })
}
</script>

<template>
  <div>
    <UiPageHeader title="Types de plastique" description="Plastiques acceptés à la réception, critères, prix d’achat simulés et seuils d’alerte." icon="atom" />
    <UiAlert v-if="!mayEdit" tone="info" icon="lock" title="Consultation seule" class="mb-4">Les règles d’acceptation sont modifiables par l’administration.</UiAlert>
    <UiDataTable :rows="rules" :columns="columns" row-key="code" export-name="types-plastique" v-bind="mayEdit ? { onRowClick: edit } : {}">
      <template #cell-accepted="{ row }"><UiBadge :tone="row.accepted ? 'success' : 'danger'" size="sm" dot>{{ row.accepted ? 'Accepté' : 'Refusé' }}</UiBadge></template>
      <template #empty><UiEmpty icon="atom" title="Aucune règle configurée" /></template>
    </UiDataTable>
    <SiteNotice class="mt-4" kind="simulated" dense />
    <UiFormDialog v-model:open="open" :title="`Règle · ${editing ? POLYMER_LABEL[editing.code] : ''}`" :fields="fields" :initial="initial" submit-label="Enregistrer" @submit="save" />
  </div>
</template>
