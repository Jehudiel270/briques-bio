<script setup lang="ts">
import type { Product } from '#shared/types/domain'
import { PATTERN_LABEL } from '#shared/utils/labels'
import { canRequestQuote } from '#shared/services/pricing'

usePageTitle('Comparer des produits')
const db = useDb()
const compare = useCompare()
const cart = useCart()
const toast = useToast()

const products = computed(() => compare.ids.value.map((id) => db.all('products').find((p) => p.id === id)).filter((p): p is Product => !!p))
const addable = computed(() => db.all('products').filter((p) => p.published && !compare.has(p.id)).map((p) => ({ value: p.id, label: `${p.name} (${p.ref})` })))
const pick = ref('')
watch(pick, (v) => {
  if (!v) return
  if (!compare.toggle(v)) toast.warning('Vous pouvez comparer 3 produits au maximum : retirez-en un d’abord.')
  pick.value = ''
})

const unitOf = (p: Product) => unitLabel(p.saleUnit)
const rows: { key: string; label: string; icon: string; text?: (p: Product) => string }[] = [
  { key: 'validation', label: 'Statut de validation', icon: 'badge-check' },
  { key: 'price', label: 'Prix indicatif', icon: 'banknote' },
  { key: 'type', label: 'Type', icon: 'shapes', text: (p) => PATTERN_LABEL[p.pattern] ?? p.pattern },
  { key: 'dims', label: 'Dimensions (L × l × h)', icon: 'ruler', text: (p) => `${p.dimensions.lengthMm} × ${p.dimensions.widthMm} × ${p.dimensions.heightMm} mm` },
  { key: 'weight', label: 'Masse unitaire', icon: 'weight', text: (p) => (p.unitWeightKg != null ? `${num(p.unitWeightKg, 1)} kg` : 'À confirmer') },
  { key: 'unit', label: 'Unité de vente', icon: 'package', text: unitOf },
  { key: 'min', label: 'Quantité minimale', icon: 'arrow-up-to-line', text: (p) => `${num(p.minOrderQty)} ${unitOf(p)}` },
  { key: 'colors', label: 'Couleurs', icon: 'palette' },
  { key: 'finishes', label: 'Finitions', icon: 'sparkles', text: (p) => p.finishes.join(', ') || '—' },
  { key: 'uses', label: 'Usages envisagés', icon: 'circle-check' },
  { key: 'restrictions', label: 'Restrictions', icon: 'triangle-alert' },
  { key: 'lead', label: 'Délai', icon: 'clock', text: (p) => p.leadTimeLabel || 'À confirmer' },
]

function addToList(p: Product) {
  cart.add(p.id, p.minOrderQty || 1)
  toast.success(`« ${p.name} » ajouté à votre liste.`)
}
</script>

<template>
  <div>
    <SitePageHero title="Comparer des produits" intro="Placez jusqu’à trois références côte à côte : dimensions, usages, restrictions et statut de validation réel." crumb="Comparer">
      <template #actions>
        <UiButton variant="outline" icon="layout-grid" to="/catalogue">Retour au catalogue</UiButton>
        <UiButton v-if="products.length" variant="ghost" icon="x" @click="compare.clear()">Vider la comparaison</UiButton>
      </template>
    </SitePageHero>

    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div v-if="!db.ready.value"><UiSkeleton height="22rem" rounded /></div>

      <UiEmpty v-else-if="!products.length" icon="columns-3" title="Aucun produit à comparer" hint="Cochez « Comparer » sur les fiches ou les cartes du catalogue, ou choisissez un produit ci-dessous.">
        <div class="w-72 max-w-full"><UiSelect v-model="pick" :options="addable" placeholder="Ajouter un produit…" searchable /></div>
        <UiButton to="/catalogue" icon="layout-grid">Parcourir le catalogue</UiButton>
      </UiEmpty>

      <template v-else>
        <div v-if="products.length < 3" class="mb-5 flex flex-wrap items-center gap-3">
          <div class="w-72 max-w-full"><UiSelect v-model="pick" :options="addable" placeholder="Ajouter un produit…" searchable aria-label="Ajouter un produit à comparer" /></div>
          <p class="text-sm text-muted">{{ products.length }} / 3 produits</p>
        </div>

        <div class="scroll-x card">
          <table class="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption class="sr-only">Comparaison des produits sélectionnés</caption>
            <thead>
              <tr class="border-b border-line align-bottom">
                <td class="w-44 p-4" />
                <th v-for="p in products" :key="p.id" scope="col" class="min-w-56 p-4 align-top font-normal">
                  <div class="paver-bg overflow-hidden rounded-lg border border-line"><UiImage :media="p.photos[0]" :product="p" ratio="16/10" :width="480" :rounded="false" /></div>
                  <p class="tnum mt-3 text-xs text-muted">{{ p.ref }}</p>
                  <NuxtLink :to="`/catalogue/${p.slug || p.ref}`" class="font-display text-base font-semibold hover:text-primary">{{ p.name }}</NuxtLink>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <UiButton size="sm" variant="outline" icon="list-plus" @click="addToList(p)">Ajouter à la liste</UiButton>
                    <UiButton size="sm" variant="ghost" icon="x" icon-only :aria-label="`Retirer ${p.name} de la comparaison`" @click="compare.toggle(p.id)" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.key" class="border-b border-line/70 last:border-0 odd:bg-surface-2/40">
                <th scope="row" class="p-4 align-top text-[13px] font-medium text-muted">
                  <span class="flex items-center gap-2"><Icon :name="`lucide:${r.icon}`" class="size-4 shrink-0" aria-hidden="true" />{{ r.label }}</span>
                </th>
                <td v-for="p in products" :key="p.id" class="p-4 align-top">
                  <UiStatusBadge v-if="r.key === 'validation'" kind="validation" :value="p.validation" size="sm" />
                  <template v-else-if="r.key === 'price'">
                    <p class="tnum font-display text-base font-semibold">{{ p.priceIndicative == null ? 'Sur devis' : fcfa(p.priceIndicative) }}</p>
                    <p v-if="p.priceIndicative != null" class="text-xs text-muted">par {{ unitOf(p) }}</p>
                  </template>
                  <ul v-else-if="r.key === 'colors'" class="flex flex-wrap gap-2">
                    <li v-for="c in p.colors" :key="c.name" class="flex items-center gap-1.5 text-[13px]"><span class="size-4 rounded-sm border border-line" :style="{ backgroundColor: c.hex }" aria-hidden="true" />{{ c.name }}</li>
                    <li v-if="!p.colors.length" class="text-muted">—</li>
                  </ul>
                  <ul v-else-if="r.key === 'uses'" class="flex flex-col gap-1.5">
                    <li v-for="u in p.allowedUses" :key="u" class="flex items-start gap-1.5"><Icon name="lucide:check" class="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />{{ u }}</li>
                    <li v-if="!p.allowedUses.length" class="text-muted">À préciser</li>
                  </ul>
                  <ul v-else-if="r.key === 'restrictions'" class="flex flex-col gap-1.5">
                    <li v-for="x in p.restrictions" :key="x" class="flex items-start gap-1.5"><Icon name="lucide:minus" class="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />{{ x }}</li>
                    <li v-if="!p.restrictions.length" class="text-muted">Aucune renseignée</li>
                  </ul>
                  <span v-else :class="r.key === 'dims' && 'tnum'">{{ r.text?.(p) }}</span>
                </td>
              </tr>
              <tr>
                <th scope="row" class="p-4" />
                <td v-for="p in products" :key="p.id" class="p-4">
                  <UiButton v-if="canRequestQuote(p)" size="sm" icon="file-text" @click="addToList(p); navigateTo('/devis')">Demander un devis</UiButton>
                  <span v-else class="text-[13px] text-muted">Devis indisponible : produit en développement</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-5"><SiteNotice kind="technical" dense /></div>
      </template>
    </div>
  </div>
</template>
