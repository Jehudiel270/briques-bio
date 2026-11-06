<script setup lang="ts">
import { kg, fdate } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { PolymerCode, ReceiptLine } from '#shared/types/domain'

usePageTitle('Nouvelle réception')
const route = useRoute()
const db = useDb()
const svc = useServices()
const act = useAction()
const settings = useSettings()

interface Line { polymer: PolymerCode; weighed: number | string; rejected: number | string; quarantine: number | string; contamination: number | string; reason: string }

const collectionId = ref(String(route.query.collection ?? ''))
const supplierId = ref('')
const notes = ref('')
const lines = ref<Line[]>([])
const errors = reactive<{ supplier?: string; lines?: string }>({})
const busy = ref(false)

const waiting = computed(() => db.all('collections').filter((c) => ['collected', 'weighed'].includes(c.status)))
const collection = computed(() => (collectionId.value ? db.peek('collections', collectionId.value) : undefined))
const collectionOptions = computed(() => [{ value: '', label: 'Sans collecte (apport direct)' }, ...waiting.value.map((c) => ({ value: c.id, label: `${c.ref} · ${db.peek('suppliers', c.supplierId)?.name ?? ''}` }))])
const supplierOptions = computed(() => db.all('suppliers').filter((s) => s.status === 'approved').map((s) => ({ value: s.id, label: s.name })))
const polymerOptions = computed(() => Object.entries(POLYMER_LABEL).map(([value, label]) => ({ value, label })))
const rule = (code: PolymerCode) => settings.value.polymers.find((p) => p.code === code)

watch(collection, (c) => {
  if (!c) return
  supplierId.value = c.supplierId
  lines.value = c.polymers.map((p) => ({ polymer: p.code, weighed: c.recordedKg && c.polymers.length === 1 ? c.recordedKg : p.estimatedKg, rejected: 0, quarantine: 0, contamination: '', reason: '' }))
}, { immediate: true })
if (!lines.value.length) lines.value = [{ polymer: 'PET', weighed: '', rejected: 0, quarantine: 0, contamination: '', reason: '' }]

const n = (v: number | string) => Number(v) || 0
const accepted = (l: Line) => Math.max(0, Math.round((n(l.weighed) - n(l.rejected) - n(l.quarantine)) * 100) / 100)
const invalid = (l: Line) => n(l.weighed) <= 0 ? 'Poids pesé requis.' : n(l.rejected) + n(l.quarantine) > n(l.weighed) ? 'Rejet + quarantaine dépassent le poids pesé.' : (n(l.rejected) + n(l.quarantine) > 0 && !l.reason.trim()) ? 'Indiquez le motif du rejet ou de la quarantaine.' : (rule(l.polymer) && !rule(l.polymer)!.accepted) ? `${POLYMER_LABEL[l.polymer]} n’est pas accepté : rejetez ou mettez en quarantaine.` : ''
const decisionOf = (l: Line): ReceiptLine['decision'] => (n(l.rejected) >= n(l.weighed) ? 'rejected' : n(l.quarantine) >= n(l.weighed) ? 'quarantine' : n(l.rejected) + n(l.quarantine) > 0 ? 'partial' : 'accepted')
const totalWeighed = computed(() => lines.value.reduce((a, l) => a + n(l.weighed), 0))
const totalAccepted = computed(() => lines.value.reduce((a, l) => a + accepted(l), 0))
const addLine = () => lines.value.push({ polymer: 'PET', weighed: '', rejected: 0, quarantine: 0, contamination: '', reason: '' })
const removeLine = (i: number) => lines.value.splice(i, 1)

async function submit() {
  errors.supplier = supplierId.value ? undefined : 'Choisissez le fournisseur.'
  errors.lines = lines.value.map(invalid).find(Boolean) || (lines.value.length ? undefined : 'Ajoutez au moins une ligne.')
  if (errors.supplier || errors.lines) return
  busy.value = true
  let rid = ''
  const ok = await act(() => {
    const r = svc.receipts.confirm({
      collectionId: collectionId.value || undefined, supplierId: supplierId.value, notes: notes.value || undefined,
      lines: lines.value.map((l) => ({ polymer: l.polymer, weighedKg: n(l.weighed), acceptedKg: accepted(l), rejectedKg: n(l.rejected), quarantineKg: n(l.quarantine), contaminationPct: l.contamination === '' ? undefined : n(l.contamination), decision: decisionOf(l), reason: l.reason.trim() || undefined })),
    })
    rid = r.id
  }, 'Réception enregistrée : lots de matière créés.')
  busy.value = false
  if (ok) await navigateTo(`/ops/appro/receptions/${rid}`)
}
</script>

<template>
  <div>
    <UiPageHeader title="Nouvelle réception" back="/ops/appro/receptions" icon="scale" description="Pesez la matière, décidez pour chaque plastique : les kilos acceptés deviennent des lots de matière disponibles." />
    <form class="grid gap-5 xl:grid-cols-[1.8fr_1fr]" novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-5">
        <UiCard title="Origine" icon="truck">
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="Collecte à réceptionner" hint="Seules les collectes enlevées ou pesées sont proposées." #default="{ id }"><UiSelect :id="id" v-model="collectionId" :options="collectionOptions" searchable /></UiField>
            <UiField label="Fournisseur" required :error="errors.supplier" #default="{ id }"><UiSelect :id="id" v-model="supplierId" :options="supplierOptions" :disabled="!!collection" searchable placeholder="Choisir un fournisseur agréé" /></UiField>
          </div>
          <p v-if="collection" class="mt-3 text-[13px] text-muted">{{ collection.ref }} · enlevée le {{ collection.scheduledAt ? fdate(collection.scheduledAt) : '—' }} · {{ kg(collection.estimatedTotalKg) }} annoncés<template v-if="collection.recordedKg != null"> · {{ kg(collection.recordedKg) }} relevés par le chauffeur</template>.</p>
        </UiCard>

        <UiCard title="Pesée par type de plastique" icon="atom">
          <template #actions><UiButton size="sm" variant="outline" icon="plus" @click="addLine">Ajouter</UiButton></template>
          <div class="flex flex-col gap-4">
            <fieldset v-for="(l, i) in lines" :key="i" class="rounded-lg border border-line p-4">
              <legend class="px-1 text-[13px] font-medium text-muted">Ligne {{ i + 1 }}</legend>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <UiField label="Plastique" #default="{ id }"><UiSelect :id="id" :model-value="l.polymer" :options="polymerOptions" @update:model-value="(v: any) => (l.polymer = v)" /></UiField>
                <UiField label="Poids pesé" required #default="{ id }"><UiInput :id="id" v-model="l.weighed" type="number" suffix="kg" /></UiField>
                <UiField label="Rejeté" #default="{ id }"><UiInput :id="id" v-model="l.rejected" type="number" suffix="kg" /></UiField>
                <UiField label="Quarantaine" #default="{ id }"><UiInput :id="id" v-model="l.quarantine" type="number" suffix="kg" /></UiField>
                <UiField label="Contamination estimée" #default="{ id }"><UiInput :id="id" v-model="l.contamination" type="number" suffix="%" /></UiField>
                <UiField label="Motif (si rejet ou quarantaine)" class="sm:col-span-2 lg:col-span-3" #default="{ id }"><UiInput :id="id" v-model="l.reason" placeholder="Ex. présence de PVC, humidité élevée…" /></UiField>
              </div>
              <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>Accepté : <strong class="tnum">{{ kg(accepted(l)) }}</strong> <UiBadge size="sm" class="ml-1">{{ { accepted: 'Accepté', rejected: 'Rejeté', quarantine: 'Quarantaine', partial: 'Partiel' }[decisionOf(l)] }}</UiBadge></span>
                <span v-if="invalid(l)" class="text-danger" role="alert">{{ invalid(l) }}</span>
                <UiButton v-if="lines.length > 1" size="sm" variant="ghost" icon="trash-2" aria-label="Retirer la ligne" @click="removeLine(i)" />
              </div>
            </fieldset>
          </div>
          <p v-if="errors.lines" class="mt-3 text-sm text-danger" role="alert">{{ errors.lines }}</p>
        </UiCard>

        <UiCard title="Notes" icon="notebook-pen"><UiTextarea v-model="notes" :rows="3" placeholder="Observations de réception (facultatif)" /></UiCard>
      </div>

      <aside class="flex flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
        <UiCard title="Récapitulatif" icon="calculator">
          <UiKeyValue :items="[{ label: 'Pesé', value: kg(totalWeighed) }, { label: 'Accepté (lots disponibles)', value: kg(totalAccepted) }, { label: 'Rejeté + quarantaine', value: kg(totalWeighed - totalAccepted) }]" />
          <UiButton class="mt-4" type="submit" icon="check" block :loading="busy">Confirmer la réception</UiButton>
        </UiCard>
        <SiteNotice kind="simulated" dense />
      </aside>
    </form>
  </div>
</template>
