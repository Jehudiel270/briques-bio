<script setup lang="ts">
/** En-tête de page d'espace de travail. Slots : `actions` (boutons), `meta` (puces sous le titre). */
defineProps<{ title: string; description?: string; back?: string; icon?: string }>()
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <NuxtLink v-if="back" :to="back" class="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <Icon name="lucide:arrow-left" class="size-3.5" aria-hidden="true" />Retour
      </NuxtLink>
      <div class="flex items-center gap-3">
        <span v-if="icon" class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon :name="icon.includes(':') ? icon : `lucide:${icon}`" class="size-5" aria-hidden="true" />
        </span>
        <h1 class="font-display text-2xl font-semibold leading-tight text-ink sm:text-[28px]">{{ title }}</h1>
      </div>
      <p v-if="description" class="mt-1.5 max-w-2xl text-sm text-muted">{{ description }}</p>
      <div v-if="$slots.meta" class="mt-2.5 flex flex-wrap items-center gap-2"><slot name="meta" /></div>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2"><slot name="actions" /></div>
  </header>
</template>
