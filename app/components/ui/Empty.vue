<script setup lang="ts">
/** État vide : une phrase + une action (slot par défaut). */
withDefaults(defineProps<{ icon?: string; title: string; hint?: string; compact?: boolean }>(), { icon: 'inbox' })
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center" :class="compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'">
    <span class="grid size-12 place-items-center rounded-full border border-line bg-surface-2 text-muted">
      <Icon :name="icon.includes(':') ? icon : `lucide:${icon}`" class="size-5" aria-hidden="true" />
    </span>
    <div class="max-w-sm">
      <p class="font-display text-base font-semibold text-ink">{{ title }}</p>
      <p v-if="hint" class="mt-1 text-sm text-muted">{{ hint }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
