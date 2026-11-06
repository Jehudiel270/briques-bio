<script setup lang="ts">
import { fdate, fdatetime, kg, num } from '#shared/utils/format'
import { POLYMER_LABEL, STATUS } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

const w = computed(() => db.get('workOrders', id.value))
usePageTitle(w.value ? `Ordre ${w.value.ref}` : 'Ordre de fabrication')
const product = computed(() => (w.value ? db.peek('products', w.value.productId) : undefined))
const lot = computed(() => (w.value?.lotId ? db.peek('productionLots', w.value.lotId) : undefined))
const events = computed(() => db.all('productionEvents').filter((e) => e.workOrderId === id.value).sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
const operators = computed(() => (w.value?.operatorIds ?? []).map((o) => db.peek('operators', o)?.name).filter(Boolean).join(', ') || '—')
const manage = computed(() => auth.can('production.manage'))
const st = computed(() => w.value?.status)
const can = computed(() => ({
  reserve: manage.value && !!st.value && ['draft', 'planned', 'materials_reserved'].includes(st.value),
  start: manage.value && st.value === 'materials_reserved',
  pause: manage.value && st.value === 'in_progress',
  resume: manage.value && st.value === 'paused',
  record: manage.value && !!st.value && ['in_progress', 'paused'].includes(st.value),
  complete: manage.value && !!st.value && ['in_progress', 'paused'].includes(st.value) && (w.value?.producedQty ?? 0) > 0,
  cancel: manage.value && !!st.value && !['completed', 'cancelled'].includes(st.value),
  event: manage.value && !!st.value && !['cancelled'].includes(st.value),
}))
const steps = ['Planifié', 'Matière réservée', 'En production', 'Clôturé']
const current = computed(() => ({ draft: 0, planned: 0, materials_reserved: 1, in_progress: 2, paused: 2, completed: 3, cancelled: 0 } as Record<string, number>)[st.value ?? 'draft'] ?? 0)
const progress = computed(() => (w.value && w.value.plannedQty ? Math.min(100, Math.round((w.value.producedQty / w.value.plannedQty) * 100)) : 0))
const yieldPct = computed(() => (w.value && w.value.producedQty + w.value.scrapQty ? Math.round((w.value.producedQty / (w.value.producedQty + w.value.scrapQty)) * 1000) / 10 : null))

const recordOpen = ref(false); const eventOpen = ref(false); const cancelOpen = ref(false)
const recordFields: FieldDef[] = [
  { key: 'producedQty', label: 'Pièces produites (cumul)', type: 'number', required: true, min: 0 },
  { key: 'scrapQty', label: 'Rebut (cumul)', type: 'number', required: true, min: 0 },
  { key: 'materialKgConsumed', label: 'Matière consommée (kg, cumul)', type: 'number', required: true, min: 0, step: 0.1, span: 2 },
]
const eventFields: FieldDef[] = [
  { key: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'anomaly', label: 'Anomalie' }, { value: 'stop', label: 'Arrêt' }, { value: 'note', label: 'Note' }] },
  { key: 'severity', label: 'Gravité', type: 'select', required: true, options: [{ value: 'low', label: 'Faible' }, { value: 'medium', label: 'Moyenne' }, { value: 'high', label: 'Élevée' }] },
  { key: 'durationMin', label: 'Durée (min)', type: 'number', min: 0 },
  { key: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 3 },
]
const cancelFields: FieldDef[] = [{ key: 'reason', label: 'Motif de l’annulation', type: 'textarea', required: true, span: 2, rows: 3 }]

const reserve = () => act(() => svc.production.reserve(id.value, 'auto'), 'Matière réservée (FIFO).')
const start = () => act(() => svc.production.start(id.value), 'Production démarrée.')
const pause = () => act(() => svc.production.pause(id.value), 'Production mise en pause.')
const resume = () => act(() => svc.production.resume(id.value), 'Production reprise.')
const complete = () => act(() => svc.production.complete(id.value), 'Ordre clôturé : lot créé, en attente de contrôle qualité.')
const record = (v: Record<string, any>) => svc.production.record(id.value, { producedQty: Number(v.producedQty), scrapQty: Number(v.scrapQty), materialKgConsumed: Number(v.materialKgConsumed) })
const logEvent = (v: Record<string, any>) => svc.production.logEvent(id.value, { type: v.type, severity: v.severity, description: String(v.description), durationMin: v.durationMin != null && v.durationMin !== '' ? Number(v.durationMin) : undefined })
const cancel = (v: Record<string, any>) => svc.production.cancel(id.value, String(v.reason))
const toggleEvent = (e: { id: string; resolved: boolean }) => act(() => db.update('productionEvents', e.id, { resolved: !e.resolved } as any, { summary: e.resolved ? 'Anomalie rouverte' : 'Anomalie résolue' }), e.resolved ? 'Anomalie rouverte.' : 'Anomalie résolue.')
const sevTone = { low: 'neutral', medium: 'warning', high: 'danger' } as const
const sevLabel = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' } as const
</script>

<template>
  <div>
    <UiEmpty v-if="!w" icon="clipboard-x" title="Ordre introuvable"><UiButton icon="arrow-left" to="/ops/production/ordres">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Ordre ${w.ref}`" back="/ops/production/ordres" icon="clipboard-list" :description="`${product?.name ?? '—'} · ${num(w.plannedQty)} pièces prévues · ${fdate(w.plannedStart)} → ${fdate(w.plannedEnd)}`">
        <template #meta><UiStatusBadge kind="workOrder" :value="w.status" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="can.reserve" icon="lock" @click="reserve">{{ st === 'materials_reserved' ? 'Compléter la réservation' : 'Réserver la matière' }}</UiButton>
          <UiButton v-if="can.start" icon="play" @click="start">Démarrer</UiButton>
          <UiButton v-if="can.pause" variant="outline" icon="pause" @click="pause">Pause</UiButton>
          <UiButton v-if="can.resume" icon="play" @click="resume">Reprendre</UiButton>
          <UiButton v-if="can.record" variant="outline" icon="clipboard-pen" @click="recordOpen = true">Saisir les quantités</UiButton>
          <UiButton v-if="can.complete" icon="flag" @click="complete">Clôturer et créer le lot</UiButton>
          <UiButton v-if="can.event" variant="outline" icon="triangle-alert" @click="eventOpen = true">Signaler</UiButton>
          <UiButton v-if="can.cancel" variant="outline" icon="ban" @click="cancelOpen = true">Annuler</UiButton>
        </template>
      </UiPageHeader>

      <UiCard v-if="st !== 'cancelled'" class="mb-5"><UiStepper :steps="steps" :current="current" /></UiCard>
      <UiAlert v-else tone="neutral" icon="ban" title="Ordre annulé" class="mb-5">La matière réservée a été rendue au stock.</UiAlert>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStat label="Produit" :value="num(w.producedQty)" icon="package-check" tone="success" :hint="`${progress} % de l’objectif`" />
        <UiStat label="Rebut" :value="num(w.scrapQty)" icon="trash-2" :tone="w.scrapQty ? 'warning' : 'neutral'" :hint="yieldPct != null ? `Rendement ${yieldPct} %` : undefined" />
        <UiStat label="Matière prévue" :value="kg(w.materialKgPlanned)" icon="recycle" tone="info" />
        <UiStat label="Matière consommée" :value="kg(w.materialKgConsumed)" icon="factory" tone="accent" />
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Matière réservée" icon="boxes" padding="none">
            <UiEmpty v-if="!w.reservations.length" compact icon="boxes" title="Aucune réservation" hint="Réservez la matière pour pouvoir démarrer." class="m-4" />
            <div v-else class="scroll-x">
              <table class="w-full min-w-[28rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Lot</th><th class="px-3 py-2.5 font-medium">Plastique</th><th class="px-3 py-2.5 font-medium">Fournisseur</th><th class="px-4 py-2.5 text-right font-medium">Réservé</th></tr></thead>
                <tbody>
                  <tr v-for="r in w.reservations" :key="r.rawLotId" class="border-b border-line/70 last:border-0">
                    <td class="px-4 py-3 font-medium"><NuxtLink :to="`/ops/appro/lots-matiere/${r.rawLotId}`" class="hover:underline">{{ L.rawLotRef(r.rawLotId) }}</NuxtLink></td>
                    <td class="px-3 py-3">{{ POLYMER_LABEL[L.peek('rawLots', r.rawLotId)?.polymer ?? 'OTHER'] }}</td>
                    <td class="px-3 py-3 text-muted">{{ L.supplierName(L.peek('rawLots', r.rawLotId)?.supplierId) }}</td>
                    <td class="tnum px-4 py-3 text-right">{{ kg(r.kg) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard title="Anomalies et arrêts" icon="triangle-alert">
            <UiEmpty v-if="!events.length" compact icon="shield-check" title="Rien à signaler" />
            <ul v-else class="divide-y divide-line">
              <li v-for="e in events" :key="e.id" class="flex items-start gap-3 py-3 text-sm">
                <UiBadge :tone="sevTone[e.severity]" size="sm">{{ sevLabel[e.severity] }}</UiBadge>
                <div class="min-w-0 flex-1"><p :class="e.resolved && 'text-muted line-through'">{{ e.description }}</p><p class="text-[13px] text-muted">{{ fdatetime(e.startedAt) }}{{ e.durationMin ? ` · ${e.durationMin} min` : '' }}</p></div>
                <UiButton v-if="manage" size="sm" variant="ghost" :icon="e.resolved ? 'rotate-ccw' : 'check'" :aria-label="e.resolved ? 'Rouvrir' : 'Marquer résolue'" @click="toggleEvent(e)" />
              </li>
            </ul>
          </UiCard>
          <UiCard title="Historique" icon="history"><UiTimeline :items="[...w.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Informations" icon="info">
            <UiKeyValue :items="[{ label: 'Produit', value: product ? `${product.ref} · ${product.name}` : '—' }, { label: 'Opérateurs', value: operators }, { label: 'Démarré le', value: w.actualStart ? fdatetime(w.actualStart) : '—' }, { label: 'Terminé le', value: w.actualEnd ? fdatetime(w.actualEnd) : '—' }]" />
            <UiProgress class="mt-3" :value="progress" tone="success" label="Avancement" show-value />
            <p v-if="w.internalRecipeNote" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ w.internalRecipeNote }}</p>
          </UiCard>
          <UiCard v-if="lot" title="Lot produit" icon="boxes">
            <UiKeyValue :items="[{ label: 'Lot', value: lot.ref }, { label: 'Pièces', value: num(lot.producedQty) }]" />
            <div class="mt-3 flex items-center justify-between"><UiStatusBadge kind="lotQc" :value="lot.qcStatus" size="sm" /><UiButton size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/production/lots/${lot.id}`">Ouvrir</UiButton></div>
          </UiCard>
          <SiteNotice kind="technical" dense />
        </aside>
      </div>

      <UiFormDialog v-model:open="recordOpen" title="Saisir les quantités" description="Saisissez les cumuls depuis le début de l’ordre." :fields="recordFields" :initial="{ producedQty: w.producedQty, scrapQty: w.scrapQty, materialKgConsumed: w.materialKgConsumed }" submit-label="Enregistrer" @submit="record" />
      <UiFormDialog v-model:open="eventOpen" title="Signaler une anomalie" :fields="eventFields" :initial="{ type: 'anomaly', severity: 'medium' }" submit-label="Enregistrer" @submit="logEvent" />
      <UiFormDialog v-model:open="cancelOpen" title="Annuler l’ordre" description="La matière réservée est rendue au stock." :fields="cancelFields" submit-label="Annuler l’ordre" @submit="cancel" />
    </template>
  </div>
</template>
