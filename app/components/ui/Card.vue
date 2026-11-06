<script setup lang="ts">
/** Carte de contenu. `padding` : none | sm | md (défaut) | lg. Slots : header, actions, default, footer. */
const props = withDefaults(defineProps<{ title?: string; description?: string; padding?: 'none' | 'sm' | 'md' | 'lg'; flat?: boolean; icon?: string }>(), { padding: 'md' })
const pad = computed(() => ({ none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-7' })[props.padding])
const headPad = computed(() => (props.padding === 'none' ? 'px-4 pt-4 sm:px-5 sm:pt-5' : ''))
</script>

<template>
  <section :class="flat ? 'card-flat' : 'card'" class="min-w-0">
    <header v-if="title || $slots.header || $slots.actions" class="flex items-start justify-between gap-3" :class="[pad && 'pb-0', padding === 'none' ? headPad : pad]">
      <slot name="header">
        <div class="flex min-w-0 items-start gap-2.5">
          <Icon v-if="icon" :name="icon.includes(':') ? icon : `lucide:${icon}`" class="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden="true" />
          <div class="min-w-0">
            <h2 class="font-display text-[15px] font-semibold leading-tight text-ink">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-[13px] text-muted">{{ description }}</p>
          </div>
        </div>
      </slot>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2"><slot name="actions" /></div>
    </header>
    <div :class="[pad, (title || $slots.header || $slots.actions) && padding !== 'none' && 'pt-3 sm:pt-3']"><slot /></div>
    <footer v-if="$slots.footer" class="border-t border-line px-4 py-3 sm:px-5"><slot name="footer" /></footer>
  </section>
</template>
