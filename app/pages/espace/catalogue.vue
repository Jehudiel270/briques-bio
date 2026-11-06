<script setup lang="ts">
import { fcfa, norm, unitLabel } from '#shared/utils/format'
import { isOrderable } from '#shared/services/pricing'

usePageTitle('Catalogue')
const db = useDb()
const cart = useCart()
const toast = useToast()
const auth = useAuth()

const q = ref('')
const category = ref('')
const products = computed(() => db.all('products').filter((p) => p.published))
const categories = computed(() => [{ value: '', label: 'Toutes les catégories' }, ...db.all('categories').filter((c) => c.published).sort((a, b) => a.order - b.order).map((c) => ({ value: c.id, label: c.name }))])
const grid = computed(() => {
  const gid = auth.user.value?.companyId ? db.peek('companies', auth.user.value.companyId)?.priceGridId : undefined
  return gid ? db.all('priceGrids').find((g) => g.id === gid) : undefined
})
const shown = computed(() => {
  const s = norm(q.value)
  return products.value.filter((p) => (!category.value || p.categoryId === category.value) && (!s || norm(`${p.name} ${p.ref}`).includes(s)))
})
/** Prix affiché : palier de la grille tarifaire de l'entreprise s'il existe, sinon prix indicatif public. */
function priceOf(p: { id: string; priceIndicative: number | null; minOrderQty: number }) {
  const tier = grid.value?.tiers.filter((t) => t.productId === p.id).sort((a, b) => a.minQty - b.minQty)[0]
  return tier?.unitPrice ?? p.priceIndicative
}
function add(p: { id: string; name: string; minOrderQty: number }) {
  cart.add(p.id, Math.max(1, p.minOrderQty))
  toast.success(`« ${p.name} » ajouté à votre liste.`)
}
</script>

<template>
  <div>
    <UiPageHeader title="Catalogue" description="Les mêmes produits que la vitrine, avec les tarifs de votre compte lorsqu’ils existent." icon="layout-grid">
      <template #actions><UiButton variant="outline" icon="shopping-basket" to="/panier">Ma liste ({{ cart.count.value }})</UiButton></template>
    </UiPageHeader>
    <div class="mb-5 grid gap-3 sm:grid-cols-[1fr_16rem]">
      <UiSearch v-model="q" placeholder="Rechercher un produit ou une référence…" aria-label="Rechercher un produit" />
      <UiSelect v-model="category" :options="categories" aria-label="Catégorie" />
    </div>
    <UiEmpty v-if="!shown.length" icon="search-x" title="Aucun produit ne correspond" hint="Modifiez la recherche ou la catégorie.">
      <UiButton variant="outline" icon="rotate-ccw" @click="q = ''; category = ''">Réinitialiser</UiButton>
    </UiEmpty>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="p in shown" :key="p.id" class="card flex flex-col overflow-hidden">
        <NuxtLink :to="`/catalogue/${p.slug || p.ref}`" class="block bg-surface-2"><ProductVisual :tone="p.tone" :pattern="p.pattern" class="mx-auto h-40 w-full" /></NuxtLink>
        <div class="flex flex-1 flex-col gap-2 p-4">
          <div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="text-[12px] text-muted">{{ p.ref }}</p><h2 class="truncate font-display font-semibold">{{ p.name }}</h2></div><UiStatusBadge kind="validation" :value="p.validation" size="sm" /></div>
          <p class="tnum text-lg font-semibold">{{ priceOf(p) != null ? fcfa(priceOf(p)) : 'Sur devis' }}<span v-if="priceOf(p) != null" class="text-[13px] font-normal text-muted"> / {{ unitLabel(p.saleUnit) }}</span></p>
          <p v-if="grid && priceOf(p) != null" class="text-[12px] text-muted">Tarif {{ grid.name }}</p>
          <div class="mt-auto flex flex-wrap gap-2 pt-2">
            <UiButton size="sm" icon="plus" @click="add(p)">Ajouter</UiButton>
            <UiButton size="sm" variant="outline" icon="eye" :to="`/catalogue/${p.slug || p.ref}`">Fiche</UiButton>
            <UiBadge v-if="!isOrderable(p)" tone="neutral" size="sm" icon="file-text">Devis uniquement</UiBadge>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
