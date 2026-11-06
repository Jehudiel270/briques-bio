<script setup lang="ts">
import { fcfa, fdate, fdatetime, fmtAddress, unitLabel } from '#shared/utils/format'
import { PAYMENT_METHOD_LABEL } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const db = useDb()
const svc = useServices()
const act = useAction()
const confirm = useConfirm()
const auth = useAuth()
const L = useLookups()

const o = computed(() => db.get('orders', String(route.params.id)))
usePageTitle(o.value ? `Commande ${o.value.ref}` : 'Commande')

const delivery = computed(() => (o.value ? db.all('deliveries').find((d) => d.orderId === o.value!.id) : undefined))
const payments = computed(() => db.all('payments').filter((p) => p.orderId === o.value?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const invoice = computed(() => db.all('invoices').find((i) => i.orderId === o.value?.id))
const lots = computed(() => [...new Set(o.value?.lines.flatMap((l) => l.allocations.map((a) => a.lotId)) ?? [])].map((id) => db.peek('productionLots', id)).filter(Boolean))
const remaining = computed(() => (o.value ? Math.max(0, o.value.total - o.value.amountPaid) : 0))
const depositLeft = computed(() => (o.value ? Math.max(0, o.value.depositAmount - o.value.amountPaid) : 0))
const canPay = computed(() => !!o.value && remaining.value > 0 && !['cancelled', 'refunded'].includes(o.value.status) && auth.can('payments.record'))
const canCancel = computed(() => o.value?.status === 'pending_payment' && o.value.amountPaid === 0)
const canClaim = computed(() => !!o.value && ['shipped', 'delivered', 'disputed'].includes(o.value.status) && auth.can('claims.create'))

const stepIndex = computed(() => ({ pending_payment: 0, confirmed: 1, in_preparation: 2, ready_to_ship: 3, shipped: 4, delivered: 5, cancelled: 0, disputed: 4 } as Record<string, number>)[o.value?.status ?? 'pending_payment'] ?? 0)
const steps = ['Paiement', 'Confirmée', 'Préparation', 'Prête', 'Expédiée', 'Livrée']

const payOpen = ref(false)
const claimOpen = ref(false)
const payFields = computed<FieldDef[]>(() => [
  { key: 'kind', label: 'Type de règlement', type: 'select', required: true, options: [
    ...(depositLeft.value > 0 ? [{ value: 'deposit', label: `Acompte (${fcfa(depositLeft.value)})` }] : []),
    { value: 'full', label: `Solde complet (${fcfa(remaining.value)})` },
  ] },
  { key: 'method', label: 'Moyen de paiement (simulé)', type: 'select', required: true, options: Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label })) },
])
const payInitial = computed(() => ({ kind: depositLeft.value > 0 ? 'deposit' : 'full', method: 'mobile_money' }))
const claimFields: FieldDef[] = [
  { key: 'kind', label: 'Nature du problème', type: 'select', required: true, options: [{ value: 'quality', label: 'Qualité produit' }, { value: 'delivery', label: 'Livraison' }, { value: 'billing', label: 'Facturation' }, { value: 'other', label: 'Autre' }] },
  { key: 'subject', label: 'Objet', type: 'text', required: true, span: 2 },
  { key: 'body', label: 'Description (référence du lot, quantité concernée…)', type: 'textarea', required: true, span: 2, rows: 4 },
]

function pay(v: Record<string, any>) {
  const full = v.kind === 'full'
  const amount = full ? remaining.value : depositLeft.value
  const kind = full ? (o.value!.amountPaid > 0 ? 'balance' : 'full') : 'deposit'
  svc.orders.pay(o.value!.id, { amount, method: v.method, kind: kind as 'deposit' | 'balance' | 'full' })
}
async function cancel() {
  if (!(await confirm({ title: 'Annuler cette commande ?', message: 'Aucun paiement n’a été enregistré. Cette action est définitive.', confirmLabel: 'Annuler la commande', tone: 'danger' }))) return
  await act(() => svc.orders.cancel(o.value!.id, 'Annulée par le client'), 'Commande annulée.')
}
function claim(v: Record<string, any>) {
  const u = auth.user.value!
  const now = db.now()
  db.create('claims', {
    ref: db.nextRef('claims', 'SUP'), userId: u.id, companyId: u.companyId, orderId: o.value!.id, deliveryId: delivery.value?.id,
    kind: v.kind, subject: v.subject, priority: 'normal', status: 'open',
    thread: [{ id: `msg_${Date.now()}`, userId: u.id, userName: u.name, at: now, body: v.body }],
    createdAt: now, updatedAt: now, demo: true,
  } as any, { summary: `Réclamation sur ${o.value!.ref}` })
  db.notify({ roles: ['sales'], title: 'Nouvelle réclamation', body: `${v.subject} — ${o.value!.ref}`, level: 'warning', href: '/ops/commercial/commandes' })
}
</script>

<template>
  <div>
    <UiEmpty v-if="!o" icon="package-x" title="Commande introuvable" hint="Elle n’existe pas ou n’est pas rattachée à votre compte.">
      <UiButton icon="arrow-left" to="/espace/commandes">Retour aux commandes</UiButton>
    </UiEmpty>

    <template v-else>
      <UiPageHeader :title="`Commande ${o.ref}`" back="/espace/commandes" icon="package" :description="`Passée le ${fdate(o.createdAt)}`">
        <template #meta><UiStatusBadge kind="order" :value="o.status" /><UiStatusBadge kind="payment" :value="o.paymentStatus" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="canPay" icon="wallet" @click="payOpen = true">Régler (simulé)</UiButton>
          <UiButton v-if="canClaim" variant="outline" icon="life-buoy" @click="claimOpen = true">Signaler un problème</UiButton>
          <UiButton v-if="canCancel" variant="outline" icon="ban" @click="cancel">Annuler</UiButton>
        </template>
      </UiPageHeader>

      <UiStepper v-if="o.status !== 'cancelled'" class="mb-5" :steps="steps" :current="stepIndex" />
      <UiAlert v-if="o.status === 'cancelled'" tone="neutral" icon="ban" title="Commande annulée" class="mb-5" />
      <UiAlert v-if="o.awaitingStock && o.status === 'in_preparation'" tone="warning" icon="hourglass" title="En attente de lots libérés" class="mb-5">Les quantités doivent d’abord être fabriquées puis libérées par le contrôle qualité. Le délai est à confirmer.</UiAlert>
      <SiteNotice v-if="o.paymentStatus !== 'paid'" kind="simulated" class="mb-5" />

      <div class="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Produits commandés" icon="boxes" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[32rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Produit</th><th class="px-3 py-2.5 text-right font-medium">Quantité</th><th class="px-3 py-2.5 text-right font-medium">Prix unitaire</th><th class="px-4 py-2.5 text-right font-medium">Montant</th></tr></thead>
                <tbody>
                  <tr v-for="l in o.lines" :key="l.id" class="border-b border-line/70 last:border-0">
                    <td class="px-4 py-3 font-medium">{{ l.label }}<p v-if="l.allocations.length" class="text-[12px] font-normal text-muted">Lots : {{ l.allocations.map((a) => L.lotRef(a.lotId)).join(', ') }}</p></td>
                    <td class="tnum px-3 py-3 text-right">{{ l.qty }} {{ unitLabel(l.unit) }}</td>
                    <td class="tnum px-3 py-3 text-right">{{ fcfa(l.unitPrice) }}</td>
                    <td class="tnum px-4 py-3 text-right font-medium">{{ fcfa(Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100))) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard title="Paiements" icon="wallet">
            <UiEmpty v-if="!payments.length" compact icon="wallet" title="Aucun paiement" :hint="canPay ? `Acompte attendu : ${fcfa(depositLeft)} (simulé).` : undefined" />
            <ul v-else class="divide-y divide-line">
              <li v-for="p in payments" :key="p.id" class="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div><p class="font-medium">{{ p.ref }}</p><p class="text-[13px] text-muted">{{ PAYMENT_METHOD_LABEL[p.method] }} · {{ fdatetime(p.paidAt ?? p.createdAt) }}</p></div>
                <div class="flex items-center gap-2"><span class="tnum font-medium">{{ p.kind === 'refund' ? '−' : '' }}{{ fcfa(p.amount) }}</span><UiStatusBadge kind="paymentTx" :value="p.status" size="sm" /></div>
              </li>
            </ul>
          </UiCard>

          <UiCard v-if="lots.length" title="Traçabilité des lots" icon="qr-code" description="Les lots libérés par le contrôle qualité qui composent votre commande.">
            <ul class="divide-y divide-line">
              <li v-for="lot in lots" :key="lot!.id" class="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div><p class="font-medium">{{ lot!.ref }}</p><p class="text-[13px] text-muted">{{ L.productName(lot!.productId) }} · fabriqué le {{ fdate(lot!.producedAt) }}</p></div>
                <UiStatusBadge kind="lotQc" :value="lot!.qcStatus" size="sm" />
              </li>
            </ul>
          </UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Montants" icon="calculator">
            <UiKeyValue :items="[
              { label: 'Sous-total', value: fcfa(o.subtotal) },
              { label: 'Remises', value: o.discountTotal ? `− ${fcfa(o.discountTotal)}` : '—' },
              { label: 'Livraison', value: fcfa(o.deliveryFee) },
              { label: 'Déjà réglé (simulé)', value: fcfa(o.amountPaid) },
              { label: 'Reste à régler', value: fcfa(remaining) },
            ]" />
            <p class="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span class="font-display font-semibold">Total TTC</span><span class="tnum font-display text-2xl font-semibold">{{ fcfa(o.total) }}</span></p>
            <UiProgress class="mt-3" :value="o.amountPaid" :max="o.total" tone="success" />
          </UiCard>

          <UiCard title="Livraison" icon="truck">
            <UiKeyValue :items="[
              { label: 'Adresse', value: fmtAddress(o.deliveryAddress) },
              { label: 'Livraison', value: delivery?.ref ?? 'Non planifiée' },
              { label: 'Date prévue', value: delivery?.plannedDate ? fdate(delivery.plannedDate) : 'À confirmer' },
              { label: 'Transporteur', value: delivery?.carrierId ? L.carrierName(delivery.carrierId) : '—' },
            ]" />
            <div v-if="delivery" class="mt-3 flex items-center justify-between"><UiStatusBadge kind="delivery" :value="delivery.status" size="sm" /><UiButton size="sm" variant="ghost" iconRight="arrow-right" to="/espace/livraisons">Suivi</UiButton></div>
            <p v-if="delivery?.proof" class="mt-3 rounded-md bg-success/10 p-2.5 text-[13px] text-success">Réceptionnée par {{ delivery.proof.receivedBy }} le {{ fdate(delivery.proof.at) }}.</p>
          </UiCard>

          <UiCard v-if="invoice" title="Facture" icon="receipt-text">
            <UiKeyValue :items="[{ label: 'Référence', value: invoice.ref }, { label: 'Montant', value: fcfa(invoice.amount) }, { label: 'Échéance', value: invoice.dueAt ? fdate(invoice.dueAt) : '—' }]" />
            <div class="mt-3 flex items-center justify-between"><UiStatusBadge kind="invoice" :value="invoice.status" size="sm" /><UiDemoBadge label="Fictive" /></div>
          </UiCard>

          <UiCard title="Historique" icon="history">
            <UiTimeline :items="[...o.timeline].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." />
          </UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="payOpen" title="Règlement simulé" description="Aucune transaction réelle n’est effectuée : le paiement est enregistré à titre de démonstration." :fields="payFields" :initial="payInitial" submit-label="Confirmer le paiement simulé" @submit="pay" />
      <UiFormDialog v-model:open="claimOpen" title="Signaler un problème" :fields="claimFields" submit-label="Envoyer la réclamation" @submit="claim" />
    </template>
  </div>
</template>
