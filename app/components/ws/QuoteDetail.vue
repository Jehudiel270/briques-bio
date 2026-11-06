<script setup lang="ts">
import { computeTotals, deliveryFeeFor, priceGridFor, unitPriceFor } from '#shared/services/pricing'
import { daysUntil, fcfa, fdate, fdatetime, fmtAddress, unitLabel } from '#shared/utils/format'
import type { FieldDef } from '~/utils/forms'

/** Détail d'un devis côté équipe : prise en charge, chiffrage, envoi, négociation, acceptation / refus pour le client. */
const props = defineProps<{ id: string; back: string }>()
const db = useDb()
const svc = useServices()
const act = useAction()
const confirm = useConfirm()
const settings = useSettings()
const L = useLookups()

const q = computed(() => db.get('quotes', props.id))
usePageTitle(q.value ? `Devis ${q.value.ref}` : 'Devis')

interface Draft { id?: string; productId: string; label: string; qty: number; unitPrice: number | null; discountPct: number; suggested: number | null }
const draft = reactive<{ lines: Draft[]; discountPct: number; deliveryFee: number; depositPct: number; validUntil: string; internalNotes: string }>({ lines: [], discountPct: 0, deliveryFee: 0, depositPct: 30, validUntil: '', internalNotes: '' })
const seededFor = ref('')
const editable = computed(() => !!q.value && ['requested', 'in_review', 'sent'].includes(q.value.status))

function seed() {
  const quote = q.value
  if (!quote || seededFor.value === `${quote.id}:${quote.updatedAt}`) return
  seededFor.value = `${quote.id}:${quote.updatedAt}`
  const grid = priceGridFor(db as any, quote.companyId)
  draft.lines = quote.lines.map((l) => {
    const product = db.peek('products', l.productId)
    const suggested = product ? unitPriceFor(product, grid, l.qty) : null
    return { id: l.id, productId: l.productId, label: l.label, qty: l.qty, unitPrice: l.unitPrice ?? suggested, discountPct: l.discountPct ?? 0, suggested }
  })
  draft.discountPct = quote.discountPct ?? 0
  draft.depositPct = quote.depositPct || settings.value.defaultDepositPct
  draft.deliveryFee = quote.deliveryFee || deliveryFeeFor(settings.value, quote.deliveryAddress.zone)
  draft.validUntil = (quote.validUntil ? new Date(quote.validUntil) : new Date(Date.now() + settings.value.quoteValidityDays * 86_400_000)).toISOString().slice(0, 10)
  draft.internalNotes = quote.internalNotes ?? ''
}
watch(q, seed, { immediate: true })

const totals = computed(() => computeTotals({ lines: draft.lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct })), discountPct: draft.discountPct, deliveryFee: draft.deliveryFee, depositPct: draft.depositPct, vatRatePct: settings.value.vatRatePct }))
const complete = computed(() => draft.lines.every((l) => l.unitPrice != null && l.unitPrice >= 0))

const sending = ref(false)
async function take() { await act(() => svc.quotes.take(props.id), 'Devis pris en charge.') }
async function send() {
  sending.value = true
  await act(() => svc.quotes.send(props.id, {
    lines: draft.lines.map((l) => ({ id: l.id, productId: l.productId, qty: l.qty, unitPrice: Number(l.unitPrice), discountPct: l.discountPct || undefined })),
    discountPct: Number(draft.discountPct) || 0, deliveryFee: Number(draft.deliveryFee) || 0, depositPct: Number(draft.depositPct) || 0,
    validUntil: new Date(`${draft.validUntil}T23:59:59`).toISOString(), internalNotes: draft.internalNotes,
  }), q.value?.status === 'sent' ? 'Devis révisé et renvoyé au client.' : 'Devis envoyé au client.')
  sending.value = false
}
async function recordAccept() {
  if (!(await confirm({ title: 'Enregistrer l’acceptation du client ?', message: 'Une commande et une facture fictive seront créées.', confirmLabel: 'Créer la commande' }))) return
  let orderId = ''
  if (await act(() => { orderId = svc.quotes.accept(props.id).id }, 'Commande créée.')) await navigateTo(`${props.back.replace(/devis.*$/, 'commandes')}/${orderId}`)
}
const declineOpen = ref(false)
const msgOpen = ref(false)
const declineFields: FieldDef[] = [{ key: 'reason', label: 'Motif', type: 'textarea', required: true, span: 2, rows: 3 }]
const msgFields: FieldDef[] = [{ key: 'body', label: 'Message au client', type: 'textarea', required: true, span: 2, rows: 4 }]
const decline = (v: Record<string, any>) => svc.quotes.decline(props.id, String(v.reason))
const message = (v: Record<string, any>) => svc.quotes.negotiate(props.id, String(v.body))
const expired = computed(() => q.value?.status === 'sent' && (daysUntil(q.value.validUntil) ?? 1) < 0)
</script>

<template>
  <div>
    <UiEmpty v-if="!q" icon="file-question" title="Devis introuvable"><UiButton icon="arrow-left" :to="back">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Devis ${q.ref}`" :back="back" icon="file-text" :description="`${q.companyId ? L.companyName(q.companyId) : q.contact.name} · demandé le ${fdate(q.createdAt)}`">
        <template #meta><UiStatusBadge kind="quote" :value="q.status" /><UiBadge v-if="expired" tone="danger" icon="hourglass">Offre expirée</UiBadge><UiBadge v-if="q.assignedTo" tone="neutral" icon="user-round">{{ L.userName(q.assignedTo) }}</UiBadge><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="q.status === 'requested'" icon="hand" @click="take">Prendre en charge</UiButton>
          <UiButton v-if="editable" variant="outline" icon="message-square-plus" @click="msgOpen = true">Écrire au client</UiButton>
          <UiButton v-if="q.status === 'sent'" variant="outline" icon="check-check" @click="recordAccept">Acceptation du client</UiButton>
          <UiButton v-if="editable" variant="outline" icon="x" @click="declineOpen = true">Clore sans suite</UiButton>
          <UiButton v-if="q.orderId" icon="package" :to="`${back.replace(/devis.*$/, 'commandes')}/${q.orderId}`">Voir la commande</UiButton>
        </template>
      </UiPageHeader>

      <UiAlert v-if="q.customerNotes" tone="info" icon="message-square-text" title="Remarques du client" class="mb-5">{{ q.customerNotes }}</UiAlert>

      <div class="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard :title="editable ? 'Chiffrage' : 'Lignes du devis'" icon="calculator" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[40rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Produit</th><th class="px-3 py-2.5 text-right font-medium">Quantité</th><th class="px-3 py-2.5 text-right font-medium">Prix unitaire</th><th class="px-3 py-2.5 text-right font-medium">Remise %</th><th class="px-4 py-2.5 text-right font-medium">Montant</th></tr></thead>
                <tbody>
                  <tr v-for="(l, i) in (editable ? draft.lines : q.lines.map((x) => ({ ...x, discountPct: x.discountPct ?? 0, suggested: null })))" :key="l.productId + i" class="border-b border-line/70 align-top last:border-0">
                    <td class="px-4 py-3 font-medium">{{ l.label }}<p class="text-[12px] font-normal text-muted">{{ L.productRef(l.productId) }}</p></td>
                    <td class="tnum px-3 py-3 text-right">{{ l.qty }} {{ unitLabel(db.peek('products', l.productId)?.saleUnit ?? 'piece') }}</td>
                    <td class="px-3 py-2 text-right">
                      <template v-if="editable"><UiInput v-model.number="draft.lines[i]!.unitPrice" type="number" min="0" class="ml-auto w-32" :aria-label="`Prix unitaire de ${l.label}`" suffix="FCFA" /><button v-if="draft.lines[i]!.suggested != null && draft.lines[i]!.suggested !== draft.lines[i]!.unitPrice" type="button" class="mt-1 text-[12px] text-primary hover:underline" @click="draft.lines[i]!.unitPrice = draft.lines[i]!.suggested">Appliquer {{ fcfa(draft.lines[i]!.suggested) }}</button></template>
                      <span v-else class="tnum">{{ l.unitPrice != null ? fcfa(l.unitPrice) : '—' }}</span>
                    </td>
                    <td class="px-3 py-2 text-right"><UiInput v-if="editable" v-model.number="draft.lines[i]!.discountPct" type="number" min="0" max="100" class="ml-auto w-20" :aria-label="`Remise de ${l.label}`" /><span v-else class="tnum">{{ l.discountPct || '—' }}</span></td>
                    <td class="tnum px-4 py-3 text-right font-medium">{{ l.unitPrice != null ? fcfa(Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100))) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard v-if="editable" title="Conditions" icon="sliders-horizontal">
            <div class="grid gap-4 sm:grid-cols-2">
              <UiField label="Remise globale (%)" #default="{ id }"><UiInput :id="id" v-model.number="draft.discountPct" type="number" min="0" max="100" /></UiField>
              <UiField label="Frais de livraison (FCFA)" #default="{ id }"><UiInput :id="id" v-model.number="draft.deliveryFee" type="number" min="0" /></UiField>
              <UiField label="Acompte (%)" #default="{ id }"><UiInput :id="id" v-model.number="draft.depositPct" type="number" min="0" max="100" /></UiField>
              <UiField label="Valable jusqu’au" #default="{ id }"><UiInput :id="id" v-model="draft.validUntil" type="date" /></UiField>
              <UiField class="sm:col-span-2" label="Notes internes (non visibles du client)" #default="{ id }"><UiTextarea :id="id" v-model="draft.internalNotes" :rows="2" /></UiField>
            </div>
          </UiCard>

          <UiCard title="Échanges avec le client" icon="messages-square">
            <UiEmpty v-if="!q.negotiation.length" compact icon="message-square" title="Aucun message" />
            <ul v-else class="space-y-3"><li v-for="m in q.negotiation" :key="m.id" class="rounded-lg bg-surface-2 p-3"><p class="text-[13px] text-muted"><span class="font-medium text-ink">{{ m.userName }}</span> · {{ fdatetime(m.at) }}</p><p class="mt-1 whitespace-pre-line text-sm">{{ m.body }}</p></li></ul>
          </UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Totaux" icon="receipt">
            <UiKeyValue :items="[
              { label: 'Sous-total', value: fcfa(totals.subtotal) }, { label: 'Remises', value: totals.discountTotal ? `− ${fcfa(totals.discountTotal)}` : '—' },
              { label: 'Livraison', value: fcfa(totals.deliveryFee) }, { label: `dont TVA ${settings.vatRatePct} %`, value: fcfa(totals.vatIncluded ?? 0) },
              { label: `Acompte (${editable ? draft.depositPct : q.depositPct} %)`, value: fcfa(totals.depositAmount) },
            ]" />
            <p class="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span class="font-display font-semibold">Total TTC</span><span class="tnum font-display text-2xl font-semibold">{{ fcfa(totals.total) }}</span></p>
            <UiButton v-if="editable" class="mt-4" block icon="send" :loading="sending" :disabled="!complete" @click="send">{{ q.status === 'sent' ? 'Renvoyer le devis révisé' : 'Envoyer le devis' }}</UiButton>
            <p v-if="editable && !complete" class="mt-2 text-[12px] text-warning">Renseignez le prix de chaque ligne pour envoyer le devis.</p>
          </UiCard>
          <UiCard title="Client" icon="user-round">
            <UiKeyValue :items="[{ label: 'Contact', value: q.contact.name }, { label: 'E-mail', value: q.contact.email }, { label: 'Téléphone', value: q.contact.phone }, { label: 'Livraison', value: fmtAddress(q.deliveryAddress) }, { label: 'Entreprise', value: q.companyId ? L.companyName(q.companyId) : '—' }]" />
          </UiCard>
          <UiCard title="Historique" icon="history"><UiTimeline :items="[...q.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="declineOpen" title="Clore le devis sans suite" :fields="declineFields" submit-label="Clore le devis" @submit="decline" />
      <UiFormDialog v-model:open="msgOpen" title="Écrire au client" :fields="msgFields" submit-label="Envoyer" @submit="message" />
    </template>
  </div>
</template>
