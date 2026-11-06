<script setup lang="ts">
import type { Product } from '#shared/types/domain'
/**
 * Carte catalogue. `showActions` affiche « Favori » et « Ajouter à la liste » (événements `favorite`, `add`).
 * `to` : lien de la fiche (par défaut /catalogue/<ref>). `compact` : version dense pour les listes.
 */
const props = withDefaults(defineProps<{ product: Product; compact?: boolean; to?: string; showActions?: boolean; favorite?: boolean; inList?: boolean }>(), {})
const emit = defineEmits<{ favorite: [product: Product]; add: [product: Product] }>()
const link = computed(() => props.to ?? `/catalogue/${props.product.slug || props.product.ref}`)
const priceLabel = computed(() => (props.product.priceIndicative == null ? 'Sur devis' : fcfa(props.product.priceIndicative)))
const unit = computed(() => ({ piece: 'la pièce', m2: 'le m²', ml: 'le mètre', pallet: 'la palette' })[props.product.saleUnit])
const dims = computed(() => `${props.product.dimensions.lengthMm} × ${props.product.dimensions.widthMm} × ${props.product.dimensions.heightMm} mm`)
</script>

<template>
  <article class="group card relative flex min-w-0 flex-col overflow-hidden transition-[border-color,transform] duration-200 hover:border-primary/60 motion-safe:hover:-translate-y-0.5">
    <NuxtLink :to="link" class="block outline-none" :aria-label="`Voir la fiche ${product.name}`">
      <div class="relative overflow-hidden">
        <UiImage :media="product.photos[0]" :product="product" :ratio="compact ? '16/10' : '4/3'" :rounded="false" :width="640" class="transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
        <span class="absolute left-2.5 top-2.5"><UiStatusBadge kind="validation" :value="product.validation" size="sm" /></span>
      </div>
    </NuxtLink>
    <div class="flex flex-1 flex-col gap-2.5 p-4" :class="compact && 'gap-1.5 p-3'">
      <div class="min-w-0">
        <p class="tnum text-xs text-muted">{{ product.ref }}</p>
        <h3 class="mt-0.5 font-display text-[17px] font-semibold leading-snug text-ink" :class="compact && 'text-[15px]'">
          <NuxtLink :to="link" class="outline-none after:absolute after:inset-0 after:content-['']">{{ product.name }}</NuxtLink>
        </h3>
        <p v-if="!compact" class="tnum mt-1 text-[13px] text-muted">{{ dims }}</p>
      </div>
      <div class="mt-auto flex items-end justify-between gap-3">
        <div>
          <p class="tnum font-display text-lg font-semibold text-ink">{{ priceLabel }}</p>
          <p v-if="product.priceIndicative != null" class="text-xs text-muted">{{ unit }} · prix indicatif</p>
          <p v-else class="text-xs text-muted">Prix communiqué par devis</p>
        </div>
        <div v-if="showActions" class="relative z-10 flex gap-1">
          <UiButton variant="ghost" size="sm" icon-only :icon="favorite ? 'heart-minus' : 'heart'" :aria-label="favorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`" @click.stop.prevent="emit('favorite', product)" />
          <UiButton variant="outline" size="sm" icon-only :icon="inList ? 'check' : 'list-plus'" :aria-label="inList ? `${product.name} est dans votre liste` : `Ajouter ${product.name} à la liste`" @click.stop.prevent="emit('add', product)" />
        </div>
      </div>
    </div>
  </article>
</template>
