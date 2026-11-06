<script setup lang="ts">
import type { Tone } from '#shared/utils/labels'
/** Indicateur chiffré. `delta` : variation (nombre, en %, signe = sens). `to` : rend la tuile cliquable. Slot `spark` pour une mini-courbe. */
const props = withDefaults(
  defineProps<{ label: string; value: string | number; icon?: string; tone?: Tone; hint?: string; delta?: number; to?: string; demo?: boolean }>(),
  { tone: 'neutral' },
)
const NuxtLink = resolveComponent('NuxtLink')
const tag = computed(() => (props.to ? NuxtLink : 'div'))
const toneCls: Record<Tone, string> = { neutral: 'bg-surface-2 text-ink', info: 'bg-info/12 text-info', success: 'bg-success/12 text-success', warning: 'bg-warning/14 text-warning', danger: 'bg-danger/12 text-danger', accent: 'bg-accent/20 text-ink' }
</script>

<template>
  <component :is="tag" :to="to" class="card block min-w-0 p-4 transition-colors" :class="to && 'hover:border-primary/50'">
    <div class="flex items-start justify-between gap-3">
      <p class="text-[13px] font-medium text-muted">{{ label }}<UiDemoBadge v-if="demo" class="ml-1.5 align-middle" /></p>
      <span v-if="icon" class="grid size-8 shrink-0 place-items-center rounded-md" :class="toneCls[tone]">
        <Icon :name="icon.includes(':') ? icon : `lucide:${icon}`" class="size-4" aria-hidden="true" />
      </span>
    </div>
    <p class="tnum mt-2 font-display text-[28px] font-semibold leading-none tracking-tight text-ink">{{ value }}</p>
    <div class="mt-2 flex items-center justify-between gap-2 text-[13px]">
      <span v-if="delta != null" class="inline-flex items-center gap-1 font-medium" :class="delta >= 0 ? 'text-success' : 'text-danger'">
        <Icon :name="delta >= 0 ? 'lucide:trending-up' : 'lucide:trending-down'" class="size-3.5" aria-hidden="true" />{{ delta >= 0 ? '+' : '' }}{{ delta }} %
      </span>
      <span v-if="hint" class="truncate text-muted">{{ hint }}</span>
      <slot name="spark" />
    </div>
  </component>
</template>
