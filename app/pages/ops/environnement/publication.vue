<script setup lang="ts">
import { fdate, fmonth } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { EnvIndicator } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Validation et publication')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()
const rows = computed(() => [...db.all('envIndicators')].sort((a, b) => b.periodTo.localeCompare(a.periodTo)))
const mayManage = computed(() => auth.can('env.manage'))
const mayPublish = computed(() => auth.can('env.publish'))

const open = ref(false)
const fields: FieldDef[] = [
  { key: 'key', label: 'Clé technique', type: 'text', required: true, placeholder: 'ex. plastique_accepte_kg', hint: 'Unique par période.' },
  { key: 'label', label: 'Libellé public', type: 'text', required: true },
  { key: 'value', label: 'Valeur mesurée', type: 'number', required: true, step: 0.01 },
  { key: 'unit', label: 'Unité', type: 'text', required: true, placeholder: 'kg, pièces…' },
  { key: 'periodFrom', label: 'Période : de (AAAA-MM)', type: 'text', required: true, placeholder: '2026-01' },
  { key: 'periodTo', label: 'Période : à (AAAA-MM)', type: 'text', required: true, placeholder: '2026-10' },
  { key: 'methodology', label: 'Méthodologie (obligatoire pour publier)', type: 'textarea', span: 2, rows: 4 },
]
const create = (v: Record<string, any>) => svc.env.createIndicator({ key: String(v.key), label: String(v.label), value: Number(v.value), unit: String(v.unit), periodFrom: String(v.periodFrom), periodTo: String(v.periodTo), methodology: v.methodology || undefined })
const validate = (i: EnvIndicator) => act(() => svc.env.validateRecord(i.id), 'Indicateur validé.')
const publish = (i: EnvIndicator) => act(() => svc.env.publish(i.id), 'Indicateur publié sur la page d’impact.')
const unpublish = (i: EnvIndicator) => act(() => svc.env.unpublish(i.id), 'Indicateur dépublié.')
const columns = [
  { key: 'label', label: 'Indicateur', sortable: true },
  { key: 'value', label: 'Valeur', align: 'right' as const, value: (i: EnvIndicator) => `${new Intl.NumberFormat('fr-FR').format(i.value)} ${i.unit}` },
  { key: 'period', label: 'Période', hide: 'sm' as const, value: (i: EnvIndicator) => `${fmonth(i.periodFrom)} → ${fmonth(i.periodTo)}` },
  { key: 'proof', label: 'Méthode · preuves', hide: 'md' as const, value: (i: EnvIndicator) => `${i.methodology ? 'Méthode ✓' : 'Méthode manquante'} · ${i.evidenceDocumentIds.length} preuve(s)` },
  { key: 'approved', label: 'Approuvé', hide: 'lg' as const, value: (i: EnvIndicator) => (i.approvedAt ? `${L.userName(i.approvedBy)} · ${fdate(i.approvedAt)}` : '—') },
  { key: 'status', label: 'Statut', value: (i: EnvIndicator) => STATUS.indicator[i.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.indicator).map(([value, m]) => ({ value, label: m.label })), accessor: (i: EnvIndicator) => i.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Validation et publication" description="Brouillon → validé → publié. Un indicateur publié apparaît sur la page d’impact publique." icon="shield-check">
      <template #actions><UiButton v-if="mayManage" icon="plus" @click="open = true">Nouvel indicateur</UiButton></template>
    </UiPageHeader>
    <UiAlert tone="info" icon="shield-check" title="Règles de publication" class="mb-5">Publier exige une méthodologie renseignée et au moins un document de preuve. Les valeurs sont des quantités mesurées ; aucune économie de CO₂ n’est calculée automatiquement.</UiAlert>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" dense export-name="indicateurs">
      <template #cell-status="{ row }"><UiStatusBadge kind="indicator" :value="row.status" size="sm" /></template>
      <template #actions="{ row }">
        <div class="flex justify-end gap-1">
          <UiButton v-if="mayManage && row.status === 'draft'" size="sm" variant="outline" icon="check" @click.stop="validate(row)">Valider</UiButton>
          <UiButton v-if="mayPublish && row.status === 'validated'" size="sm" icon="globe" @click.stop="publish(row)">Publier</UiButton>
          <UiButton v-if="mayPublish && row.status === 'published'" size="sm" variant="outline" icon="eye-off" @click.stop="unpublish(row)">Dépublier</UiButton>
        </div>
      </template>
      <template #empty><UiEmpty icon="shield-check" title="Aucun indicateur" hint="Créez un indicateur à partir de quantités mesurées."><UiButton v-if="mayManage" icon="plus" @click="open = true">Nouvel indicateur</UiButton></UiEmpty></template>
    </UiDataTable>
    <UiFormDialog v-model:open="open" title="Nouvel indicateur" description="Quantité mesurée uniquement (kg, pièces). Créé en brouillon." :fields="fields" size="lg" submit-label="Créer en brouillon" @submit="create" />
  </div>
</template>
