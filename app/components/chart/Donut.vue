<script setup lang="ts">
import { toneVar, type ChartTone } from '~/utils/chart'
/**
 * Anneau (répartition d'un total, ≤ 5 parts). `center` : texte central (ex. « 12,4 t »). Écart de 2 px entre parts,
 * légende détaillée à côté (valeur + %), vue « tableau » en repli. Une part « Autres » prend la teinte neutre.
 */
const props = withDefaults(
  defineProps<{ data: { label: string; value: number; tone?: ChartTone }[]; center?: string; centerLabel?: string; size?: number; unit?: string; title?: string }>(),
  { size: 168 },
)
const total = computed(() => props.data.reduce((a, d) => a + Math.max(0, d.value), 0))
const R = 62, SW = 22, C = 2 * Math.PI * R
const segs = computed(() => {
  let acc = 0
  const gap = props.data.filter((d) => d.value > 0).length > 1 ? 2.2 : 0
  return props.data.map((d, i) => {
    const frac = total.value ? Math.max(0, d.value) / total.value : 0
    const len = Math.max(0, frac * C - gap)
    const seg = { i, label: d.label, value: d.value, pct: Math.round(frac * 1000) / 10, color: toneVar(d.tone ?? (d.label.toLowerCase().startsWith('autre') ? 'neutral' : undefined), i), dash: `${len} ${C - len}`, offset: -acc * C }
    acc += frac
    return seg
  })
})
const active = ref<number | null>(null)
const fmt = (n: number) => (props.unit ? `${num(n)} ${props.unit}` : num(n))
const summary = computed(() => segs.value.map((s) => `${s.label} : ${fmt(s.value)} (${s.pct} %)`).join(' ; '))
</script>

<template>
  <figure class="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-4">
    <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg viewBox="0 0 160 160" class="size-full -rotate-90" role="img" :aria-label="`${title ?? 'Répartition'}. ${summary}`">
        <circle cx="80" cy="80" :r="R" fill="none" stroke="var(--surface-2)" :stroke-width="SW" />
        <circle
          v-for="s in segs"
          :key="s.i"
          cx="80" cy="80" :r="R" fill="none"
          :stroke="s.color"
          :stroke-width="active === s.i ? SW + 4 : SW"
          :stroke-dasharray="s.dash"
          :stroke-dashoffset="s.offset"
          class="transition-[stroke-width,opacity] duration-150"
          :class="active != null && active !== s.i && 'opacity-40'"
          @mouseenter="active = s.i"
          @mouseleave="active = null"
        />
      </svg>
      <div class="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p class="tnum font-display text-xl font-semibold leading-none text-ink">{{ active != null ? `${segs[active]!.pct} %` : (center ?? fmt(total)) }}</p>
          <p class="mt-1 max-w-[6rem] text-[11px] leading-tight text-muted">{{ active != null ? segs[active]!.label : (centerLabel ?? 'Total') }}</p>
        </div>
      </div>
    </div>
    <div class="min-w-48 flex-1">
      <ChartLegend :items="segs.map((s) => ({ label: s.label, tone: data[s.i]?.tone ?? ((s.i + 1) as ChartTone), value: `${fmt(s.value)} · ${s.pct} %` }))" vertical :active="active" @hover="active = $event" />
      <details class="mt-3 text-[13px] text-muted">
        <summary class="cursor-pointer select-none hover:text-ink">Voir les données</summary>
        <table class="tnum mt-2 w-full text-left">
          <thead><tr><th class="py-1 pr-3 font-medium" scope="col">Part</th><th class="py-1 pr-3 text-right font-medium" scope="col">Valeur</th><th class="py-1 text-right font-medium" scope="col">%</th></tr></thead>
          <tbody><tr v-for="s in segs" :key="s.i" class="border-t border-line/60"><th class="py-1 pr-3 font-normal text-ink" scope="row">{{ s.label }}</th><td class="py-1 pr-3 text-right">{{ fmt(s.value) }}</td><td class="py-1 text-right">{{ s.pct }}</td></tr></tbody>
        </table>
      </details>
    </div>
  </figure>
</template>
