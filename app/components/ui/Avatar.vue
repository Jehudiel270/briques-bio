<script setup lang="ts">
/** Initiales sur fond teinté (teinte stable dérivée du nom, ou `hue` 0–360). */
const props = withDefaults(defineProps<{ name: string; hue?: number; size?: 'xs' | 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const h = computed(() => {
  if (props.hue != null) return props.hue
  let n = 0
  for (const c of props.name) n = (n * 31 + c.charCodeAt(0)) % 360
  return n
})
const text = computed(() => initials(props.name))
const dim = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-9 text-[13px]', lg: 'size-12 text-base' }
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-ink"
    :class="dim[size]"
    :style="{ background: `color-mix(in oklab, oklch(0.72 0.09 ${h}) 38%, var(--surface))`, border: `1px solid color-mix(in oklab, oklch(0.6 0.1 ${h}) 40%, var(--border))` }"
    :title="name"
    role="img"
    :aria-label="name"
  >{{ text }}</span>
</template>
