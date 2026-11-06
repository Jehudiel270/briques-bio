<script setup lang="ts">
import { compact, niceMax, ticks, toneVar, type ChartTone } from '~/utils/chart'
/**
 * Courbes (aires légères pour une seule série). Ligne 2 px, repères ≥ 8 px au survol, grille discrète, un seul axe.
 * `series` : { name, points: [{ x, y }], tone? } — les séries partagent les mêmes `x` (ordre de la première).
 * Survol / clavier (←/→) : réticule + infobulle ; vue « tableau » en repli.
 */
const props = withDefaults(
  defineProps<{
    series: { name: string; points: { x: string | number; y: number }[]; tone?: ChartTone }[]
    height?: number
    unit?: string
    title?: string
    area?: boolean
    format?: (n: number) => string
  }>(),
  { height: 240 },
)
const root = ref<HTMLElement>()
const { width } = useElementSize(root)
const W = computed(() => Math.max(280, width.value || 560))
const m = { l: 44, r: 14, t: 14, b: 28 }
const innerW = computed(() => W.value - m.l - m.r)
const innerH = computed(() => props.height - m.t - m.b)
const fmt = (n: number) => (props.format ? props.format(n) : props.unit ? `${num(n)} ${props.unit}` : num(n))

const xs = computed(() => props.series[0]?.points.map((p) => p.x) ?? [])
const yMax = computed(() => niceMax(Math.max(0, ...props.series.flatMap((s) => s.points.map((p) => p.y)))))
const gridTicks = computed(() => ticks(yMax.value, 4))
const px = (i: number) => m.l + (xs.value.length <= 1 ? innerW.value / 2 : (i / (xs.value.length - 1)) * innerW.value)
const py = (v: number) => m.t + innerH.value - (v / yMax.value) * innerH.value

const paths = computed(() =>
  props.series.map((s, si) => {
    const pts = s.points.map((p, i) => [px(i), py(p.y)] as const)
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
    const areaD = pts.length ? `${d}L${pts[pts.length - 1]![0].toFixed(1)} ${(m.t + innerH.value).toFixed(1)}L${pts[0]![0].toFixed(1)} ${(m.t + innerH.value).toFixed(1)}Z` : ''
    return { d, areaD, color: toneVar(s.tone, si), pts }
  }),
)
const labelStep = computed(() => Math.max(1, Math.ceil(xs.value.length / Math.max(2, Math.floor(innerW.value / 64)))))
const active = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const n = xs.value.length
  if (!n) return
  const i = Math.round(((x - m.l) / (innerW.value || 1)) * (n - 1))
  active.value = Math.min(n - 1, Math.max(0, i))
}
function onKey(e: KeyboardEvent) {
  const n = xs.value.length
  if (!n) return
  if (e.key === 'ArrowRight') { active.value = Math.min(n - 1, (active.value ?? -1) + 1); e.preventDefault() }
  else if (e.key === 'ArrowLeft') { active.value = Math.max(0, (active.value ?? n) - 1); e.preventDefault() }
  else if (e.key === 'Escape') active.value = null
}
const tipLeft = computed(() => (active.value == null ? 0 : Math.min(W.value - 150, Math.max(4, px(active.value) + 12))))
const summary = computed(() => xs.value.map((x, i) => `${x} : ${props.series.map((s) => `${props.series.length > 1 ? s.name + ' ' : ''}${fmt(s.points[i]?.y ?? 0)}`).join(', ')}`).join(' ; '))
</script>

<template>
  <figure class="min-w-0">
    <figcaption v-if="title" class="mb-2 text-[13px] font-medium text-muted">{{ title }}</figcaption>
    <div ref="root" class="relative" :style="{ height: `${height}px` }">
      <svg
        :width="W"
        :height="height"
        class="block touch-pan-y select-none overflow-visible outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-accent"
        role="img"
        tabindex="0"
        :aria-label="`${title ?? 'Courbe'}. ${summary}`"
        @pointermove="onMove"
        @pointerleave="active = null"
        @keydown="onKey"
        @blur="active = null"
      >
        <g aria-hidden="true">
          <g v-for="t in gridTicks" :key="t">
            <line :x1="m.l" :x2="W - m.r" :y1="py(t)" :y2="py(t)" stroke="var(--border)" stroke-opacity="0.7" stroke-width="1" />
            <text :x="m.l - 8" :y="py(t) + 4" text-anchor="end" font-size="11" fill="var(--muted)" class="tnum">{{ compact(t) }}</text>
          </g>
          <template v-for="(x, i) in xs" :key="String(x)">
            <text v-if="i % labelStep === 0" :x="px(i)" :y="height - 8" text-anchor="middle" font-size="11" fill="var(--muted)">{{ x }}</text>
          </template>
          <template v-for="(p, si) in paths" :key="si">
            <path v-if="area && series.length === 1" :d="p.areaD" :fill="p.color" fill-opacity="0.12" />
            <path :d="p.d" fill="none" :stroke="p.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </template>
          <template v-if="active != null">
            <line :x1="px(active)" :x2="px(active)" :y1="m.t" :y2="m.t + innerH" stroke="var(--ink)" stroke-opacity="0.35" stroke-dasharray="3 3" />
            <template v-for="(p, si) in paths" :key="`d${si}`">
              <circle v-if="p.pts[active]" :cx="p.pts[active]![0]" :cy="p.pts[active]![1]" r="4.5" :fill="p.color" stroke="var(--surface)" stroke-width="2" />
            </template>
          </template>
          <!-- repère final, étiqueté directement -->
          <template v-if="active == null">
            <template v-for="(p, si) in paths" :key="`e${si}`">
              <circle v-if="p.pts.length" :cx="p.pts[p.pts.length - 1]![0]" :cy="p.pts[p.pts.length - 1]![1]" r="3.5" :fill="p.color" stroke="var(--surface)" stroke-width="2" />
            </template>
          </template>
        </g>
      </svg>
      <div v-if="active != null" class="pointer-events-none absolute top-2 z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow)]" :style="{ left: `${tipLeft}px` }" role="tooltip">
        <p class="font-medium text-ink">{{ xs[active] }}</p>
        <p v-for="(s, si) in series" :key="si" class="tnum flex items-center gap-1.5 whitespace-nowrap text-muted">
          <span class="size-2 rounded-[2px]" :style="{ background: toneVar(s.tone, si) }" aria-hidden="true" />{{ series.length > 1 ? `${s.name} : ` : '' }}{{ fmt(s.points[active]?.y ?? 0) }}
        </p>
      </div>
    </div>
    <ChartLegend v-if="series.length > 1" class="mt-2" :items="series.map((s, i) => ({ label: s.name, tone: s.tone ?? ((i + 1) as ChartTone) }))" />
    <details class="mt-2 text-[13px] text-muted">
      <summary class="cursor-pointer select-none hover:text-ink">Voir les données</summary>
      <table class="tnum mt-2 w-full text-left">
        <thead><tr><th class="py-1 pr-3 font-medium" scope="col">Période</th><th v-for="s in series" :key="s.name" class="py-1 pr-3 text-right font-medium" scope="col">{{ s.name }}</th></tr></thead>
        <tbody><tr v-for="(x, i) in xs" :key="String(x)" class="border-t border-line/60"><th class="py-1 pr-3 font-normal text-ink" scope="row">{{ x }}</th><td v-for="(s, si) in series" :key="si" class="py-1 pr-3 text-right">{{ fmt(s.points[i]?.y ?? 0) }}</td></tr></tbody>
      </table>
    </details>
  </figure>
</template>
