<script setup lang="ts">
/** Titre de section de la vitrine : titre, introduction, action optionnelle (slot). */
defineProps<{ title: string; intro?: string; center?: boolean }>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4" :class="center && 'justify-center text-center'">
    <div class="max-w-2xl">
      <h2 class="text-3xl font-semibold sm:text-4xl">{{ title }}</h2>
      <p v-if="intro" class="mt-3 text-[17px] leading-relaxed text-muted">{{ intro }}</p>
    </div>
    <div v-if="$slots.default"><slot /></div>
  </div>
</template>
