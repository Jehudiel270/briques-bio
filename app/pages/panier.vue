<script setup lang="ts">
import type { Product } from '#shared/types/domain'
import { canRequestQuote, computeTotals, isOrderable } from '#shared/services/pricing'

usePageTitle('Ma liste de produits')
const db = useDb()
const cart = useCart()
const confirm = useConfirm()
const toast = useToast()

interface Line { key: string; productId: string; qty: number; finish?: string; color?: string; product?: Product; unitPrice: number | null; total: number | null }

const lines = computed<Line[]>(() => cart.items.value.map((i) => {
  const product = db.all('products').find((p) => p.id === i.productId && p.published)
  const unitPrice = product?.priceIndicative ?? null
  return { key: `${i.productId}|${i.finish ?? ''}|${i.color ?? ''}`, productId: i.productId, qty: i.qty, finish: i.finish, color: i.color, product, unitPrice, total: unitPrice != null ? unitPrice * i.qty : null }
}))

const totals = computed(() => computeTotals({ lines: lines.value.filter((l) => l.product).map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })) }))
const quoteOnly = computed(() => lines.value.filter((l) => l.product && l.unitPrice == null).length)
const missing = computed(() => lines.value.filter((l) => !l.product))
const blocked = computed(() => lines.value.filter((l) => l.product && !canRequestQuote(l.product)))
const canQuote = computed(() => lines.value.length > 0 && !missing.value.length && !blocked.value.length)
const canOrder = computed(() => canQuote.value && lines.value.every((l) => l.product && isOrderable(l.product) && l.unitPrice != null))

const drafts = reactive<Record<string, string>>({})
const shown = (l: Line) => drafts[l.key] ?? String(l.qty)
function commit(l: Line) {
  const raw = drafts[l.key]
  delete drafts[l.key]
  if (raw === undefined) return
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return toast.warning('La quantité doit être d’au moins 1.')
  cart.setQty(l.productId, n, { finish: l.finish, color: l.color })
  if (l.product && n < l.product.minOrderQty) toast.warning(`« ${l.product.name} » : le minimum est de ${num(l.product.minOrderQty)}.`)
}
const step = (l: Line, d: number) => cart.setQty(l.productId, Math.max(1, l.qty + d), { finish: l.finish, color: l.color })
const removeLine = (l: Line) => cart.remove(l.productId, { finish: l.finish ?? '', color: l.color ?? '' })

async function clearAll() {
  if (await confirm({ title: 'Vider la liste ?', message: 'Tous les produits seront retirés de votre liste. Cette action est immédiate.', confirmLabel: 'Vider la liste', tone: 'danger' })) {
    cart.clear()
    toast.info('Liste vidée.')
  }
}
function purgeUnavailable() {
  for (const l of [...missing.value, ...blocked.value]) removeLine(l)
  toast.info('Produits indisponibles retirés de la liste.')
}
</script>

<template>
  <div>
    <SitePageHero title="Ma liste de produits" intro="Rassemblez les références et les quantités souhaitées, puis demandez un devis ou, pour les produits autorisés, passez une commande de démonstration." crumb="Ma liste">
      <template #actions>
        <UiButton variant="outline" icon="layout-grid" to="/catalogue">Continuer mes choix</UiButton>
        <UiButton v-if="lines.length" variant="ghost" icon="trash-2" @click="clearAll">Vider la liste</UiButton>
      </template>
    </SitePageHero>

    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <UiEmpty v-if="!lines.length" icon="shopping-basket" title="Votre liste est vide" hint="Ajoutez des produits depuis le catalogue pour préparer un devis.">
        <UiButton to="/catalogue" icon="layout-grid">Ouvrir le catalogue</UiButton>
      </UiEmpty>

      <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="flex min-w-0 flex-col gap-3">
          <UiAlert v-if="missing.length || blocked.length" tone="warning" title="Certains produits ne peuvent plus être chiffrés">
            Retirez les produits retirés du catalogue ou encore en développement avant de continuer.
            <UiButton class="mt-2" size="sm" variant="outline" icon="trash-2" @click="purgeUnavailable">Retirer ces produits</UiButton>
          </UiAlert>

          <article v-for="l in lines" :key="l.key" class="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div class="paver-bg w-full shrink-0 overflow-hidden rounded-lg border border-line sm:w-32">
              <UiImage v-if="l.product" :media="l.product.photos[0]" :product="l.product" ratio="4/3" :width="320" :rounded="false" />
              <div v-else class="grid aspect-[4/3] place-items-center text-muted"><Icon name="lucide:package-x" class="size-7" aria-hidden="true" /></div>
            </div>
            <div class="min-w-0 flex-1">
              <template v-if="l.product">
                <p class="tnum text-xs text-muted">{{ l.product.ref }}</p>
                <NuxtLink :to="`/catalogue/${l.product.slug || l.product.ref}`" class="font-display text-base font-semibold hover:text-primary">{{ l.product.name }}</NuxtLink>
                <p v-if="l.finish || l.color" class="mt-0.5 text-[13px] text-muted">{{ [l.finish, l.color].filter(Boolean).join(' · ') }}</p>
                <div class="mt-2"><UiStatusBadge kind="validation" :value="l.product.validation" size="sm" /></div>
              </template>
              <template v-else>
                <p class="font-medium">Produit indisponible</p>
                <p class="text-sm text-muted">Ce produit n’est plus au catalogue.</p>
              </template>
            </div>
            <div class="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
              <div class="flex items-center gap-1">
                <UiButton size="sm" variant="outline" icon="minus" icon-only :aria-label="`Diminuer la quantité`" @click="step(l, -1)" />
                <div class="w-20"><UiInput :model-value="shown(l)" type="number" inputmode="numeric" :aria-label="`Quantité`" @update:model-value="(v) => (drafts[l.key] = String(v ?? ''))" @blur="commit(l)" @enter="commit(l)" /></div>
                <UiButton size="sm" variant="outline" icon="plus" icon-only aria-label="Augmenter la quantité" @click="step(l, 1)" />
              </div>
              <div class="text-right">
                <p class="tnum font-display text-base font-semibold">{{ l.total == null ? 'Sur devis' : fcfa(l.total) }}</p>
                <p v-if="l.unitPrice != null && l.product" class="tnum text-xs text-muted">{{ fcfa(l.unitPrice) }} / {{ unitLabel(l.product.saleUnit) }}</p>
              </div>
              <UiButton size="sm" variant="ghost" icon="trash-2" icon-only :aria-label="`Retirer de la liste`" @click="removeLine(l)" />
            </div>
          </article>
        </div>

        <aside class="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <UiCard title="Estimation" icon="calculator">
            <dl class="flex flex-col gap-2 text-sm">
              <div class="flex justify-between"><dt class="text-muted">Lignes</dt><dd class="tnum">{{ lines.length }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Sous-total indicatif</dt><dd class="tnum">{{ fcfa(totals.subtotal) }}</dd></div>
              <div v-if="quoteOnly" class="flex justify-between"><dt class="text-muted">Lignes sur devis</dt><dd class="tnum">{{ quoteOnly }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Livraison</dt><dd>À chiffrer</dd></div>
            </dl>
            <p class="mt-3 border-t border-line pt-3 text-xs text-muted">Estimation non contractuelle : le devis fixe les prix, la remise, la livraison et l’acompte.</p>
            <div class="mt-4 flex flex-col gap-2">
              <UiButton block icon="file-text" :disabled="!canQuote" to="/devis">Demander un devis</UiButton>
              <UiButton v-if="canOrder" block variant="accent" icon="shopping-cart" to="/commande-demo">Commander (démo)</UiButton>
            </div>
            <p v-if="!canOrder && canQuote" class="mt-3 text-xs text-muted">La commande directe n’est ouverte que lorsque tous les produits sont autorisés à la commercialisation et ont un prix.</p>
          </UiCard>
          <SiteNotice kind="leadTime" dense />
          <SiteNotice kind="technical" dense />
        </aside>
      </div>
    </div>
  </div>
</template>
