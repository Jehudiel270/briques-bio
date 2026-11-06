<script setup lang="ts">
import type { Tone } from '#shared/utils/labels'
/** Historique vertical. `items` du plus récent au plus ancien ou inversement (ordre conservé tel quel). */
defineProps<{ items: { at?: string; title: string; body?: string; icon?: string; tone?: Tone; by?: string }[]; empty?: string }>()
const dot: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  info: 'bg-info/12 text-info border-info/30',
  success: 'bg-success/12 text-success border-success/30',
  warning: 'bg-warning/14 text-warning border-warning/35',
  danger: 'bg-danger/12 text-danger border-danger/30',
  accent: 'bg-accent/25 text-ink border-accent/50',
}
</script>

<template>
  <ol v-if="items.length" class="relative flex flex-col">
    <li v-for="(it, i) in items" :key="i" class="relative flex gap-3 pb-5 last:pb-0">
      <span v-if="i < items.length - 1" class="absolute left-[13px] top-7 bottom-0 w-px bg-line" aria-hidden="true" />
      <span class="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border" :class="dot[it.tone ?? 'neutral']">
        <Icon :name="`lucide:${it.icon ?? 'circle-dot'}`" class="size-3.5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1 pt-0.5">
        <p class="text-sm font-medium text-ink">{{ it.title }}</p>
        <p v-if="it.body" class="mt-0.5 text-[13px] text-muted">{{ it.body }}</p>
        <p v-if="it.at || it.by" class="mt-0.5 text-xs text-muted">
          <time v-if="it.at" :datetime="it.at" :title="fdatetime(it.at)">{{ relTime(it.at) }}</time><span v-if="it.at && it.by"> · </span>{{ it.by }}
        </p>
      </div>
    </li>
  </ol>
  <p v-else class="text-sm text-muted">{{ empty ?? 'Aucun événement pour le moment.' }}</p>
</template>
