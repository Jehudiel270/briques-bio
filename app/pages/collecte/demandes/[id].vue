<script setup lang="ts">
import { fdate, fdatetime, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const db = useDb()
const svc = useServices()
const L = useLookups()

const c = computed(() => db.get('collections', String(route.params.id)))
usePageTitle(c.value ? `Demande ${c.value.ref}` : 'Demande')
const receipt = computed(() => (c.value?.receiptId ? db.get('receipts', c.value.receiptId) : db.all('receipts').find((r) => r.collectionId === c.value?.id)))
const canCancel = computed(() => !!c.value && ['submitted', 'under_review', 'planned'].includes(c.value.status))
const stepIndex = computed(() => ({ submitted: 0, under_review: 1, planned: 2, en_route: 3, collected: 4, weighed: 5, received: 6, problem: 3, cancelled: 0, rejected: 1 } as Record<string, number>)[c.value?.status ?? 'submitted'] ?? 0)
const steps = ['Envoyée', 'Examinée', 'Planifiée', 'En route', 'Collectée', 'Pesée', 'Reçue']
const failed = computed(() => !!c.value && ['problem', 'cancelled', 'rejected'].includes(c.value.status))

const cancelOpen = ref(false)
const fields: FieldDef[] = [{ key: 'reason', label: 'Motif de l’annulation', type: 'textarea', required: true, span: 2, rows: 3 }]
const cancel = (v: Record<string, any>) => svc.collections.cancel(c.value!.id, String(v.reason))
</script>

<template>
  <div class="flex flex-col gap-5">
    <UiEmpty v-if="!c" icon="package-x" title="Demande introuvable" hint="Elle n’existe pas ou ne concerne pas votre profil.">
      <UiButton icon="arrow-left" to="/collecte/demandes">Retour aux demandes</UiButton>
    </UiEmpty>
    <template v-else>
      <UiPageHeader :title="c.ref" back="/collecte/demandes" icon="package" :description="`Envoyée le ${fdate(c.createdAt)}`">
        <template #meta><UiStatusBadge kind="collection" :value="c.status" /><UiDemoBadge /></template>
      </UiPageHeader>

      <UiStepper :steps="steps" :current="stepIndex" :failed="failed" />

      <UiAlert v-if="c.status === 'rejected'" tone="danger" icon="x-circle" title="Demande refusée">{{ c.history.at(-1)?.note ?? 'Voir l’historique.' }}</UiAlert>
      <UiAlert v-if="c.status === 'problem'" tone="danger" icon="triangle-alert" title="Problème signalé par le chauffeur">{{ c.problemReason }}</UiAlert>
      <UiAlert v-if="c.status === 'cancelled'" tone="neutral" icon="ban" title="Demande annulée">{{ c.cancelReason }}</UiAlert>
      <UiAlert v-if="c.status === 'under_review' && c.proposedSlots.length" tone="info" icon="calendar-clock" title="Créneaux proposés">{{ c.proposedSlots.join(' · ') }}</UiAlert>

      <UiCard title="Enlèvement" icon="map-pin">
        <UiKeyValue :items="[
          { label: 'Lieu', value: c.pickupPoint.label },
          { label: 'Adresse', value: `${c.pickupPoint.line}, ${c.pickupPoint.city}` },
          { label: 'Date prévue', value: c.scheduledAt ? fdatetime(c.scheduledAt) : 'À planifier' },
          { label: 'Chauffeur', value: c.driverUserId ? L.userName(c.driverUserId) : '—' },
          { label: 'Créneaux souhaités', value: c.preferredSlots.join(' · ') },
        ]" />
      </UiCard>

      <UiCard title="Plastiques déclarés" icon="package">
        <ul class="divide-y divide-line">
          <li v-for="p in c.polymers" :key="p.code" class="flex items-center justify-between py-2.5"><span class="font-medium">{{ POLYMER_LABEL[p.code] }}</span><span class="tnum">{{ kg(p.estimatedKg) }}</span></li>
        </ul>
        <p class="tnum mt-2 flex justify-between border-t border-line pt-3 font-display font-semibold"><span>Total estimé</span><span>{{ kg(c.estimatedTotalKg) }}</span></p>
        <p v-if="c.recordedKg != null" class="tnum mt-1 flex justify-between text-sm"><span class="text-muted">Poids relevé par le chauffeur</span><span>{{ kg(c.recordedKg) }}</span></p>
      </UiCard>

      <UiCard v-if="receipt" title="Pesée à la réception" icon="scale" description="Quantités confirmées par l’atelier : elles servent de base à votre rémunération.">
        <div class="scroll-x">
          <table class="w-full min-w-[22rem] text-sm">
            <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="py-2 font-medium">Plastique</th><th class="py-2 text-right font-medium">Pesé</th><th class="py-2 text-right font-medium">Accepté</th><th class="py-2 text-right font-medium">Rejeté</th></tr></thead>
            <tbody><tr v-for="l in receipt.lines" :key="l.polymer" class="border-b border-line/70 last:border-0"><td class="py-2.5 font-medium">{{ POLYMER_LABEL[l.polymer] }}</td><td class="tnum py-2.5 text-right">{{ kg(l.weighedKg) }}</td><td class="tnum py-2.5 text-right text-success">{{ kg(l.acceptedKg) }}</td><td class="tnum py-2.5 text-right" :class="l.rejectedKg ? 'text-danger' : undefined">{{ kg(l.rejectedKg) }}</td></tr></tbody>
          </table>
        </div>
        <p class="mt-3 text-[13px] text-muted">Bon {{ receipt.ref }} · {{ fdate(receipt.receivedAt) }}. Un désaccord ? <NuxtLink to="/collecte/reclamations" class="font-medium text-primary hover:underline">Déposer une réclamation</NuxtLink></p>
      </UiCard>

      <UiCard v-if="c.proof" title="Preuve d’enlèvement" icon="camera">
        <p class="text-sm">{{ c.proof.note }}</p><p class="mt-1 text-[13px] text-muted">{{ fdatetime(c.proof.at) }}</p>
        <UiImage v-if="c.proof.photo" class="mt-3 rounded-lg" :media="c.proof.photo" alt="Photo de preuve d’enlèvement" ratio="4/3" :width="640" />
      </UiCard>

      <UiCard title="Historique" icon="history"><UiTimeline :items="[...c.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>

      <UiButton v-if="canCancel" variant="outline" size="lg" block icon="ban" @click="cancelOpen = true">Annuler la demande</UiButton>
      <UiFormDialog v-model:open="cancelOpen" title="Annuler la demande" :fields="fields" submit-label="Annuler la demande" @submit="cancel" />
    </template>
  </div>
</template>
