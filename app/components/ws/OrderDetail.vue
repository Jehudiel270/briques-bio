<script setup lang="ts">
import { fcfa, fdate, fdatetime, fmtAddress, unitLabel } from '#shared/utils/format'
import { PAYMENT_METHOD_LABEL } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

/** Détail d'une commande côté équipe : paiement simulé, préparation, réservation FIFO des lots libérés, remboursement, annulation. */
const props = defineProps<{ id: string; back: string; deliveryBase?: string }>()
const db = useDb()
const svc = useServices()
const act = useAction()
const confirm = useConfirm()
const auth = useAuth()
const L = useLookups()

const o = computed(() => db.get('orders', props.id))
usePageTitle(o.value ? `Commande ${o.value.ref}` : 'Commande')
const delivery = computed(() => db.all('deliveries').find((d) => d.orderId === props.id))
const payments = computed(() => db.all('payments').filter((p) => p.orderId === props.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const invoice = computed(() => db.all('invoices').find((i) => i.orderId === props.id))
const remaining = computed(() => (o.value ? Math.max(0, o.value.total - o.value.amountPaid) : 0))
const can = computed(() => ({
  pay: !!o.value && remaining.value > 0 && !['cancelled', 'refunded'].includes(o.value.status) && auth.can('payments.record'),
  prepare: !!o.value && ['confirmed', 'pending_payment'].includes(o.value.status) && o.value.amountPaid >= o.value.depositAmount && auth.can('orders.manage'),
  allocate: !!o.value && ['confirmed', 'in_preparation', 'ready_to_ship'].includes(o.value.status) && !!o.value.awaitingStock && auth.can('orders.manage'),
  refund: !!o.value && o.value.amountPaid > 0 && auth.can('orders.manage'),
  cancel: !!o.value && ['pending_payment', 'confirmed', 'in_preparation', 'ready_to_ship'].includes(o.value.status) && auth.can('orders.manage'),
}))
const lots = computed(() => [...new Set(o.value?.lines.flatMap((l) => l.allocations.map((a) => a.lotId)) ?? [])])

const payOpen = ref(false); const refundOpen = ref(false); const cancelOpen = ref(false)
const payFields = computed<FieldDef[]>(() => [
  { key: 'amount', label: 'Montant (FCFA)', type: 'currency', required: true, min: 1, max: remaining.value, hint: `Reste à régler : ${fcfa(remaining.value)}` },
  { key: 'method', label: 'Moyen de paiement (simulé)', type: 'select', required: true, options: Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label })) },
])
const refundFields = computed<FieldDef[]>(() => [
  { key: 'amount', label: 'Montant remboursé (FCFA)', type: 'currency', required: true, min: 1, max: o.value?.amountPaid ?? 0 },
  { key: 'reason', label: 'Motif', type: 'textarea', required: true, span: 2, rows: 3 },
])
const cancelFields: FieldDef[] = [{ key: 'reason', label: 'Motif de l’annulation', type: 'textarea', required: true, span: 2, rows: 3 }]

function pay(v: Record<string, any>) {
  const amount = Number(v.amount)
  const kind = amount >= remaining.value ? (o.value!.amountPaid > 0 ? 'balance' : 'full') : o.value!.amountPaid === 0 ? 'deposit' : 'balance'
  svc.orders.pay(props.id, { amount, method: v.method, kind })
}
const refund = (v: Record<string, any>) => svc.orders.refund(props.id, Number(v.amount), String(v.reason))
const cancel = (v: Record<string, any>) => svc.orders.cancel(props.id, String(v.reason))
const prepare = async () => { await act(() => svc.orders.sendToPreparation(props.id), 'Commande envoyée en préparation.') }
const allocate = async () => { await act(() => svc.orders.allocate(props.id), 'Réservation des lots relancée.') }
void confirm
</script>

<template>
  <div>
    <UiEmpty v-if="!o" icon="package-x" title="Commande introuvable"><UiButton icon="arrow-left" :to="back">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Commande ${o.ref}`" :back="back" icon="package" :description="`${o.companyId ? L.companyName(o.companyId) : L.userName(o.userId)} · passée le ${fdate(o.createdAt)}`">
        <template #meta><UiStatusBadge kind="order" :value="o.status" /><UiStatusBadge kind="payment" :value="o.paymentStatus" /><UiBadge v-if="o.resellerOrder" tone="info" icon="store">Revente</UiBadge><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="can.pay" icon="wallet" @click="payOpen = true">Enregistrer un paiement</UiButton>
          <UiButton v-if="can.prepare" icon="package-open" @click="prepare">Envoyer en préparation</UiButton>
          <UiButton v-if="can.allocate" variant="outline" icon="boxes" @click="allocate">Réserver les lots</UiButton>
          <UiButton v-if="can.refund" variant="outline" icon="undo-2" @click="refundOpen = true">Rembourser</UiButton>
          <UiButton v-if="can.cancel" variant="outline" icon="ban" @click="cancelOpen = true">Annuler</UiButton>
        </template>
      </UiPageHeader>

      <UiAlert v-if="o.awaitingStock" tone="warning" icon="hourglass" title="En attente de lots libérés" class="mb-5">Le stock vendable (lots libérés par la qualité) est insuffisant. La production a été notifiée ; relancez la réservation une fois un lot libéré.</UiAlert>

      <div class="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Lignes et lots réservés" icon="boxes" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[36rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Produit</th><th class="px-3 py-2.5 text-right font-medium">Quantité</th><th class="px-3 py-2.5 text-right font-medium">Prix unitaire</th><th class="px-3 py-2.5 font-medium">Lots</th><th class="px-4 py-2.5 text-right font-medium">Montant</th></tr></thead>
                <tbody>
                  <tr v-for="l in o.lines" :key="l.id" class="border-b border-line/70 last:border-0">
                    <td class="px-4 py-3 font-medium">{{ l.label }}</td>
                    <td class="tnum px-3 py-3 text-right">{{ l.qty }} {{ unitLabel(l.unit) }}</td>
                    <td class="tnum px-3 py-3 text-right">{{ fcfa(l.unitPrice) }}</td>
                    <td class="px-3 py-3 text-[13px]"><span v-if="!l.allocations.length" class="text-muted">Non réservé</span><NuxtLink v-for="a in l.allocations" :key="a.lotId" :to="`/ops/production/lots/${a.lotId}`" class="mr-2 inline-block hover:underline">{{ L.lotRef(a.lotId) }} <span class="tnum text-muted">×{{ a.qty }}</span></NuxtLink></td>
                    <td class="tnum px-4 py-3 text-right font-medium">{{ fcfa(Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100))) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>
          <UiCard title="Paiements (simulés)" icon="wallet">
            <UiEmpty v-if="!payments.length" compact icon="wallet" title="Aucun paiement enregistré" />
            <ul v-else class="divide-y divide-line"><li v-for="p in payments" :key="p.id" class="flex items-center justify-between gap-3 py-2.5 text-sm"><div><p class="font-medium">{{ p.ref }}</p><p class="text-[13px] text-muted">{{ PAYMENT_METHOD_LABEL[p.method] }} · {{ fdatetime(p.paidAt ?? p.createdAt) }}</p></div><div class="flex items-center gap-2"><span class="tnum font-medium">{{ p.kind === 'refund' ? '−' : '' }}{{ fcfa(p.amount) }}</span><UiStatusBadge kind="paymentTx" :value="p.status" size="sm" /></div></li></ul>
          </UiCard>
          <UiCard title="Historique" icon="history"><UiTimeline :items="[...o.timeline].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Montants" icon="calculator">
            <UiKeyValue :items="[{ label: 'Sous-total', value: fcfa(o.subtotal) }, { label: 'Remises', value: o.discountTotal ? `− ${fcfa(o.discountTotal)}` : '—' }, { label: 'Livraison', value: fcfa(o.deliveryFee) }, { label: `Acompte (${o.depositPct} %)`, value: fcfa(o.depositAmount) }, { label: 'Réglé', value: fcfa(o.amountPaid) }, { label: 'Reste dû', value: fcfa(remaining) }]" />
            <p class="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span class="font-display font-semibold">Total TTC</span><span class="tnum font-display text-2xl font-semibold">{{ fcfa(o.total) }}</span></p>
            <UiProgress class="mt-3" :value="o.amountPaid" :max="o.total" tone="success" label="Part réglée" />
          </UiCard>
          <UiCard title="Livraison" icon="truck">
            <UiKeyValue :items="[{ label: 'Adresse', value: fmtAddress(o.deliveryAddress) }, { label: 'Livraison', value: delivery?.ref ?? 'Non créée' }, { label: 'Prévue le', value: delivery?.plannedDate ? fdate(delivery.plannedDate) : '—' }, { label: 'Lots', value: lots.map((id) => L.lotRef(id)).join(', ') || '—' }]" />
            <div v-if="delivery" class="mt-3 flex items-center justify-between"><UiStatusBadge kind="delivery" :value="delivery.status" size="sm" /><UiButton v-if="deliveryBase" size="sm" variant="ghost" iconRight="arrow-right" :to="`${deliveryBase}/${delivery.id}`">Ouvrir</UiButton></div>
          </UiCard>
          <UiCard v-if="invoice" title="Facture fictive" icon="receipt-text">
            <UiKeyValue :items="[{ label: 'Référence', value: invoice.ref }, { label: 'Montant', value: fcfa(invoice.amount) }, { label: 'Bon de commande', value: o.purchaseOrderRef }]" />
            <div class="mt-3"><UiStatusBadge kind="invoice" :value="invoice.status" size="sm" /></div>
          </UiCard>
          <SiteNotice kind="simulated" dense />
        </aside>
      </div>

      <UiFormDialog v-model:open="payOpen" title="Enregistrer un paiement simulé" description="Aucune transaction réelle : l’enregistrement sert à la démonstration." :fields="payFields" :initial="{ amount: Math.max(0, (o.depositAmount - o.amountPaid) || remaining), method: 'mobile_money' }" submit-label="Enregistrer le paiement" @submit="pay" />
      <UiFormDialog v-model:open="refundOpen" title="Remboursement simulé" :fields="refundFields" :initial="{ amount: o.amountPaid }" submit-label="Rembourser" @submit="refund" />
      <UiFormDialog v-model:open="cancelOpen" title="Annuler la commande" description="Les lots réservés sont rendus au stock vendable." :fields="cancelFields" submit-label="Annuler la commande" @submit="cancel" />
    </template>
  </div>
</template>
