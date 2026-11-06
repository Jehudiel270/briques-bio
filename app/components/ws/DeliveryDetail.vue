<script setup lang="ts">
import { fcfa, fdate, fdatetime, fmtAddress } from '#shared/utils/format'
import type { Incident, MediaRef } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

/** Détail d'une livraison : planification (transporteur, date, frais), expédition, preuve de livraison, incidents. */
const props = defineProps<{ id: string; back: string }>()
const db = useDb()
const svc = useServices()
const act = useAction()
const confirm = useConfirm()
const auth = useAuth()
const L = useLookups()

const d = computed(() => db.get('deliveries', props.id))
usePageTitle(d.value ? `Livraison ${d.value.ref}` : 'Livraison')
const order = computed(() => db.get('orders', d.value?.orderId))
const manage = computed(() => auth.can('delivery.manage'))
const carriers = computed(() => db.all('carriers').filter((c) => c.status === 'active'))
const stepIndex = computed(() => ({ to_prepare: 0, preparing: 0, planned: 1, in_transit: 2, delivered: 3, failed: 2, cancelled: 0 } as Record<string, number>)[d.value?.status ?? 'to_prepare'] ?? 0)

const planOpen = ref(false); const deliverOpen = ref(false); const incidentOpen = ref(false)
const planFields = computed<FieldDef[]>(() => [
  { key: 'carrierId', label: 'Transporteur', type: 'select', required: true, options: carriers.value.map((c) => ({ value: c.id, label: `${c.name} · ${c.vehicle}` })) },
  { key: 'plannedDate', label: 'Date prévue', type: 'date', required: true },
  { key: 'fee', label: 'Frais de livraison (FCFA)', type: 'currency', min: 0 },
])
const deliverFields: FieldDef[] = [
  { key: 'receivedBy', label: 'Réceptionné par', type: 'text', required: true, span: 2, hint: 'Nom de la personne qui a signé la réception : la preuve est obligatoire.' },
  { key: 'note', label: 'Remarque', type: 'textarea', span: 2, rows: 2 },
  { key: 'photo', label: 'Photo de la livraison (facultatif)', type: 'media', folder: 'livraisons' },
]
const incidentFields: FieldDef[] = [
  { key: 'type', label: 'Type d’incident', type: 'select', required: true, options: [{ value: 'delay', label: 'Retard' }, { value: 'damage', label: 'Pièces abîmées' }, { value: 'absent', label: 'Client absent' }, { value: 'address', label: 'Adresse introuvable' }, { value: 'vehicle', label: 'Panne véhicule' }, { value: 'other', label: 'Autre' }] },
  { key: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 3 },
]
const plan = (v: Record<string, any>) => svc.deliveries.plan(props.id, { carrierId: v.carrierId, plannedDate: new Date(`${v.plannedDate}T08:00:00`).toISOString(), fee: v.fee != null && v.fee !== '' ? Number(v.fee) : undefined })
const deliver = (v: Record<string, any>) => svc.deliveries.deliver(props.id, { receivedBy: String(v.receivedBy), note: v.note || undefined, photo: (Array.isArray(v.photo) ? v.photo[0] : v.photo) as MediaRef | undefined })
const incident = (v: Record<string, any>) => svc.deliveries.incident(props.id, { type: v.type as Incident['type'], description: String(v.description) })
async function ship() {
  if (!(await confirm({ title: 'Expédier cette livraison ?', message: 'Les lots réservés passent en « expédiés » et le stock est mis à jour.', confirmLabel: 'Expédier' }))) return
  await act(() => svc.deliveries.ship(props.id), 'Livraison expédiée.')
}
const resolve = (i: Incident) => act(() => svc.deliveries.resolveIncident(props.id, i.id), 'Incident résolu.')
</script>

<template>
  <div>
    <UiEmpty v-if="!d" icon="package-x" title="Livraison introuvable"><UiButton icon="arrow-left" :to="back">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Livraison ${d.ref}`" :back="back" icon="truck" :description="order ? `Commande ${order.ref} · ${fmtAddress(d.address)}` : undefined">
        <template #meta><UiStatusBadge kind="delivery" :value="d.status" /><UiBadge v-if="d.incidents.some((i) => !i.resolved)" tone="danger" icon="triangle-alert">Incident en cours</UiBadge><UiDemoBadge /></template>
        <template #actions>
          <template v-if="manage">
            <UiButton v-if="['to_prepare', 'preparing', 'planned'].includes(d.status)" icon="calendar-plus" @click="planOpen = true">{{ d.status === 'planned' ? 'Replanifier' : 'Planifier' }}</UiButton>
            <UiButton v-if="d.status === 'planned'" icon="truck" @click="ship">Expédier</UiButton>
            <UiButton v-if="d.status === 'in_transit'" icon="package-check" @click="deliverOpen = true">Confirmer la livraison</UiButton>
            <UiButton v-if="['planned', 'in_transit'].includes(d.status)" variant="outline" icon="triangle-alert" @click="incidentOpen = true">Signaler un incident</UiButton>
          </template>
        </template>
      </UiPageHeader>

      <UiStepper class="mb-5" :steps="['Préparation', 'Planifiée', 'En transit', 'Livrée']" :current="stepIndex" :failed="d.status === 'failed'" />
      <UiAlert v-if="order && order.awaitingStock" tone="warning" icon="hourglass" title="Lots non encore réservés" class="mb-5">La commande attend des lots libérés par la qualité : la livraison ne peut pas partir avant la réservation.</UiAlert>

      <div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Contenu" icon="boxes" padding="none">
            <ul class="divide-y divide-line">
              <li v-for="l in order?.lines ?? []" :key="l.id" class="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5"><div><p class="font-medium">{{ l.label }}</p><p class="text-[13px] text-muted">Lots : {{ l.allocations.map((a) => `${L.lotRef(a.lotId)} ×${a.qty}`).join(', ') || 'non réservés' }}</p></div><span class="tnum">{{ l.qty }}</span></li>
            </ul>
          </UiCard>
          <UiCard title="Incidents" icon="triangle-alert">
            <UiEmpty v-if="!d.incidents.length" compact icon="shield-check" title="Aucun incident" />
            <ul v-else class="space-y-3"><li v-for="i in d.incidents" :key="i.id" class="flex items-start justify-between gap-3 rounded-lg border border-line p-3 text-sm"><div><p>{{ i.description }}</p><p class="mt-1 text-[12px] text-muted">{{ fdatetime(i.at) }} · {{ i.type }}</p></div><UiBadge v-if="i.resolved" tone="success" size="sm">Résolu</UiBadge><UiButton v-else-if="manage" size="sm" variant="outline" @click="resolve(i)">Résoudre</UiButton></li></ul>
          </UiCard>
          <UiCard title="Historique" icon="history"><UiTimeline :items="[...d.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </div>
        <aside class="flex flex-col gap-5">
          <UiCard title="Transport" icon="truck">
            <UiKeyValue :items="[{ label: 'Transporteur', value: d.carrierId ? L.carrierName(d.carrierId) : '—' }, { label: 'Chauffeur', value: d.driverName }, { label: 'Prévue le', value: d.plannedDate ? fdate(d.plannedDate) : 'À planifier' }, { label: 'Expédiée', value: d.shippedAt ? fdatetime(d.shippedAt) : '—' }, { label: 'Livrée', value: d.deliveredAt ? fdatetime(d.deliveredAt) : '—' }, { label: 'Frais', value: fcfa(d.fee) }, { label: 'Tournée', value: d.tourRef }]" />
          </UiCard>
          <UiCard v-if="d.proof" title="Preuve de livraison" icon="badge-check">
            <p class="text-sm">Réceptionnée par <strong>{{ d.proof.receivedBy }}</strong> le {{ fdatetime(d.proof.at) }}.</p><p v-if="d.proof.note" class="mt-1 text-[13px] text-muted">{{ d.proof.note }}</p>
            <UiImage v-if="d.proof.photo" class="mt-3 rounded-lg" :media="d.proof.photo" alt="Photo de la livraison" ratio="4/3" :width="640" />
          </UiCard>
          <UiCard v-if="order" title="Commande" icon="package"><UiKeyValue :items="[{ label: 'Référence', value: order.ref }, { label: 'Client', value: order.companyId ? L.companyName(order.companyId) : L.userName(order.userId) }, { label: 'Total', value: fcfa(order.total) }]" /></UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="planOpen" title="Planifier la livraison" :fields="planFields" :initial="{ carrierId: d.carrierId, plannedDate: d.plannedDate?.slice(0, 10), fee: d.fee }" submit-label="Planifier" @submit="plan" />
      <UiFormDialog v-model:open="deliverOpen" title="Confirmer la livraison" description="La preuve de livraison est obligatoire." :fields="deliverFields" submit-label="Confirmer la livraison" @submit="deliver" />
      <UiFormDialog v-model:open="incidentOpen" title="Signaler un incident" :fields="incidentFields" submit-label="Signaler" @submit="incident" />
    </template>
  </div>
</template>
