<script setup lang="ts">
import { meetsCriterion } from '#shared/services'
import { fdate, fdatetime, num } from '#shared/utils/format'
import { DOC_KIND_LABEL } from '#shared/utils/labels'
import type { QcTemplate } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

const q = computed(() => db.get('qcInspections', id.value))
usePageTitle(q.value ? `Contrôle ${q.value.ref}` : 'Contrôle qualité')
const lot = computed(() => (q.value ? db.peek('productionLots', q.value.lotId) : undefined))
const rows = computed(() => (q.value?.results ?? []).map((r) => ({ r, t: db.peek('qcTemplates', r.templateId) })).filter((x): x is { r: typeof x.r; t: QcTemplate } => !!x.t).sort((a, b) => a.t.order - b.t.order))
const editable = computed(() => !!q.value && q.value.status !== 'completed' && auth.can('quality.inspect'))

const entries = reactive<Record<string, { value: string; passed: '' | 'yes' | 'no'; note: string }>>({})
watch(q, (insp) => {
  if (!insp) return
  for (const r of insp.results) entries[r.templateId] = { value: r.value != null ? String(r.value) : '', passed: r.passed === undefined ? '' : r.passed ? 'yes' : 'no', note: r.note ?? '' }
}, { immediate: true })

const critText = (t: QcTemplate) => {
  const c = t.criterion; const u = t.unit ? ` ${t.unit}` : ''
  if (c.kind === 'min') return `≥ ${num(c.min ?? 0, 1)}${u}`
  if (c.kind === 'max') return `≤ ${num(c.max ?? 0, 1)}${u}`
  if (c.kind === 'range') return `entre ${num(c.min ?? 0, 1)} et ${num(c.max ?? 0, 1)}${u}`
  return 'Conforme / non conforme'
}
/** true = conforme, false = non conforme, null = non saisi */
const verdict = (t: QcTemplate): boolean | null => {
  const e = entries[t.id]
  if (!e) return null
  if (t.criterion.kind === 'pass_fail') return e.passed === '' ? null : e.passed === 'yes'
  if (e.value === '') return null
  return meetsCriterion(t.criterion, Number(e.value))
}
const missing = computed(() => rows.value.filter((x) => x.t.required && verdict(x.t) === null).length)
const failing = computed(() => rows.value.filter((x) => verdict(x.t) === false).length)
const savedVerdict = (t: QcTemplate, r: { value?: number; passed?: boolean }) => (t.criterion.kind === 'pass_fail' ? r.passed : r.value != null ? meetsCriterion(t.criterion, r.value) : undefined)

const saving = ref(false)
async function save() {
  saving.value = true
  await act(() => svc.quality.record(id.value, rows.value.filter((x) => verdict(x.t) !== null).map(({ t }) => {
    const e = entries[t.id]!
    return t.criterion.kind === 'pass_fail' ? { templateId: t.id, passed: e.passed === 'yes', note: e.note || undefined } : { templateId: t.id, value: Number(e.value), note: e.note || undefined }
  })), 'Résultats enregistrés.')
  saving.value = false
}

const decideOpen = ref(false)
const decisionFields = computed<FieldDef[]>(() => [
  { key: 'decision', label: 'Décision', type: 'select', required: true, options: [{ value: 'accepted', label: 'Libérer le lot' }, { value: 'quarantine', label: 'Mettre en quarantaine' }, { value: 'rejected', label: 'Rejeter le lot' }], span: 2 },
  { key: 'reason', label: 'Justification', type: 'textarea', required: true, span: 2, rows: 3 },
])
const decide = (v: Record<string, any>) => svc.quality.decide(id.value, { decision: v.decision, reason: String(v.reason) })
const reportOpen = ref(false)
const docFields = computed<FieldDef[]>(() => [{ key: 'documentId', label: 'Document (rapport d’essai)', type: 'select', required: true, span: 2, options: db.all('documents').filter((d) => d.status !== 'archived').map((d) => ({ value: d.id, label: `${d.ref} · ${d.title}` })) }])
const attach = (v: Record<string, any>) => svc.quality.attachReport(id.value, String(v.documentId))
const report = computed(() => (q.value?.reportDocumentId ? db.peek('documents', q.value.reportDocumentId) : undefined))
const canDecide = computed(() => !!q.value && q.value.status !== 'completed' && auth.can('quality.release'))
</script>

<template>
  <div>
    <UiEmpty v-if="!q" icon="clipboard-x" title="Contrôle introuvable"><UiButton icon="arrow-left" to="/ops/qualite/controles">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Contrôle ${q.ref}`" back="/ops/qualite/controles" icon="microscope" :description="`${L.lotRef(q.lotId)} · ${L.productName(lot?.productId)} · demandé le ${fdate(q.requestedAt)}`">
        <template #meta><UiStatusBadge kind="inspection" :value="q.status" /><UiStatusBadge v-if="q.decision" kind="inspectionDecision" :value="q.decision" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="canDecide" icon="gavel" @click="decideOpen = true">Décider</UiButton>
          <UiButton v-if="auth.can('quality.inspect') || auth.can('docs.manage')" variant="outline" icon="paperclip" @click="reportOpen = true">Joindre un rapport</UiButton>
        </template>
      </UiPageHeader>

      <UiAlert tone="warning" icon="clipboard-check" title="Seuils de démonstration" class="mb-5">Les critères ci-dessous sont des valeurs de démonstration : ils ne constituent ni une exigence normative ni une certification.</UiAlert>
      <UiAlert v-if="q.decision" :tone="q.decision === 'accepted' ? 'success' : 'warning'" :icon="q.decision === 'accepted' ? 'shield-check' : 'shield-alert'" :title="q.decision === 'accepted' ? 'Lot libéré : désormais vendable' : q.decision === 'rejected' ? 'Lot rejeté' : 'Lot en quarantaine'" class="mb-5">{{ q.decisionReason }} <span class="text-muted">· {{ L.userName(q.decidedBy) }}{{ q.decidedAt ? `, ${fdatetime(q.decidedAt)}` : '' }}</span></UiAlert>

      <div class="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <UiCard title="Résultats d’essais" icon="flask-conical" padding="none">
          <UiEmpty v-if="!rows.length" compact icon="flask-conical" title="Aucun test défini pour ce produit" hint="Ajoutez des tests dans le référentiel." class="m-4" />
          <ul v-else class="divide-y divide-line">
            <li v-for="{ r, t } in rows" :key="t.id" class="grid gap-3 px-4 py-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center sm:px-5">
              <div class="min-w-0"><p class="font-medium">{{ t.name }} <UiBadge v-if="t.required" size="sm" tone="info">Obligatoire</UiBadge></p><p class="text-[13px] text-muted">{{ t.method }} · critère : {{ critText(t) }}</p></div>
              <div v-if="editable && entries[t.id]">
                <UiSelect v-if="t.criterion.kind === 'pass_fail'" :model-value="entries[t.id]!.passed" :options="[{ value: '', label: 'Non saisi' }, { value: 'yes', label: 'Conforme' }, { value: 'no', label: 'Non conforme' }]" @update:model-value="(v: any) => (entries[t.id]!.passed = v)" />
                <UiInput v-else :model-value="entries[t.id]!.value" type="number" :suffix="t.unit" :aria-label="`Valeur mesurée : ${t.name}`" @update:model-value="(v: any) => (entries[t.id]!.value = String(v ?? ''))" />
              </div>
              <p v-else class="tnum text-sm">{{ t.criterion.kind === 'pass_fail' ? (r.passed === undefined ? '—' : r.passed ? 'Conforme' : 'Non conforme') : r.value != null ? `${num(r.value, 2)} ${t.unit}` : '—' }}</p>
              <div class="flex w-24 justify-end">
                <UiBadge v-if="(editable ? verdict(t) : savedVerdict(t, r)) === true" tone="success" size="sm" icon="check">Conforme</UiBadge>
                <UiBadge v-else-if="(editable ? verdict(t) : savedVerdict(t, r)) === false" tone="danger" size="sm" icon="x">Hors seuil</UiBadge>
                <UiBadge v-else size="sm">Non saisi</UiBadge>
              </div>
            </li>
          </ul>
          <div v-if="editable" class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5 sm:px-5">
            <p class="text-sm text-muted">{{ missing ? `${missing} test(s) obligatoire(s) restant(s)` : 'Tous les tests obligatoires sont saisis' }}{{ failing ? ` · ${failing} hors seuil` : '' }}</p>
            <UiButton icon="save" :loading="saving" @click="save">Enregistrer les résultats</UiButton>
          </div>
        </UiCard>

        <aside class="flex flex-col gap-5">
          <UiCard title="Lot contrôlé" icon="boxes">
            <UiKeyValue :items="[{ label: 'Lot', value: L.lotRef(q.lotId) }, { label: 'Produit', value: L.productName(lot?.productId) }, { label: 'Pièces', value: lot ? num(lot.producedQty) : '—' }, { label: 'Technicien', value: L.userName(q.assignedTo) }]" />
            <UiButton v-if="lot" class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/production/lots/${lot.id}`">Traçabilité du lot</UiButton>
          </UiCard>
          <UiCard title="Rapport joint" icon="file-check-2">
            <p v-if="!report" class="text-sm text-muted">Aucun rapport joint.</p>
            <template v-else><p class="font-medium">{{ report.title }}</p><p class="text-[13px] text-muted">{{ report.ref }} · {{ DOC_KIND_LABEL[report.kind] }} · v{{ report.version }}</p><SiteNotice class="mt-3" kind="document" dense /></template>
          </UiCard>
          <UiCard title="Historique" icon="history"><UiTimeline :items="[...q.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="decideOpen" title="Décision qualité" :description="missing ? `Attention : ${missing} test(s) obligatoire(s) non saisi(s) — la libération sera refusée.` : failing ? `${failing} test(s) hors seuil : la libération sera refusée.` : 'La libération rend le lot vendable.'" :fields="decisionFields" :initial="{ decision: failing ? 'rejected' : 'accepted' }" submit-label="Valider la décision" @submit="decide" />
      <UiFormDialog v-model:open="reportOpen" title="Joindre un rapport d’essai" :fields="docFields" submit-label="Joindre" @submit="attach" />
    </template>
  </div>
</template>
