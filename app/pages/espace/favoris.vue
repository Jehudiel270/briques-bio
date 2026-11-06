<script setup lang="ts">
import { fcfa, unitLabel } from '#shared/utils/format'

usePageTitle('Favoris')
const db = useDb()
const auth = useAuth()
const cart = useCart()
const toast = useToast()

const favs = computed(() => db.all('favorites').filter((f) => f.userId === auth.user.value?.id))
const items = computed(() => favs.value.map((f) => ({ fav: f, product: db.peek('products', f.productId) })).filter((x) => x.product && x.product.published))

function remove(id: string) { db.remove('favorites', id) }
function add(p: { id: string; name: string }) { cart.add(p.id, 1); toast.success(`« ${p.name} » ajouté à votre liste.`) }
</script>

<template>
  <div>
    <UiPageHeader title="Favoris" description="Les produits que vous avez mis de côté." icon="heart" />
    <UiEmpty v-if="!items.length" icon="heart" title="Aucun favori" hint="Utilisez le cœur sur une fiche produit pour la retrouver ici.">
      <UiButton icon="layout-grid" to="/espace/catalogue">Parcourir le catalogue</UiButton>
    </UiEmpty>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="{ fav, product: p } in items" :key="fav.id" class="card overflow-hidden">
        <NuxtLink :to="`/catalogue/${p!.slug || p!.ref}`" class="block bg-surface-2"><ProductVisual :tone="p!.tone" :pattern="p!.pattern" class="mx-auto h-36 w-full" /></NuxtLink>
        <div class="space-y-2 p-4">
          <div class="flex items-start justify-between gap-2"><h2 class="font-display font-semibold">{{ p!.name }}</h2><UiStatusBadge kind="validation" :value="p!.validation" size="sm" /></div>
          <p class="tnum font-semibold">{{ p!.priceIndicative != null ? fcfa(p!.priceIndicative) : 'Sur devis' }}<span v-if="p!.priceIndicative != null" class="text-[13px] font-normal text-muted"> / {{ unitLabel(p!.saleUnit) }}</span></p>
          <div class="flex gap-2">
            <UiButton size="sm" icon="plus" @click="add(p!)">Ajouter à ma liste</UiButton>
            <UiButton size="sm" variant="ghost" icon="heart-off" aria-label="Retirer des favoris" @click="remove(fav.id)" />
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
