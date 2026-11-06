<script setup lang="ts">
/** Champ de recherche avec bouton d'effacement. `v-model` (texte). Émet `enter`. */
const model = defineModel<string>({ default: '' })
withDefaults(defineProps<{ placeholder?: string; size?: 'sm' | 'md' | 'lg'; touch?: boolean; ariaLabel?: string }>(), { placeholder: 'Rechercher…', size: 'md' })
const emit = defineEmits<{ enter: [] }>()
</script>

<template>
  <UiInput v-model="model" type="search" icon="search" :placeholder="placeholder" :size="size" :touch="touch" autocomplete="off" :aria-label="ariaLabel ?? placeholder" @enter="emit('enter')">
    <template #trailing>
      <button v-if="model" type="button" class="mr-1.5 grid size-6 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink" aria-label="Effacer la recherche" @click="model = ''">
        <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
      </button>
    </template>
  </UiInput>
</template>
