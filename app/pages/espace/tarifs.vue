<script setup lang="ts">
import { fcfa, unitLabel } from '#shared/utils/format'

usePageTitle('Tarifs professionnels')
const db = useDb()
const auth = useAuth()
const L = useLookups()

const company = computed(() => db.peek('companies', auth.user.value?.companyId))
const grid = computed(() => db.all('priceGrids').find((g) => g.id === company.value?.priceGridId))
const rows = computed(() => {
  if (!grid.value) return []
  const byProduct = new Map<string, { minQty: number; unitPrice: number }[]>()
  for (const t of grid.value.tiers) byProduct.set(t.productId, [...(byProduct.get(t.productId) ?? []), t].sort((a, b) => a.minQty - b.minQty))
  return [...byProduct.entries()].map(([productId, tiers]) => ({ id: productId, product: db.peek('products', productId), tiers })).filter((r) => r.product)
})
</script>

<template>
  <div>
    <UiPageHeader title="Tarifs professionnels" description="Paliers de prix liés à votre compte. Ils s’appliquent aux devis et aux commandes directes." icon="badge-percent" />
    <UiEmpty v-if="!grid" icon="badge-percent" title="Aucune grille tarifaire attribuée" hint="Contactez votre interlocuteur commercial pour obtenir une grille adaptée à vos volumes.">
      <UiButton icon="mail" to="/contact">Contacter l’équipe</UiButton>
    </UiEmpty>
    <template v-else>
      <div class="mb-5 flex flex-wrap items-center gap-3"><UiBadge tone="accent" icon="badge-percent">{{ grid.name }}</UiBadge><span v-if="grid.defaultDiscountPct" class="text-sm text-muted">Remise par défaut {{ grid.defaultDiscountPct }} %</span><UiDemoBadge /></div>
      <div class="card scroll-x">
        <table class="w-full min-w-[34rem] text-sm">
          <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Produit</th><th class="px-3 py-2.5 font-medium">Paliers (quantité minimale → prix unitaire)</th><th class="px-4 py-2.5 text-right font-medium">Prix public</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="border-b border-line/70 last:border-0">
              <td class="px-4 py-3 font-medium">{{ L.productName(r.id) }}</td>
              <td class="px-3 py-3"><div class="flex flex-wrap gap-2"><span v-for="t in r.tiers" :key="t.minQty" class="tnum rounded-md bg-surface-2 px-2 py-1">≥ {{ t.minQty }} {{ unitLabel(r.product!.saleUnit) }} → <strong>{{ fcfa(t.unitPrice) }}</strong></span></div></td>
              <td class="tnum px-4 py-3 text-right text-muted">{{ r.product!.priceIndicative != null ? fcfa(r.product!.priceIndicative) : 'Sur devis' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="grid.notes" class="mt-4 text-sm text-muted">{{ grid.notes }}</p>
      <div class="mt-5"><SiteNotice kind="demo" /></div>
    </template>
  </div>
</template>
