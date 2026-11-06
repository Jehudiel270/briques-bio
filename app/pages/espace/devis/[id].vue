<script setup lang="ts">
import { computeTotals } from '#shared/services/pricing'
import { daysUntil, fcfa, fdate, fdatetime, fmtAddress, unitLabel } from '#shared/utils/format'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const db = useDb()
const svc = useServices()
const act = useAction()
const confirm = useConfirm()
const settings = useSettings()
const L = useLookups()

const q = computed(() => db.get('quotes', String(route.params.id)))
usePageTitle(q.value ? `Devis ${q.value.ref}` : 'Devis')

const priced = computed(() => !!q.value?.lines.length && q.value.lines.every((l) => l.unitPrice != null))
const totals = computed(() => (q.value ? computeTotals({ lines: q.value.lines, discountPct: q.value.discountPct, deliveryFee: q.value.deliveryFee, depositPct: q.value.depositPct, vatRatePct: settings.value.vatRatePct }) : null))
const daysLeft = computed(() => daysUntil(q.value?.validUntil))
const expired = computed(() => q.value?.status === 'sent' && daysLeft.value != null && daysLeft.value < 0)
const canAnswer = computed(() => q.value?.status === 'sent' && !expired.value)
const canTalk = computed(() => !!q.value && ['requested', 'in_review', 'sent'].includes(q.value.status))

const declineOpen = ref(false)
const messageOpen = ref(false)
const declineFields: FieldDef[] = [{ key: 'reason', label: 'Motif du refus', type: 'textarea', required: true, span: 2, rows: 3, hint: 'Cela aide l’équipe commerciale à améliorer son offre.' }]
const messageFields: FieldDef[] = [{ key: 'body', label: 'Votre message', type: 'textarea', required: true, span: 2, rows: 4, placeholder: 'Quantités, délais, remise, adresse de livraison…' }]

const accepting = ref(false)
async function accept() {
  if (!q.value) return
  const ok = await confirm({ title: 'Accepter ce devis ?', message: `Une commande de ${fcfa(totals.value?.total ?? 0)} sera créée, avec une facture fictive. Le paiement reste simulé.`, confirmLabel: 'Accepter le devis' })
  if (!ok) return
  accepting.value = true
  let orderId: string | undefined
  const done = await act(() => { orderId = svc.quotes.accept(q.value!.id).id }, 'Devis accepté : votre commande est créée.')
  accepting.value = false
  if (done && orderId) await navigateTo(`/espace/commandes/${orderId}`)
}
const decline = (v: Record<string, any>) => svc.quotes.decline(q.value!.id, String(v.reason))
const send = (v: Record<string, any>) => svc.quotes.negotiate(q.value!.id, String(v.body))
</script>

<template>
  <div>
    <UiEmpty v-if="!q" icon="file-question" title="Devis introuvable" hint="Il n’existe pas ou n’est pas rattaché à votre compte.">
      <UiButton icon="arrow-left" to="/espace/devis">Retour aux devis</UiButton>
    </UiEmpty>

    <template v-else>
      <UiPageHeader :title="`Devis ${q.ref}`" back="/espace/devis" icon="file-text" :description="`Demandé le ${fdate(q.createdAt)}`">
        <template #meta>
          <UiStatusBadge kind="quote" :value="q.status" />
          <UiBadge v-if="q.validUntil && q.status === 'sent'" :tone="expired ? 'danger' : 'neutral'" icon="hourglass">{{ expired ? 'Offre expirée' : `Valable jusqu’au ${fdate(q.validUntil)}` }}</UiBadge>
          <UiDemoBadge />
        </template>
        <template #actions>
          <UiButton v-if="canTalk" variant="outline" icon="message-square-plus" @click="messageOpen = true">Écrire à l’équipe</UiButton>
          <UiButton v-if="canAnswer" variant="outline" icon="x" @click="declineOpen = true">Refuser</UiButton>
          <UiButton v-if="canAnswer" icon="check" :loading="accepting" @click="accept">Accepter le devis</UiButton>
          <UiButton v-if="q.orderId" icon="package" :to="`/espace/commandes/${q.orderId}`">Voir la commande</UiButton>
        </template>
      </UiPageHeader>

      <UiAlert v-if="q.status === 'declined' && q.declineReason" tone="neutral" icon="x-circle" title="Devis refusé" class="mb-5">Motif : {{ q.declineReason }}</UiAlert>
      <UiAlert v-if="expired" tone="warning" icon="hourglass" title="Cette offre a expiré" class="mb-5">Écrivez à l’équipe pour obtenir une nouvelle validité.</UiAlert>
      <UiAlert v-if="q.status === 'requested' || q.status === 'in_review'" tone="info" icon="calculator" title="Chiffrage en cours" class="mb-5">L’équipe commerciale prépare votre offre. Vous serez notifié dès son envoi.</UiAlert>

      <div class="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Produits" icon="boxes" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[34rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Produit</th><th class="px-3 py-2.5 text-right font-medium">Quantité</th><th class="px-3 py-2.5 text-right font-medium">Prix unitaire</th><th class="px-4 py-2.5 text-right font-medium">Montant</th></tr></thead>
                <tbody>
                  <tr v-for="l in q.lines" :key="l.id" class="border-b border-line/70 last:border-0">
                    <td class="px-4 py-3"><NuxtLink :to="`/catalogue/${L.peek('products', l.productId)?.slug ?? ''}`" class="font-medium hover:underline">{{ l.label }}</NuxtLink><p v-if="l.discountPct" class="text-[12px] text-muted">Remise ligne {{ l.discountPct }} %</p></td>
                    <td class="tnum px-3 py-3 text-right">{{ l.qty }} {{ unitLabel(l.unit) }}</td>
                    <td class="tnum px-3 py-3 text-right">{{ l.unitPrice != null ? fcfa(l.unitPrice) : 'À chiffrer' }}</td>
                    <td class="tnum px-4 py-3 text-right font-medium">{{ l.unitPrice != null ? fcfa(Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100))) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard title="Échanges avec l’équipe" icon="messages-square">
            <UiEmpty v-if="!q.negotiation.length" compact icon="message-square" title="Aucun message" hint="Posez une question ou demandez un ajustement.">
              <UiButton v-if="canTalk" size="sm" variant="outline" icon="message-square-plus" @click="messageOpen = true">Écrire à l’équipe</UiButton>
            </UiEmpty>
            <ul v-else class="space-y-4">
              <li v-for="m in q.negotiation" :key="m.id" class="rounded-lg bg-surface-2 p-3">
                <p class="text-[13px] text-muted"><span class="font-medium text-ink">{{ m.userName }}</span> · {{ fdatetime(m.at) }}</p>
                <p class="mt-1 whitespace-pre-line text-sm">{{ m.body }}</p>
              </li>
            </ul>
          </UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Montants" icon="calculator">
            <UiAlert v-if="!priced" tone="neutral" icon="info" dense>Les prix seront renseignés par l’équipe commerciale.</UiAlert>
            <UiKeyValue v-else-if="totals" :items="[
              { label: 'Sous-total', value: fcfa(totals.subtotal) },
              { label: 'Remises', value: totals.discountTotal ? `− ${fcfa(totals.discountTotal)}` : '—' },
              { label: 'Livraison', value: fcfa(totals.deliveryFee) },
              { label: `dont TVA ${settings.vatRatePct} %`, value: fcfa(totals.vatIncluded ?? 0) },
              { label: `Acompte (${q.depositPct} %)`, value: fcfa(totals.depositAmount) },
            ]" />
            <p v-if="priced && totals" class="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span class="font-display font-semibold">Total TTC</span><span class="tnum font-display text-2xl font-semibold">{{ fcfa(totals.total) }}</span></p>
          </UiCard>
          <UiCard title="Livraison et contact" icon="map-pin">
            <UiKeyValue :items="[
              { label: 'Adresse', value: fmtAddress(q.deliveryAddress) },
              { label: 'Contact', value: q.contact.name },
              { label: 'E-mail', value: q.contact.email },
              { label: 'Téléphone', value: q.contact.phone },
            ]" />
          </UiCard>
          <UiCard title="Historique" icon="history">
            <UiTimeline :items="[...q.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." />
          </UiCard>
          <SiteNotice kind="leadTime" dense />
        </aside>
      </div>

      <UiFormDialog v-model:open="declineOpen" title="Refuser ce devis" :fields="declineFields" submit-label="Refuser le devis" @submit="decline" />
      <UiFormDialog v-model:open="messageOpen" title="Écrire à l’équipe commerciale" :fields="messageFields" submit-label="Envoyer le message" @submit="send" />
    </template>
  </div>
</template>
