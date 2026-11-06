<script setup lang="ts">
import { PATTERN_LABEL } from '#shared/utils/labels'

usePageTitle('Catalogue')
const db = useDb()
const cart = useCart()
const compare = useCompare()
const toast = useToast()
const auth = useAuth()

const q = ref('')
const category = ref('')
const pattern = ref('')
const validation = ref('')
const sort = ref('featured')

const products = computed(() => db.all('products').filter((p) => p.published))
const categories = computed(() => db.all('categories').filter((c) => c.published).sort((a, b) => a.order - b.order))
const favorites = computed(() => new Set(db.all('favorites').filter((f) => f.userId === auth.user.value?.id).map((f) => f.productId)))

const filtered = computed(() => {
  const s = norm(q.value)
  let list = products.value.filter((p) =>
    (!s || norm(`${p.name} ${p.ref} ${p.description}`).includes(s)) &&
    (!category.value || p.categoryId === category.value) &&
    (!pattern.value || p.pattern === pattern.value) &&
    (!validation.value || p.validation === validation.value))
  const price = (p: (typeof list)[number]) => p.priceIndicative ?? Number.POSITIVE_INFINITY
  if (sort.value === 'price-asc') list = [...list].sort((a, b) => price(a) - price(b))
  else if (sort.value === 'price-desc') list = [...list].sort((a, b) => (b.priceIndicative ?? -1) - (a.priceIndicative ?? -1))
  else if (sort.value === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  else list = [...list].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(b.validation === 'authorized') - Number(a.validation === 'authorized'))
  return list
})

const hasFilters = computed(() => !!(q.value || category.value || pattern.value || validation.value))
const reset = () => { q.value = ''; category.value = ''; pattern.value = ''; validation.value = '' }

const catOptions = computed(() => [{ value: '', label: 'Toutes les catégories' }, ...categories.value.map((c) => ({ value: c.id, label: c.name }))])
const patternOptions = [{ value: '', label: 'Tous les types' }, ...Object.entries(PATTERN_LABEL).map(([value, label]) => ({ value, label }))]
const validationOptions = [{ value: '', label: 'Tous les statuts' }, ...Object.entries(STATUS.validation).map(([value, m]) => ({ value, label: m.label }))]
const sortOptions = [
  { value: 'featured', label: 'Pertinence' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom (A–Z)' },
]

function addToList(p: { id: string; name: string }) {
  cart.add(p.id, 1)
  toast.success(`« ${p.name} » ajouté à votre liste.`)
}
function toggleFavorite(p: { id: string }) {
  const u = auth.user.value
  if (!u || !['client', 'pro', 'distributor'].includes(u.role)) return navigateTo({ path: '/connexion', query: { redirect: '/catalogue' } })
  const existing = db.all('favorites').find((f) => f.userId === u.id && f.productId === p.id)
  if (existing) db.remove('favorites', existing.id)
  else db.create('favorites', { userId: u.id, productId: p.id, createdAt: db.now() } as any)
}
function toggleCompare(id: string) {
  if (!compare.toggle(id)) toast.warning('Vous pouvez comparer 3 produits au maximum : retirez-en un d’abord.')
}
</script>

<template>
  <div>
    <SitePageHero title="Catalogue" intro="Pavés, dalles, bordures et carreaux en plastique valorisé, pour des aménagements non structurels. Chaque produit affiche son statut de validation réel." crumb="Catalogue">
      <template #aside><SiteNotice kind="technical" class="max-w-sm" dense /></template>
    </SitePageHero>

    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]" role="search" aria-label="Filtrer le catalogue">
        <UiSearch v-model="q" placeholder="Rechercher un produit, une référence…" />
        <UiSelect v-model="category" :options="catOptions" aria-label="Catégorie" />
        <UiSelect v-model="pattern" :options="patternOptions" />
        <UiSelect v-model="validation" :options="validationOptions" />
        <UiSelect v-model="sort" :options="sortOptions" />
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p aria-live="polite"><span class="tnum font-medium text-ink">{{ filtered.length }}</span> produit{{ filtered.length > 1 ? 's' : '' }}</p>
        <div class="flex items-center gap-2">
          <UiButton v-if="hasFilters" size="sm" variant="ghost" icon="x" @click="reset">Effacer les filtres</UiButton>
          <UiButton v-if="compare.ids.value.length" size="sm" variant="outline" icon="columns-3" to="/comparer">Comparer ({{ compare.ids.value.length }})</UiButton>
        </div>
      </div>

      <div v-if="!db.ready.value" class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><UiSkeleton v-for="n in 8" :key="n" height="18rem" rounded /></div>
      <UiEmpty v-else-if="!filtered.length" class="mt-10" icon="search-x" title="Aucun produit ne correspond" hint="Élargissez la recherche ou retirez un filtre.">
        <UiButton variant="outline" icon="x" @click="reset">Effacer les filtres</UiButton>
      </UiEmpty>
      <div v-else class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="p in filtered" :key="p.id" class="flex flex-col gap-2">
          <ProductCard :product="p" show-actions :favorite="favorites.has(p.id)" :in-list="cart.has(p.id)" @add="addToList(p)" @favorite="toggleFavorite(p)" />
          <UiCheckbox :model-value="compare.has(p.id)" label="Comparer" @update:model-value="toggleCompare(p.id)" />
        </div>
      </div>
    </div>
  </div>
</template>
