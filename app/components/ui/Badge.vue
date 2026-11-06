<script setup lang="ts">
import type { Tone } from '#shared/utils/labels'
/** Pastille d'information. Pour afficher un STATUT métier, utiliser `UiStatusBadge`. */
withDefaults(defineProps<{ tone?: Tone; icon?: string; size?: 'sm' | 'md'; dot?: boolean; solid?: boolean }>(), { tone: 'neutral', size: 'md' })

const soft: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink/80 border-line',
  info: 'bg-info/10 text-info border-info/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/25',
  accent: 'bg-accent/18 text-ink border-accent/45',
}
const solidCls: Record<Tone, string> = {
  neutral: 'bg-ink text-bg border-transparent',
  info: 'bg-info text-bg border-transparent',
  success: 'bg-success text-bg border-transparent',
  warning: 'bg-warning text-bg border-transparent',
  danger: 'bg-danger text-danger-ink border-transparent',
  accent: 'bg-accent text-accent-ink border-transparent',
}
const dotCls: Record<Tone, string> = { neutral: 'bg-muted', info: 'bg-info', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', accent: 'bg-accent' }
</script>

<template>
  <span
    class="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border font-medium leading-none"
    :class="[solid ? solidCls[tone] : soft[tone], size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs']"
  >
    <span v-if="dot" class="size-1.5 shrink-0 rounded-full" :class="dotCls[tone]" aria-hidden="true" />
    <Icon v-if="icon" :name="icon.includes(':') ? icon : `lucide:${icon}`" :class="size === 'sm' ? 'size-3' : 'size-3.5'" aria-hidden="true" />
    <span class="truncate"><slot /></span>
  </span>
</template>
