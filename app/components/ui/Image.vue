<script setup lang="ts">
import type { MediaRef, Product } from '#shared/types/domain'
/**
 * Image Cloudinary (ou URL directe) avec repli.
 * `media` : MediaRef | undefined (⚠ pas `ref`, nom réservé par Vue) ; `product` : repli ProductVisual ; `ratio` : "4/3", "1/1"… ; `width` : largeur demandée à Cloudinary (px).
 */
const props = withDefaults(defineProps<{ media?: MediaRef; alt?: string; ratio?: string; product?: Pick<Product, 'pattern' | 'tone' | 'id'>; width?: number; fit?: 'cover' | 'contain'; rounded?: boolean }>(), {
  ratio: '4/3',
  width: 800,
  fit: 'cover',
})
const config = useRuntimeConfig()
const failed = ref(false)
const src = computed(() => {
  const m = props.media
  if (!m || failed.value) return null
  if (m.url) return m.url
  const cloud = String((config.public as any).cloudinaryCloudName ?? '')
  if (m.publicId && cloud) return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${props.width}/${m.publicId}`
  return null
})
watch(() => props.media, () => (failed.value = false))
</script>

<template>
  <div class="relative w-full overflow-hidden bg-surface-2" :class="rounded !== false && 'rounded-lg'" :style="{ aspectRatio: ratio }">
    <img v-if="src" :src="src" :alt="alt ?? media?.alt ?? ''" loading="lazy" decoding="async" class="size-full" :class="fit === 'cover' ? 'object-cover' : 'object-contain'" @error="failed = true" />
    <ProductVisual v-else-if="product" :pattern="product.pattern" :tone="product.tone" :seed="product.id" class="size-full" />
    <div v-else class="grid size-full place-items-center text-muted"><Icon name="lucide:image" class="size-7" aria-hidden="true" /><span class="sr-only">Pas d’image</span></div>
  </div>
</template>
