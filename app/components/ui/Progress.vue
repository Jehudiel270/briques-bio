<script setup lang="ts">
import type { Tone } from '#shared/utils/labels'
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
/** Barre de progression. `value` / `max` ; `label` lu par les lecteurs d'écran ; `showValue` affiche le pourcentage. */
const props = withDefaults(defineProps<{ value: number; max?: number; tone?: Tone; label?: string; showValue?: boolean; size?: 'sm' | 'md' }>(), { max: 100, tone: 'info', size: 'md' })
const pctValue = computed(() => Math.round((clampNum(props.value, 0, props.max) / (props.max || 1)) * 100))
const bar: Record<Tone, string> = { neutral: 'bg-muted', info: 'bg-info', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', accent: 'bg-accent' }
</script>

<template>
  <div class="flex items-center gap-2.5">
    <ProgressRoot :model-value="value" :max="max" :aria-label="label" class="relative w-full overflow-hidden rounded-full bg-surface-2" :class="size === 'sm' ? 'h-1.5' : 'h-2'">
      <ProgressIndicator class="h-full rounded-full transition-[width] duration-500 ease-out" :class="bar[tone]" :style="{ width: `${pctValue}%` }" />
    </ProgressRoot>
    <span v-if="showValue" class="tnum w-10 shrink-0 text-right text-xs text-muted">{{ pctValue }} %</span>
  </div>
</template>
