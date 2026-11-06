<script setup lang="ts">
import type { Tone } from '#shared/utils/labels'
const props = withDefaults(defineProps<{ tone?: Tone; title?: string; icon?: string; dense?: boolean }>(), { tone: 'info' })
const icons: Record<Tone, string> = { neutral: 'info', info: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'octagon-alert', accent: 'sparkles' }
const cls: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2/60',
  info: 'border-info/30 bg-info/8',
  success: 'border-success/30 bg-success/8',
  warning: 'border-warning/35 bg-warning/10',
  danger: 'border-danger/35 bg-danger/8',
  accent: 'border-accent/50 bg-accent/12',
}
const ico: Record<Tone, string> = { neutral: 'text-muted', info: 'text-info', success: 'text-success', warning: 'text-warning', danger: 'text-danger', accent: 'text-accent' }
const role = computed(() => (props.tone === 'danger' || props.tone === 'warning' ? 'alert' : 'status'))
</script>

<template>
  <div class="flex gap-3 rounded-md border text-sm text-ink" :class="[cls[tone], dense ? 'p-2.5' : 'p-3.5']" :role="role">
    <Icon :name="`lucide:${icon ?? icons[tone]}`" class="mt-0.5 size-4 shrink-0" :class="ico[tone]" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <div :class="title && 'mt-0.5 text-ink/85'"><slot /></div>
    </div>
    <div v-if="$slots.actions" class="shrink-0"><slot name="actions" /></div>
  </div>
</template>
