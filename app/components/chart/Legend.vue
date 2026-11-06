<script setup lang="ts">
import { toneVar, type ChartTone } from '~/utils/chart'
/** Légende : pastille (forme + couleur) + libellé, valeur optionnelle. Toujours présente dès 2 séries. `active` surligne un élément. */
defineProps<{ items: { label: string; tone?: ChartTone; value?: string | number }[]; active?: number | null; vertical?: boolean }>()
const emit = defineEmits<{ hover: [index: number | null] }>()
</script>

<template>
  <ul class="flex gap-x-4 gap-y-1.5 text-[13px] text-ink" :class="vertical ? 'flex-col' : 'flex-wrap'">
    <li
      v-for="(it, i) in items"
      :key="it.label"
      class="flex items-center gap-2 transition-opacity"
      :class="active != null && active !== i && 'opacity-45'"
      @mouseenter="emit('hover', i)"
      @mouseleave="emit('hover', null)"
    >
      <span class="size-2.5 shrink-0 rounded-[3px]" :style="{ background: toneVar(it.tone, i) }" aria-hidden="true" />
      <span class="min-w-0 truncate">{{ it.label }}</span>
      <span v-if="it.value != null" class="tnum ml-auto pl-3 text-muted">{{ typeof it.value === 'number' ? num(it.value) : it.value }}</span>
    </li>
  </ul>
</template>
