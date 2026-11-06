<script setup lang="ts">
import { toneVar, type ChartTone } from '~/utils/chart'
/** Mini-courbe sans axes (tendance). Point final marqué. Décorative pour les lecteurs d'écran sauf si `label` est fourni. */
const props = withDefaults(defineProps<{ values: number[]; tone?: ChartTone; width?: number; height?: number; label?: string }>(), { width: 96, height: 28, tone: 1 })
const geo = computed(() => {
  const v = props.values.length ? props.values : [0]
  const lo = Math.min(...v), hi = Math.max(...v)
  const span = hi - lo || 1
  const pad = 3
  const pts = v.map((y, i) => [pad + (v.length === 1 ? (props.width - pad * 2) / 2 : (i / (v.length - 1)) * (props.width - pad * 2)), props.height - pad - ((y - lo) / span) * (props.height - pad * 2)] as const)
  return { d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''), last: pts[pts.length - 1]! }
})
const color = computed(() => toneVar(props.tone))
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" :role="label ? 'img' : 'presentation'" :aria-label="label" :aria-hidden="label ? undefined : true" class="shrink-0 overflow-visible">
    <path :d="geo.d" fill="none" :stroke="color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle :cx="geo.last[0]" :cy="geo.last[1]" r="3" :fill="color" stroke="var(--surface)" stroke-width="1.5" />
  </svg>
</template>
