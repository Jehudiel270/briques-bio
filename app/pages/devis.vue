<script setup lang="ts">
import type { Quote } from '#shared/types/domain'
import { canRequestQuote } from '#shared/services/pricing'

usePageTitle('Demander un devis')
const db = useDb()
const cart = useCart()
const auth = useAuth()
const svc = useServices()
const act = useAction()
const settings = useSettings()

const isClient = computed(() => ['client', 'pro', 'distributor'].includes(auth.role.value))
const user = computed(() => auth.user.value)
const company = computed(() => (user.value?.companyId ? db.peek('companies', user.value.companyId) : undefined))

const form = reactive({ name: '', email: '', phone: '', line: '', city: '', zone: '', notes: '', consent: false })
const errors = reactive<Record<string, string>>({})
const sending = ref(false)
const done = ref<Quote | null>(null)

// pré-remplissage depuis le compte connecté
watch(user, (u) => {
  if (!u) return
  form.name ||= u.name
  form.email ||= u.email
  form.phone ||= u.phone ?? ''
  form.line ||= u.address?.line ?? company.value?.address.line ?? ''
  form.city ||= u.address?.city ?? company.value?.address.city ?? ''
  form.zone ||= u.address?.zone ?? company.value?.address.zone ?? ''
}, { immediate: true })

const zoneOptions = computed(() => [{ value: '', label: 'Je ne sais pas' }, ...settings.value.zones.filter((z) => z.active).map((z) => ({ value: z.id, label: z.name }))])
const products = computed(() => db.all('products').filter((p) => p.published))
const lines = computed(() => cart.items.value.map((i) => ({ ...i, product: products.value.find((p) => p.id === i.productId) })))
const addable = computed(() => products.value.filter((p) => canRequestQuote(p) && !cart.has(p.id)).map((p) => ({ value: p.id, label: `${p.name} (${p.ref})` })))
const pick = ref('')
watch(pick, (v) => {
  if (!v) return
  const p = products.value.find((x) => x.id === v)
  if (p) cart.add(p.id, p.minOrderQty || 1)
  pick.value = ''
})
const unavailable = computed(() => lines.value.filter((l) => !l.product || !canRequestQuote(l.product)))

const drafts = reactive<Record<string, string>>({})
const keyOf = (l: { productId: string; finish?: string; color?: string }) => `${l.productId}|${l.finish ?? ''}|${l.color ?? ''}`
function commit(l: (typeof lines.value)[number]) {
  const raw = drafts[keyOf(l)]
  delete drafts[keyOf(l)]
  const n = Math.floor(Number(raw))
  if (raw !== undefined && Number.isFinite(n) && n >= 1) cart.setQty(l.productId, n, { finish: l.finish, color: l.color })
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function validate() {
  for (const k of Object.keys(errors)) delete errors[k]
  if (!form.name.trim()) errors.name = 'Indiquez votre nom.'
  if (!EMAIL.test(form.email.trim())) errors.email = 'Saisissez une adresse e-mail valide, par exemple nom@entreprise.com.'
  if (form.phone.trim() && !/^[+()\d\s.-]{6,20}$/.test(form.phone.trim())) errors.phone = 'Numéro invalide : utilisez des chiffres, des espaces ou un « + » initial.'
  if (!form.line.trim()) errors.line = 'Indiquez l’adresse ou le lieu de livraison.'
  if (!form.city.trim()) errors.city = 'Indiquez la ville de livraison.'
  if (!lines.value.length) errors.lines = 'Ajoutez au moins un produit à votre demande.'
  else if (unavailable.value.length) errors.lines = 'Retirez les produits indisponibles ou en développement.'
  if (!form.consent) errors.consent = 'Acceptez que nous utilisions ces informations pour répondre à votre demande.'
  return Object.keys(errors).length === 0
}

async function submit() {
  if (!validate()) return
  sending.value = true
  let created: Quote | null = null
  const ok = await act(() => {
    created = svc.quotes.request({
      contact: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined },
      deliveryAddress: { line: form.line.trim(), city: form.city.trim(), zone: form.zone || undefined, country: 'Bénin' },
      lines: lines.value.map((l) => ({ productId: l.productId, qty: l.qty })),
      customerNotes: [form.notes.trim(), ...lines.value.filter((l) => l.finish || l.color).map((l) => `${l.product?.ref} : ${[l.finish, l.color].filter(Boolean).join(', ')}`)].filter(Boolean).join('\n') || undefined,
      companyId: user.value?.companyId,
    })
  })
  sending.value = false
  if (ok && created) {
    done.value = created
    cart.clear()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div>
    <SitePageHero title="Demander un devis" intro="Indiquez les produits, les quantités et le lieu de livraison. Notre équipe commerciale chiffre la demande et vous répond ; rien ne vous engage à ce stade." crumb="Devis" />

    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <!-- confirmation -->
      <div v-if="done" class="flex flex-col gap-6">
        <UiAlert tone="success" icon="circle-check" title="Demande envoyée">
          Votre demande <strong class="tnum">{{ done.ref }}</strong> est enregistrée. Notre équipe commerciale la prend en charge et vous répondra à {{ done.contact.email }}.
        </UiAlert>
        <UiCard title="Et maintenant ?" icon="route">
          <UiStepper :steps="['Demande reçue', 'Chiffrage', 'Devis envoyé', 'Acceptation (simulée)']" :current="0" />
          <ul class="mt-6 flex flex-col gap-2 text-sm text-muted">
            <li class="flex items-start gap-2"><Icon name="lucide:calculator" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Le commercial fixe les prix, la livraison et l’acompte pour chaque ligne.</li>
            <li class="flex items-start gap-2"><Icon name="lucide:clock" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Le délai de réponse est donné à titre indicatif et reste à confirmer.</li>
            <li class="flex items-start gap-2"><Icon name="lucide:wallet" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />L’acceptation et le paiement sont simulés : aucune transaction réelle.</li>
          </ul>
          <div class="mt-5 flex flex-wrap gap-2">
            <UiButton v-if="isClient" icon="file-text" :to="`/espace/devis/${done.id}`">Suivre ce devis</UiButton>
            <UiButton v-else icon="log-in" :to="'/connexion?redirect=/espace/devis'">Se connecter pour suivre mes devis</UiButton>
            <UiButton variant="outline" icon="layout-grid" to="/catalogue">Retour au catalogue</UiButton>
          </div>
        </UiCard>
        <SiteNotice kind="demo" />
      </div>

      <form v-else class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]" novalidate @submit.prevent="submit">
        <div class="flex min-w-0 flex-col gap-6">
          <UiCard title="Produits demandés" icon="package" :description="`${lines.length} ligne${lines.length > 1 ? 's' : ''}`">
            <UiAlert v-if="errors.lines" tone="danger" dense class="mb-3">{{ errors.lines }}</UiAlert>
            <UiEmpty v-if="!lines.length" compact icon="shopping-basket" title="Aucun produit sélectionné" hint="Choisissez un produit ci-dessous ou parcourez le catalogue." />
            <ul v-else class="flex flex-col divide-y divide-line">
              <li v-for="l in lines" :key="keyOf(l)" class="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div class="paver-bg w-16 shrink-0 overflow-hidden rounded-md border border-line">
                  <UiImage v-if="l.product" :media="l.product.photos[0]" :product="l.product" ratio="4/3" :width="160" :rounded="false" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ l.product?.name ?? 'Produit indisponible' }}</p>
                  <p class="text-[13px] text-muted">
                    <span class="tnum">{{ l.product?.ref }}</span><span v-if="l.finish || l.color"> · {{ [l.finish, l.color].filter(Boolean).join(' · ') }}</span>
                  </p>
                  <p v-if="l.product && !canRequestQuote(l.product)" class="mt-1 text-[13px] text-danger">Produit en développement : à retirer de la demande.</p>
                </div>
                <div class="w-28">
                  <UiInput :model-value="drafts[keyOf(l)] ?? String(l.qty)" type="number" inputmode="numeric" :suffix="l.product ? unitLabel(l.product.saleUnit) : ''" aria-label="Quantité" @update:model-value="(v) => (drafts[keyOf(l)] = String(v ?? ''))" @blur="commit(l)" @enter="commit(l)" />
                </div>
                <UiButton size="sm" variant="ghost" icon="trash-2" icon-only aria-label="Retirer ce produit" @click="cart.remove(l.productId, { finish: l.finish ?? '', color: l.color ?? '' })" />
              </li>
            </ul>
            <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <div class="w-72 max-w-full"><UiSelect v-model="pick" :options="addable" placeholder="Ajouter un produit…" searchable aria-label="Ajouter un produit" /></div>
              <UiButton variant="ghost" icon="layout-grid" to="/catalogue" size="sm">Parcourir le catalogue</UiButton>
            </div>
          </UiCard>

          <UiCard title="Vos coordonnées" icon="contact-round">
            <div class="grid gap-4 sm:grid-cols-2">
              <UiField label="Nom et prénom" required :error="errors.name" v-slot="{ id }"><UiInput :id="id" v-model="form.name" autocomplete="name" :error="errors.name" /></UiField>
              <UiField label="Adresse e-mail" required :error="errors.email" v-slot="{ id }"><UiInput :id="id" v-model="form.email" type="email" autocomplete="email" :error="errors.email" /></UiField>
              <UiField label="Téléphone (WhatsApp possible)" :error="errors.phone" v-slot="{ id }"><UiInput :id="id" v-model="form.phone" type="tel" autocomplete="tel" placeholder="+229 …" :error="errors.phone" /></UiField>
              <UiField v-if="company" label="Entreprise" v-slot="{ id }"><UiInput :id="id" :model-value="company.name" readonly /></UiField>
            </div>
          </UiCard>

          <UiCard title="Livraison" icon="map-pin">
            <div class="grid gap-4 sm:grid-cols-2">
              <UiField class="sm:col-span-2" label="Adresse ou lieu de chantier" required :error="errors.line" v-slot="{ id }"><UiInput :id="id" v-model="form.line" autocomplete="street-address" :error="errors.line" /></UiField>
              <UiField label="Ville" required :error="errors.city" v-slot="{ id }"><UiInput :id="id" v-model="form.city" autocomplete="address-level2" :error="errors.city" /></UiField>
              <UiField label="Zone de livraison" hint="Sert à estimer les frais ; le devis les confirme." v-slot="{ id }"><UiSelect :id="id" v-model="form.zone" :options="zoneOptions" /></UiField>
              <UiField class="sm:col-span-2" label="Précisions (usage, calendrier, accès au site)" v-slot="{ id }"><UiTextarea :id="id" v-model="form.notes" :rows="4" :maxlength="1200" /></UiField>
            </div>
          </UiCard>

          <div>
            <UiCheckbox v-model="form.consent" label="J’accepte que ces informations soient utilisées pour traiter ma demande de devis (voir la politique de confidentialité)." />
            <p v-if="errors.consent" class="mt-1.5 text-[13px] text-danger" role="alert">{{ errors.consent }}</p>
          </div>
        </div>

        <aside class="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <UiCard title="Avant d’envoyer" icon="info">
            <ul class="flex flex-col gap-2.5 text-sm text-muted">
              <li class="flex items-start gap-2"><Icon name="lucide:file-text" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Un devis n’est pas une commande : vous décidez ensuite.</li>
              <li class="flex items-start gap-2"><Icon name="lucide:badge-percent" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Les remises de volume sont étudiées ligne par ligne.</li>
              <li class="flex items-start gap-2"><Icon name="lucide:clock" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />Délai de réponse et de livraison à confirmer.</li>
            </ul>
            <UiButton class="mt-5" block type="submit" icon="send" :loading="sending">Envoyer la demande</UiButton>
          </UiCard>
          <SiteNotice kind="demo" dense />
          <SiteNotice kind="technical" dense />
        </aside>
      </form>
    </div>
  </div>
</template>
