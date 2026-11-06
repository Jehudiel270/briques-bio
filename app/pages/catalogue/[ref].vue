<script setup lang="ts">
import { canRequestQuote, isOrderable } from '#shared/services/pricing'
import { DOC_KIND_LABEL, PATTERN_LABEL } from '#shared/utils/labels'

const route = useRoute()
const db = useDb()
const cart = useCart()
const compare = useCompare()
const favorites = useFavorites()
const toast = useToast()
const auth = useAuth()

const key = computed(() => String(route.params.ref ?? ''))
const product = computed(() => db.all('products').find((p) => p.published && (p.slug === key.value || p.ref === key.value || p.id === key.value)))
usePageTitle(() => product.value?.name ?? 'Produit')

const category = computed(() => (product.value ? db.peek('categories', product.value.categoryId) : undefined))
const documents = computed(() => {
  const p = product.value
  if (!p) return []
  return db.all('documents').filter((d) => (d.productId === p.id || p.documentIds.includes(d.id)) && d.status === 'published' && d.visibility !== 'internal')
})
const related = computed(() => db.all('products').filter((p) => p.published && product.value && p.id !== product.value.id && p.categoryId === product.value.categoryId).slice(0, 4))

const qty = ref<number | string>(1)
const finish = ref('')
const color = ref('')
watch(product, (p) => {
  if (!p) return
  qty.value = p.minOrderQty || 1
  finish.value = p.finishes[0] ?? ''
  color.value = p.colors[0]?.name ?? ''
}, { immediate: true })

const qtyNum = computed(() => Math.max(1, Math.floor(Number(qty.value) || 0)))
const belowMin = computed(() => !!product.value && qtyNum.value < product.value.minOrderQty)
const unit = computed(() => (product.value ? unitLabel(product.value.saleUnit) : ''))
const lineTotal = computed(() => (product.value?.priceIndicative != null ? product.value.priceIndicative * qtyNum.value : null))
const quotable = computed(() => !!product.value && canRequestQuote(product.value))
const orderable = computed(() => !!product.value && isOrderable(product.value) && product.value.priceIndicative != null)

const tab = ref('specs')
const tabs = computed(() => [
  { value: 'specs', label: 'Caractéristiques', icon: 'ruler' },
  { value: 'uses', label: 'Usages et limites', icon: 'shield-alert' },
  { value: 'docs', label: 'Documents', icon: 'folder-open', count: documents.value.length },
])

function addToList(goToList = false) {
  const p = product.value
  if (!p) return
  cart.add(p.id, qtyNum.value, { finish: finish.value || undefined, color: color.value || undefined })
  toast.success(`« ${p.name} » ajouté à votre liste.`)
  if (goToList) navigateTo('/panier')
}
function orderNow() {
  const p = product.value
  if (!p) return
  cart.add(p.id, qtyNum.value, { finish: finish.value || undefined, color: color.value || undefined })
  navigateTo('/commande-demo')
}
function toggleFavorite() {
  const p = product.value
  if (!p) return
  const res = favorites.toggle(p.id, `/catalogue/${key.value}`)
  if (res === true) toast.success('Ajouté à vos favoris.')
  else if (res === false) toast.info('Retiré de vos favoris.')
}
function toggleCompare() {
  const p = product.value
  if (p && !compare.toggle(p.id)) toast.warning('Vous pouvez comparer 3 produits au maximum : retirez-en un d’abord.')
}

const specRows = computed(() => {
  const p = product.value
  if (!p) return []
  const d = p.dimensions
  return [
    { label: 'Type', value: PATTERN_LABEL[p.pattern] ?? p.pattern },
    { label: 'Dimensions (L × l × h)', value: `${d.lengthMm} × ${d.widthMm} × ${d.heightMm} mm`, mono: true },
    { label: 'Masse unitaire', value: p.unitWeightKg != null ? `${num(p.unitWeightKg, 1)} kg` : 'À confirmer' },
    { label: 'Unité de vente', value: unit.value },
    { label: 'Surface par pièce', value: p.m2PerUnit != null ? `${num(p.m2PerUnit, 2)} m²` : '—', hide: p.m2PerUnit == null },
    { label: 'Pièces par palette', value: p.unitsPerPallet != null ? num(p.unitsPerPallet) : '—', hide: p.unitsPerPallet == null },
    { label: 'Quantité minimale', value: `${num(p.minOrderQty)} ${unit.value}${p.minOrderQty > 1 ? 's' : ''}` },
    { label: 'Délai', value: p.leadTimeLabel || 'À confirmer' },
  ]
})
</script>

<template>
  <div>
    <div v-if="!db.ready.value" class="mx-auto max-w-7xl px-4 py-10 sm:px-6"><UiSkeleton height="24rem" rounded /></div>

    <div v-else-if="!product" class="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <UiEmpty icon="package-search" title="Ce produit est introuvable" hint="Il a peut-être été retiré du catalogue ou son adresse a changé.">
        <UiButton to="/catalogue" icon="layout-grid">Retour au catalogue</UiButton>
      </UiEmpty>
    </div>

    <template v-else>
      <div class="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <nav class="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Fil d’Ariane">
          <NuxtLink to="/" class="hover:text-ink">Accueil</NuxtLink>
          <Icon name="lucide:chevron-right" class="size-3.5" aria-hidden="true" />
          <NuxtLink to="/catalogue" class="hover:text-ink">Catalogue</NuxtLink>
          <Icon name="lucide:chevron-right" class="size-3.5" aria-hidden="true" />
          <span class="text-ink">{{ product.name }}</span>
        </nav>

        <div class="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
          <div class="flex flex-col gap-3">
            <div class="card paver-bg overflow-hidden">
              <UiImage :media="product.photos[0]" :product="product" ratio="4/3" :width="1100" :rounded="false" />
            </div>
            <div v-if="product.photos.length > 1" class="grid grid-cols-4 gap-2">
              <div v-for="(ph, i) in product.photos.slice(1, 5)" :key="i" class="card overflow-hidden"><UiImage :media="ph" :product="product" ratio="1/1" :width="300" :rounded="false" /></div>
            </div>
            <SiteNotice kind="document" dense>Visuel illustratif généré pour la démonstration : il ne représente pas un lot réel.</SiteNotice>
          </div>

          <div class="flex min-w-0 flex-col gap-5">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <UiStatusBadge kind="validation" :value="product.validation" />
                <UiBadge v-if="category" icon="tag">{{ category.name }}</UiBadge>
              </div>
              <p class="tnum mt-3 text-sm text-muted">{{ product.ref }}</p>
              <h1 class="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{{ product.name }}</h1>
              <p class="mt-3 text-[17px] leading-relaxed text-muted">{{ product.description }}</p>
            </div>

            <div class="card p-4 sm:p-5">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="tnum font-display text-3xl font-semibold">{{ product.priceIndicative == null ? 'Sur devis' : fcfa(product.priceIndicative) }}</p>
                  <p class="mt-0.5 text-sm text-muted">{{ product.priceIndicative == null ? 'Prix communiqué par devis' : `par ${unit} · prix indicatif, hors livraison` }}</p>
                </div>
                <UiBadge icon="clock" tone="neutral">Délai à confirmer</UiBadge>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <UiField label="Quantité" :hint="`Minimum ${num(product.minOrderQty)}`" :error="belowMin ? `En dessous du minimum (${num(product.minOrderQty)})` : undefined" v-slot="{ id }">
                  <UiInput :id="id" v-model="qty" type="number" inputmode="numeric" :suffix="unit" />
                </UiField>
                <UiField v-if="product.finishes.length" label="Finition" v-slot="{ id }">
                  <UiSelect :id="id" v-model="finish" :options="product.finishes.map((f) => ({ value: f, label: f }))" />
                </UiField>
                <UiField v-if="product.colors.length" label="Couleur" v-slot="{ id }">
                  <UiSelect :id="id" v-model="color" :options="product.colors.map((c) => ({ value: c.name, label: c.name }))" />
                </UiField>
              </div>
              <p v-if="lineTotal != null" class="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm">
                <span class="text-muted">Estimation pour cette quantité</span>
                <span class="tnum font-display text-lg font-semibold">{{ fcfa(lineTotal) }}</span>
              </p>

              <div class="mt-4 flex flex-wrap gap-2">
                <UiButton v-if="quotable" icon="file-text" :disabled="belowMin" @click="addToList(true)">Demander un devis</UiButton>
                <UiButton v-if="orderable" variant="accent" icon="shopping-cart" :disabled="belowMin" @click="orderNow">Commander (démo)</UiButton>
                <UiButton variant="outline" icon="list-plus" :disabled="belowMin" @click="addToList()">Ajouter à la liste</UiButton>
              </div>
              <p v-if="!quotable" class="mt-3 flex items-start gap-2 text-sm text-muted">
                <Icon name="lucide:flask-conical" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Ce produit est encore en développement : il ne peut pas être chiffré. Vous pouvez le suivre en favori.
              </p>
              <p v-else-if="!orderable" class="mt-3 flex items-start gap-2 text-sm text-muted">
                <Icon name="lucide:clipboard-check" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                La commande en ligne n’est ouverte qu’aux produits autorisés à la commercialisation : celui-ci passe par un devis.
              </p>

              <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
                <UiButton size="sm" variant="ghost" :icon="favorites.has(product.id) ? 'heart-minus' : 'heart'" @click="toggleFavorite">{{ favorites.has(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris' }}</UiButton>
                <UiCheckbox :model-value="compare.has(product.id)" label="Comparer" @update:model-value="toggleCompare" />
                <UiButton v-if="compare.ids.value.length > 1" size="sm" variant="ghost" icon="columns-3" to="/comparer">Voir la comparaison ({{ compare.ids.value.length }})</UiButton>
              </div>
            </div>

            <SiteNotice kind="technical" dense />
          </div>
        </div>

        <div class="mt-12">
          <UiTabs v-model="tab" :items="tabs" aria-label="Détails du produit">
            <template #specs>
              <div class="grid gap-8 pt-6 lg:grid-cols-2">
                <UiKeyValue :items="specRows" />
                <div class="flex flex-col gap-5">
                  <div v-if="product.colors.length">
                    <h3 class="font-display text-[15px] font-semibold">Couleurs proposées</h3>
                    <ul class="mt-3 flex flex-wrap gap-3">
                      <li v-for="c in product.colors" :key="c.name" class="flex items-center gap-2 text-sm">
                        <span class="size-6 rounded-md border border-line" :style="{ backgroundColor: c.hex }" aria-hidden="true" />{{ c.name }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="product.finishes.length">
                    <h3 class="font-display text-[15px] font-semibold">Finitions</h3>
                    <ul class="mt-3 flex flex-wrap gap-2"><li v-for="f in product.finishes" :key="f"><UiBadge icon="sparkles">{{ f }}</UiBadge></li></ul>
                  </div>
                  <UiAlert tone="neutral" icon="scale" title="Mesures et tolérances">Les dimensions sont nominales. Les résultats d’essais (résistance, absorption, glissance…) ne sont publiés que lorsqu’ils sont disponibles : consultez l’onglet Documents.</UiAlert>
                </div>
              </div>
            </template>

            <template #uses>
              <div class="grid gap-8 pt-6 lg:grid-cols-2">
                <div>
                  <h3 class="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name="lucide:circle-check" class="size-4 text-success" aria-hidden="true" />Usages envisagés</h3>
                  <ul class="mt-3 flex flex-col gap-2 text-sm">
                    <li v-for="u in product.allowedUses" :key="u" class="flex items-start gap-2"><Icon name="lucide:check" class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />{{ u }}</li>
                    <li v-if="!product.allowedUses.length" class="text-muted">Usages à préciser après validation.</li>
                  </ul>
                  <div class="mt-5"><SiteNotice kind="structural" dense /></div>
                </div>
                <div>
                  <h3 class="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name="lucide:triangle-alert" class="size-4 text-warning" aria-hidden="true" />Restrictions</h3>
                  <ul class="mt-3 flex flex-col gap-2 text-sm">
                    <li v-for="r in product.restrictions" :key="r" class="flex items-start gap-2"><Icon name="lucide:minus" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />{{ r }}</li>
                    <li v-if="!product.restrictions.length" class="text-muted">Aucune restriction renseignée : confirmez auprès de notre équipe avant tout usage.</li>
                  </ul>
                  <div class="mt-5">
                    <h3 class="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name="lucide:hammer" class="size-4 text-primary" aria-hidden="true" />Pose</h3>
                    <p v-if="product.installNotes && product.installNotesValidated" class="mt-2 text-sm leading-relaxed">{{ product.installNotes }}</p>
                    <p v-else class="mt-2 text-sm text-muted">Les instructions de pose ne sont publiées qu’après validation. En attendant, demandez conseil à notre équipe technique.</p>
                  </div>
                </div>
              </div>
            </template>

            <template #docs>
              <div class="pt-6">
                <UiEmpty v-if="!documents.length" compact icon="file-question" title="Aucun document publié" hint="Les fiches techniques et rapports d’essai apparaissent ici lorsqu’ils sont publiés." />
                <ul v-else class="grid gap-3 sm:grid-cols-2">
                  <li v-for="d in documents" :key="d.id" class="card flex items-start gap-3 p-4">
                    <span class="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon name="lucide:file-text" class="size-5" aria-hidden="true" /></span>
                    <div class="min-w-0">
                      <p class="font-medium">{{ d.title }}</p>
                      <p class="mt-0.5 text-[13px] text-muted">{{ DOC_KIND_LABEL[d.kind] ?? d.kind }} · version {{ d.version }} <UiDemoBadge class="ml-1 align-middle" /></p>
                      <p class="mt-1.5 text-xs text-muted">{{ d.demoNotice }}</p>
                      <UiButton v-if="d.file?.url" class="mt-2" size="sm" variant="outline" icon="external-link" :href="d.file.url">Ouvrir</UiButton>
                    </div>
                  </li>
                </ul>
                <div class="mt-4"><SiteNotice kind="document" dense /></div>
              </div>
            </template>
          </UiTabs>
        </div>

        <section v-if="related.length" class="mt-16 pb-16">
          <SiteSectionHead title="Dans la même catégorie" />
          <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <ProductCard v-for="p in related" :key="p.id" :product="p" />
          </div>
        </section>
        <div v-else class="pb-16" />
      </div>
    </template>
  </div>
</template>
