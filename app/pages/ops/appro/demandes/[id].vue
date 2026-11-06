<script setup lang="ts">
import { fdate, fdatetime, fmtAddress, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { MediaRef } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const svc = useServices()
const auth = useAuth()
const L = useLookups()

const c = computed(() => db.get('collections', id.value))
usePageTitle(c.value ? `Collecte ${c.value.ref}` : 'Collecte')
const supplier = computed(() => (c.value ? db.peek('suppliers', c.value.supplierId) : undefined))
const receipt = computed(() => (c.value?.receiptId ? db.peek('receipts', c.value.receiptId) : undefined))
const tour = computed(() => (c.value?.tourId ? db.peek('tours', c.value.tourId) : undefined))
const manage = computed(() => auth.can('collections.plan'))
const can = computed(() => ({
  review: !!c.value && manage.value && ['submitted', 'under_review'].includes(c.value.status),
  plan: !!c.value && manage.value && ['submitted', 'under_review', 'planned', 'problem'].includes(c.value.status),
  cancel: !!c.value && manage.value && ['submitted', 'under_review', 'planned', 'en_route', 'problem'].includes(c.value.status),
  receive: !!c.value && auth.can('receipts.manage') && ['collected', 'weighed'].includes(c.value.status),
}))

const drivers = computed(() => db.all('users').filter((u) => u.role === 'driver' && u.active).map((u) => ({ value: u.id, label: u.name })))
const tours = computed(() => db.all('tours').filter((t) => ['planned', 'in_progress'].includes(t.status)).map((t) => ({ value: t.id, label: `${t.ref} · ${fdate(t.date)} · ${L.userName(t.driverUserId)}` })))

const planOpen = ref(false); const rejectOpen = ref(false); const cancelOpen = ref(false)
const planFields = computed<FieldDef[]>(() => [
  { key: 'scheduledAt', label: 'Date et heure d’enlèvement', type: 'datetime', required: true },
  { key: 'driverUserId', label: 'Chauffeur', type: 'select', required: true, options: drivers.value },
  { key: 'tourId', label: 'Tournée existante (optionnel)', type: 'select', options: [{ value: '', label: 'Créer ou laisser automatique' }, ...tours.value], span: 2 },
])
const reasonFields: FieldDef[] = [{ key: 'reason', label: 'Motif', type: 'textarea', required: true, span: 2, rows: 3 }]
const planInitial = computed(() => ({ scheduledAt: c.value?.scheduledAt?.slice(0, 16) ?? '', driverUserId: c.value?.driverUserId ?? '', tourId: c.value?.tourId ?? '' }))

const plan = (v: Record<string, any>) => svc.collections.plan(id.value, { scheduledAt: new Date(v.scheduledAt).toISOString(), driverUserId: String(v.driverUserId), tourId: v.tourId || undefined })
const reject = (v: Record<string, any>) => svc.collections.review(id.value, { accept: false, reason: String(v.reason) })
const cancel = (v: Record<string, any>) => svc.collections.cancel(id.value, String(v.reason))
const act = useAction()
const accept = () => act(() => svc.collections.review(id.value, { accept: true, proposedSlots: c.value?.preferredSlots }), 'Demande acceptée.')
const photos = computed<MediaRef[]>(() => c.value?.photos ?? [])
</script>

<template>
  <div>
    <UiEmpty v-if="!c" icon="package-x" title="Collecte introuvable"><UiButton icon="arrow-left" to="/ops/appro/demandes">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Collecte ${c.ref}`" back="/ops/appro/demandes" icon="truck" :description="`${L.supplierName(c.supplierId)} · déposée le ${fdate(c.createdAt)}`">
        <template #meta><UiStatusBadge kind="collection" :value="c.status" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="can.review" icon="check" @click="accept">Accepter</UiButton>
          <UiButton v-if="can.plan" :variant="can.review ? 'outline' : 'primary'" icon="calendar-plus" @click="planOpen = true">{{ c.status === 'planned' ? 'Replanifier' : 'Planifier' }}</UiButton>
          <UiButton v-if="can.receive" icon="scale" :to="`/ops/appro/receptions/nouvelle?collection=${c.id}`">Réceptionner</UiButton>
          <UiButton v-if="can.review" variant="outline" icon="x" @click="rejectOpen = true">Refuser</UiButton>
          <UiButton v-if="can.cancel" variant="outline" icon="ban" @click="cancelOpen = true">Annuler</UiButton>
        </template>
      </UiPageHeader>

      <UiAlert v-if="c.status === 'problem'" tone="danger" icon="triangle-alert" title="Problème signalé sur le terrain" class="mb-5">{{ c.problemReason ?? 'Aucun détail fourni.' }} Replanifiez ou annulez la collecte.</UiAlert>
      <UiAlert v-if="c.cancelReason" tone="neutral" icon="ban" title="Collecte annulée" class="mb-5">{{ c.cancelReason }}</UiAlert>

      <div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Matière annoncée" icon="recycle" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[22rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Plastique</th><th class="px-4 py-2.5 text-right font-medium">Estimation</th></tr></thead>
                <tbody>
                  <tr v-for="p in c.polymers" :key="p.code" class="border-b border-line/70 last:border-0"><td class="px-4 py-3 font-medium">{{ POLYMER_LABEL[p.code] }}</td><td class="tnum px-4 py-3 text-right">{{ kg(p.estimatedKg) }}</td></tr>
                  <tr><td class="px-4 py-3 font-display font-semibold">Total estimé</td><td class="tnum px-4 py-3 text-right font-display font-semibold">{{ kg(c.estimatedTotalKg) }}</td></tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard v-if="photos.length" title="Photos du lot" icon="images">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3"><UiImage v-for="(p, i) in photos" :key="i" :media="p" ratio="4/3" class="rounded-md" /></div>
          </UiCard>

          <UiCard v-if="c.proof || c.recordedKg != null" title="Preuve de collecte" icon="file-check-2">
            <UiKeyValue :items="[{ label: 'Poids relevé sur place', value: c.recordedKg != null ? kg(c.recordedKg) : '—' }, { label: 'Note du chauffeur', value: c.proof?.note ?? '—' }, { label: 'Enregistrée le', value: c.proof ? fdatetime(c.proof.at) : '—' }]" />
            <UiImage v-if="c.proof?.photo" :media="c.proof.photo" ratio="16/9" class="mt-3 rounded-md" />
          </UiCard>

          <UiCard title="Historique" icon="history"><UiTimeline :items="[...c.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Enlèvement" icon="map-pin">
            <UiKeyValue :items="[{ label: 'Point', value: c.pickupPoint.label }, { label: 'Adresse', value: fmtAddress(c.pickupPoint) }, { label: 'Prévu le', value: c.scheduledAt ? fdatetime(c.scheduledAt) : 'Non planifié' }, { label: 'Chauffeur', value: L.userName(c.driverUserId) }, { label: 'Tournée', value: tour?.ref ?? '—' }]" />
            <p v-if="c.preferredSlots.length" class="mt-3 text-[13px] text-muted">Créneaux souhaités : {{ c.preferredSlots.join(' · ') }}</p>
            <p v-if="c.notes" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ c.notes }}</p>
          </UiCard>
          <UiCard v-if="supplier" title="Collecteur" icon="handshake">
            <UiKeyValue :items="[{ label: 'Nom', value: supplier.name }, { label: 'Contact', value: `${supplier.contactName} · ${supplier.phone}` }, { label: 'Statut', value: supplier.status === 'approved' ? 'Agréé' : supplier.status === 'pending' ? 'En attente' : 'Suspendu' }]" />
            <UiButton class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/appro/fournisseurs/${supplier.id}`">Ouvrir la fiche</UiButton>
          </UiCard>
          <UiCard v-if="receipt" title="Réception" icon="scale">
            <UiKeyValue :items="[{ label: 'Référence', value: receipt.ref }, { label: 'Pesé', value: kg(receipt.weighedKg) }]" />
            <UiButton class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/appro/receptions/${receipt.id}`">Voir la réception</UiButton>
          </UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="planOpen" title="Planifier l’enlèvement" description="Le collecteur et le chauffeur sont notifiés." :fields="planFields" :initial="planInitial" submit-label="Planifier" @submit="plan" />
      <UiFormDialog v-model:open="rejectOpen" title="Refuser la demande" :fields="reasonFields" submit-label="Refuser" @submit="reject" />
      <UiFormDialog v-model:open="cancelOpen" title="Annuler la collecte" :fields="reasonFields" submit-label="Annuler la collecte" @submit="cancel" />
    </template>
  </div>
</template>
