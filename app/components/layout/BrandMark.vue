<script setup lang="ts">
/** Logo : pictogramme en pavés (point de Hongrie) + nom de marque issu des paramètres. `iconOnly` pour les barres étroites. */
withDefaults(defineProps<{ iconOnly?: boolean; to?: string; size?: 'sm' | 'md' | 'lg' }>(), { to: '/', size: 'md' })
const brand = useBrand()
</script>

<template>
  <NuxtLink :to="to" class="inline-flex items-center gap-2.5 rounded-md outline-none" :aria-label="`${brand.name} — accueil`">
    <img v-if="brand.logoUrl" :src="brand.logoUrl" :alt="brand.name" :class="size === 'lg' ? 'size-10' : size === 'sm' ? 'size-7' : 'size-8'" class="rounded-md object-contain" />
    <svg v-else viewBox="0 0 32 32" :class="size === 'lg' ? 'size-10' : size === 'sm' ? 'size-7' : 'size-8'" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <g fill="var(--primary-ink)">
        <rect x="5" y="6" width="13" height="6.5" rx="1.6" />
        <rect x="14" y="14.5" width="13" height="6.5" rx="1.6" opacity="0.82" />
        <rect x="5" y="23" width="13" height="4" rx="1.6" opacity="0.6" />
      </g>
      <rect x="20.5" y="6" width="6.5" height="6.5" rx="1.6" fill="var(--accent)" />
    </svg>
    <span v-if="!iconOnly" class="font-display text-[17px] font-semibold leading-none tracking-tight text-ink" style="font-stretch: 118%">{{ brand.name }}</span>
  </NuxtLink>
</template>
