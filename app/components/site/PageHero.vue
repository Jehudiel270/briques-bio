<script setup lang="ts">
/** En-tête des pages intérieures de la vitrine : titre éditorial, introduction, fil d'Ariane, actions. */
defineProps<{ title: string; intro?: string; crumb?: string; icon?: string }>()
</script>

<template>
  <header class="border-b border-line">
    <div class="mx-auto grid max-w-7xl gap-6 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:pb-14 lg:pt-16">
      <div class="max-w-3xl">
        <nav v-if="crumb" class="mb-4 flex items-center gap-1.5 text-sm text-muted" aria-label="Fil d’Ariane">
          <NuxtLink to="/" class="hover:text-ink">Accueil</NuxtLink>
          <Icon name="lucide:chevron-right" class="size-3.5" aria-hidden="true" />
          <span class="text-ink">{{ crumb }}</span>
        </nav>
        <h1 class="text-4xl font-semibold leading-[1.05] sm:text-5xl">{{ title }}</h1>
        <p v-if="intro" class="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{{ intro }}</p>
        <div v-if="$slots.actions" class="mt-6 flex flex-wrap gap-2"><slot name="actions" /></div>
      </div>
      <div v-if="$slots.aside" class="self-end"><slot name="aside" /></div>
    </div>
  </header>
</template>
