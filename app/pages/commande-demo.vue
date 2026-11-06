<script setup lang="ts">
import type { Order, Payment, PaymentMethod } from '#shared/types/domain'
import { computeTotals, deliveryFeeFor, isOrderable, priceGridFor, unitPriceFor } from '#shared/services/pricing'
import { PAYMENT_METHOD_LABEL } from '#shared/utils/labels'

usePageTitle('Commande de démonstration')
const db = useDb()
const cart = useCart()
const auth = useAuth()
const svc = useServices()
const act = useAction()
const settings = useSettings()

const buyer = computed(() => auth.user.value)
const allowed = computed(() => ['client', 'pro', 'distributor'].includes(auth.role.value))
const company = computed(() => (buyer.value?.companyId ? db.peek('companies', buyer.value.companyId) : undefined))
const grid = computed(() => priceGridFor(db as any, buyer.value?.companyId))

interface Line { productId: string; qty: number; name: string; ref: string; unit: string; unitPrice: number | null; orderable: boolean; zones: string[] }
const lines = computed<Line[]>(() => cart.items.value.map((i) => {
  const p = db.all('products').find((x) => x.id === i.productId && x.published)
  return { productId: i.productId, qty: i.qty, name: p?.name ?? 'Produit indisponible', ref: p?.ref ?? '', unit: p ? unitLabel(p.saleUnit) : '', unitPrice: p ? unitPriceFor(p, grid.value, i.qty) : null, orderable: !!p && isOrderable(p) && unitPriceFor(p, grid.value, i.qty) != null, zones: p?.deliveryZones ?? [] }
}))
const blocked = computed(() => lines.value.filter((l) => !l.orderable))

const step = ref(0)
const steps = ['Récapitulatif', 'Livraison', 'Paiement simulé', 'Confirmation']

const form = reactive({ line: '', city: '', zone: '', po: '', method: 'mobile_money' as PaymentMethod, kind: 'deposit' as 'deposit' | 'full' })
const errors = reactive<Record<string, string>>({})
watch(buyer, (u) => {
  if (!u) return
  form.line ||= u.address?.line ?? company.value?.address.line ?? ''
  form.city ||= u.address?.city ?? company.value?.address.city ?? ''
  form.zone ||= u.address?.zone ?? company.value?.address.zone ?? ''
}, { immediate: true })

const zoneOptions = computed(() => settings.value.zones
  .filter((z) => z.active && lines.value.every((l) => l.zones.includes(z.id)))
  .map((z) => ({ value: z.id, label: `${z.name} — ${fcfa(z.baseFee)}` })))
watch(zoneOptions, (opts) => { if (form.zone && !opts.some((o) => o.value === form.zone)) form.zone = '' })

const totals = computed(() => computeTotals({
  lines: lines.value.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })),
  deliveryFee: form.zone ? deliveryFeeFor(settings.value, form.zone) : 0,
  depositPct: settings.value.defaultDepositPct,
}))
const methodOptions = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))
const payAmount = computed(() => (form.kind === 'full' ? totals.value.total : totals.value.depositAmount))

const order = ref<Order | null>(null)
const payment = ref<Payment | null>(null)
const busy = ref(false)

function next() {
  for (const k of Object.keys(errors)) delete errors[k]
  if (step.value === 0) {
    if (!lines.value.length) return
    if (blocked.value.length) return
  }
  if (step.value === 1) {
    if (!form.line.trim()) errors.line = 'Indiquez l’adresse de livraison.'
    if (!form.city.trim()) errors.city = 'Indiquez la ville.'
    if (!form.zone) errors.zone = 'Choisissez une zone de livraison : elle détermine les frais.'
    if (Object.keys(errors).length) return
  }
  step.value = Math.min(step.value + 1, 3)
}

async function confirmPayment() {
  busy.value = true
  const ok = await act(() => {
    if (!order.value) {
      order.value = svc.orders.createDirect({
        lines: lines.value.map((l) => ({ productId: l.productId, qty: l.qty })),
        deliveryAddress: { line: form.line.trim(), city: form.city.trim(), zone: form.zone, country: 'Bénin' },
        companyId: buyer.value?.companyId,
        purchaseOrderRef: form.po.trim() || undefined,
      })
    }
    const o = order.value
    const amount = form.kind === 'full' ? o.total : o.depositAmount
    payment.value = svc.orders.pay(o.id, { amount, method: form.method, kind: form.kind })
  })
  busy.value = false
  if (ok) {
    cart.clear()
    step.value = 3
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
const finalOrder = computed(() => (order.value ? db.get('orders', order.value.id) ?? order.value : null))
</script>

<template>
  <div>
    <SitePageHero title="Commande de démonstration" intro="Parcours complet de commande avec paiement simulé : aucune transaction réelle, aucune livraison réelle." crumb="Commande">
      <template #aside><SiteNotice kind="simulated" class="max-w-sm" dense /></template>
    </SitePageHero>

    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <UiEmpty v-if="!allowed && step < 3" icon="log-in" title="Connectez-vous pour commander" hint="La commande est réservée aux comptes client, professionnel et distributeur. En mode démonstration, utilisez le sélecteur de comptes sur la page de connexion.">
        <UiButton icon="log-in" to="/connexion?redirect=/commande-demo">Se connecter</UiButton>
        <UiButton variant="outline" icon="file-text" to="/devis">Demander un devis sans compte</UiButton>
      </UiEmpty>

      <UiEmpty v-else-if="!lines.length && step < 3" icon="shopping-basket" title="Aucun produit à commander" hint="Ajoutez à votre liste un produit autorisé à la commercialisation et disposant d’un prix.">
        <UiButton to="/catalogue" icon="layout-grid">Ouvrir le catalogue</UiButton>
      </UiEmpty>

      <template v-else>
        <UiStepper class="mb-8" :steps="steps" :current="step" />

        <div v-if="step < 3" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="min-w-0">
            <!-- 0 : récapitulatif -->
            <UiCard v-if="step === 0" title="Récapitulatif" icon="list-checks">
              <UiAlert v-if="blocked.length" tone="warning" title="Certains produits ne sont pas commandables en ligne" class="mb-4">
                Retirez-les de votre liste ou demandez un devis : {{ blocked.map((l) => l.name).join(', ') }}.
                <div class="mt-2 flex gap-2"><UiButton size="sm" variant="outline" to="/panier" icon="shopping-basket">Modifier ma liste</UiButton><UiButton size="sm" to="/devis" icon="file-text">Demander un devis</UiButton></div>
              </UiAlert>
              <ul class="flex flex-col divide-y divide-line">
                <li v-for="l in lines" :key="l.productId" class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div class="min-w-0"><p class="font-medium">{{ l.name }}</p><p class="tnum text-[13px] text-muted">{{ l.ref }} · {{ num(l.qty) }} {{ l.unit }}</p></div>
                  <p class="tnum shrink-0 font-display font-semibold">{{ l.unitPrice == null ? '—' : fcfa(l.unitPrice * l.qty) }}</p>
                </li>
              </ul>
              <p v-if="grid" class="mt-3 flex items-center gap-2 text-[13px] text-muted"><Icon name="lucide:badge-percent" class="size-4 text-primary" aria-hidden="true" />Grille tarifaire « {{ grid.name }} » appliquée.</p>
            </UiCard>

            <!-- 1 : livraison -->
            <UiCard v-else-if="step === 1" title="Livraison" icon="map-pin">
              <div class="grid gap-4 sm:grid-cols-2">
                <UiField class="sm:col-span-2" label="Adresse de livraison" required :error="errors.line" v-slot="{ id }"><UiInput :id="id" v-model="form.line" autocomplete="street-address" :error="errors.line" /></UiField>
                <UiField label="Ville" required :error="errors.city" v-slot="{ id }"><UiInput :id="id" v-model="form.city" :error="errors.city" /></UiField>
                <UiField label="Zone de livraison" required :error="errors.zone" hint="Seules les zones desservies pour tous vos produits sont proposées." v-slot="{ id }"><UiSelect :id="id" v-model="form.zone" :options="zoneOptions" placeholder="Choisir une zone" :error="errors.zone" /></UiField>
                <UiField v-if="company" class="sm:col-span-2" label="Référence de bon de commande (facultatif)" v-slot="{ id }"><UiInput :id="id" v-model="form.po" placeholder="BC-…" /></UiField>
              </div>
              <div class="mt-4"><SiteNotice kind="leadTime" dense /></div>
            </UiCard>

            <!-- 2 : paiement -->
            <UiCard v-else title="Paiement simulé" icon="wallet">
              <SiteNotice kind="simulated" class="mb-4" />
              <div class="grid gap-5">
                <UiRadioGroup v-model="form.kind" variant="cards" label="Montant à régler" :options="[
                  { value: 'deposit', label: `Acompte (${settings.defaultDepositPct} %)`, hint: fcfa(totals.depositAmount) },
                  { value: 'full', label: 'Paiement intégral', hint: fcfa(totals.total) },
                ] as any" />
                <UiField label="Mode de paiement (simulé)" v-slot="{ id }"><UiSelect :id="id" v-model="form.method" :options="methodOptions" /></UiField>
              </div>
            </UiCard>

            <div class="mt-5 flex items-center justify-between gap-3">
              <UiButton v-if="step > 0" variant="ghost" icon="arrow-left" @click="step--">Retour</UiButton>
              <span v-else />
              <UiButton v-if="step < 2" icon-right="arrow-right" :disabled="step === 0 && !!blocked.length" @click="next">Continuer</UiButton>
              <UiButton v-else variant="accent" icon="circle-check" :loading="busy" @click="confirmPayment">Confirmer le paiement simulé · {{ fcfa(payAmount) }}</UiButton>
            </div>
          </div>

          <aside class="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <UiCard title="Total" icon="calculator">
              <dl class="flex flex-col gap-2 text-sm">
                <div class="flex justify-between"><dt class="text-muted">Sous-total</dt><dd class="tnum">{{ fcfa(totals.subtotal) }}</dd></div>
                <div class="flex justify-between"><dt class="text-muted">Livraison</dt><dd class="tnum">{{ form.zone ? fcfa(totals.deliveryFee) : 'À choisir' }}</dd></div>
                <div class="flex justify-between border-t border-line pt-2 text-base"><dt class="font-medium">Total</dt><dd class="tnum font-display font-semibold">{{ fcfa(totals.total) }}</dd></div>
                <div class="flex justify-between"><dt class="text-muted">Acompte ({{ settings.defaultDepositPct }} %)</dt><dd class="tnum">{{ fcfa(totals.depositAmount) }}</dd></div>
              </dl>
            </UiCard>
            <SiteNotice kind="demo" dense />
          </aside>
        </div>

        <!-- 3 : confirmation -->
        <div v-else-if="finalOrder && payment" class="flex flex-col gap-6">
          <UiAlert tone="success" icon="circle-check" title="Commande enregistrée — paiement simulé">
            La commande <strong class="tnum">{{ finalOrder.ref }}</strong> est créée et le paiement <strong class="tnum">{{ payment.ref }}</strong> de {{ fcfa(payment.amount) }} est enregistré. Aucune somme n’a été prélevée.
          </UiAlert>
          <UiCard title="Suite du parcours" icon="route">
            <div class="mb-4 flex flex-wrap gap-2"><UiStatusBadge kind="order" :value="finalOrder.status" /><UiStatusBadge kind="payment" :value="finalOrder.paymentStatus" /></div>
            <UiStepper :steps="['Commande confirmée', 'Préparation', 'Expédition', 'Livraison + preuve']" :current="finalOrder.status === 'confirmed' ? 0 : 0" />
            <p class="mt-5 text-sm text-muted">L’équipe commerciale envoie la commande en préparation ; seuls des lots libérés par le contrôle qualité peuvent être réservés. Vous suivez chaque étape dans votre espace.</p>
            <div class="mt-5 flex flex-wrap gap-2">
              <UiButton icon="package" :to="`/espace/commandes/${finalOrder.id}`">Suivre ma commande</UiButton>
              <UiButton variant="outline" icon="layout-grid" to="/catalogue">Retour au catalogue</UiButton>
            </div>
          </UiCard>
        </div>
      </template>
    </div>
  </div>
</template>
