<script setup lang="ts">
import { compact, niceMax, ticks, toneVar, type ChartTone } from '~/utils/chart'
/**
 * Barres verticales ou horizontales, simples (`data`) ou multi-séries (`series` + `labels`), empilées (`stacked`) ou groupées.
 * Marques fines, extrémité arrondie ancrée à la base, 2 px d'écart entre segments, grille discrète, infobulle au survol/focus,
 * légende dès 2 séries, vue « tableau » en repli (lecteurs d'écran et daltonisme).
 */
const props = withDefaults(
  defineProps<{
    data?: { label: string; value: number; tone?: ChartTone }[]
    series?: { name: string; values: number[]; tone?: ChartTone }[]
    labels?: string[]
    stacked?: boolean
    horizontal?: boolean
    unit?: string
    height?: number
    showValues?: boolean
    title?: string
    format?: (n: number) => string
  }>(),
  { height: 220 },
)
const fmt = (n: number) => (props.format ? props.format(n) : props.unit ? `${num(n)} ${props.unit}` : num(n))

const cats = computed(() => (props.series ? (props.labels ?? []) : (props.data ?? []).map((d) => d.label)))
const sers = computed(() =>
  props.series ?? [{ name: props.title ?? 'Valeur', values: (props.data ?? []).map((d) => d.value), tone: undefined as ChartTone | undefined }],
)
const single = computed(() => !props.series)
const colorOf = (si: number, ci: number) => (single.value ? toneVar(props.data?.[ci]?.tone, 0) : toneVar(sers.value[si]?.tone, si))
const totals = computed(() => cats.value.map((_, ci) => sers.value.reduce((a, s) => a + (s.values[ci] ?? 0), 0)))
const max = computed(() => {
  const m = props.stacked ? Math.max(0, ...totals.value) : Math.max(0, ...sers.value.flatMap((s) => s.values))
  return niceMax(m)
})
const gridTicks = computed(() => ticks(max.value, 4))
const active = ref<{ ci: number; si?: number } | null>(null)
const pctOf = (v: number) => `${Math.max(0, (v / max.value) * 100)}%`
const hasLegend = computed(() => sers.value.length > 1)
const summary = computed(() => cats.value.map((c, ci) => `${c} : ${sers.value.map((s) => `${sers.value.length > 1 ? s.name + ' ' : ''}${fmt(s.values[ci] ?? 0)}`).join(', ')}`).join(' ; '))
</script>

<template>
  <figure class="min-w-0">
    <figcaption v-if="title" class="mb-2 text-[13px] font-medium text-muted">{{ title }}</figcaption>
    <div role="img" :aria-label="`${title ?? 'Graphique en barres'}. ${summary}`">
      <!-- Horizontal -->
      <ul v-if="horizontal" class="flex flex-col gap-2.5">
        <li v-for="(c, ci) in cats" :key="c" class="grid grid-cols-[minmax(5rem,32%)_1fr_auto] items-center gap-3 text-[13px]" @mouseenter="active = { ci }" @mouseleave="active = null">
          <span class="truncate text-ink" :title="c">{{ c }}</span>
          <span class="flex flex-col gap-1">
            <span v-if="stacked || sers.length === 1" class="relative flex h-3 overflow-hidden rounded-r-[4px] rounded-l-[2px] bg-surface-2/70">
              <span
                v-for="(s, si) in sers"
                :key="si"
                class="h-full border-r-2 border-surface transition-opacity last:border-r-0"
                :class="active && active.ci !== ci && 'opacity-45'"
                :style="{ width: pctOf(s.values[ci] ?? 0), background: colorOf(si, ci) }"
              />
            </span>
            <template v-else>
              <span v-for="(s, si) in sers" :key="si" class="relative flex h-2.5 overflow-hidden rounded-r-[4px] rounded-l-[2px] bg-surface-2/70">
                <span class="h-full transition-opacity" :class="active && active.ci !== ci && 'opacity-45'" :style="{ width: pctOf(s.values[ci] ?? 0), background: colorOf(si, ci) }" />
              </span>
            </template>
          </span>
          <span class="tnum w-20 text-right text-muted">{{ stacked || sers.length === 1 ? fmt(totals[ci] ?? 0) : sers.map((x) => fmt(x.values[ci] ?? 0)).join(' · ') }}</span>
        </li>
      </ul>

      <!-- Vertical -->
      <div v-else class="relative" :style="{ height: `${height}px`, paddingLeft: '2.75rem', paddingBottom: '1.75rem' }">
        <div class="absolute inset-y-0 left-0 right-0 bottom-7 left-11" aria-hidden="true">
          <div v-for="t in gridTicks" :key="t" class="absolute inset-x-0 border-t border-line/70" :style="{ bottom: pctOf(t) }">
            <span class="tnum absolute -left-11 w-10 -translate-y-1/2 pr-1 text-right text-[11px] text-muted">{{ compact(t) }}</span>
          </div>
        </div>
        <div class="absolute inset-y-0 bottom-7 left-11 right-0 flex items-end gap-1.5 sm:gap-2.5" :style="{ bottom: '1.75rem', left: '2.75rem' }">
          <div v-for="(c, ci) in cats" :key="c" class="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" tabindex="0" :aria-label="`${c} : ${sers.map((s) => fmt(s.values[ci] ?? 0)).join(', ')}`" @mouseenter="active = { ci }" @mouseleave="active = null" @focus="active = { ci }" @blur="active = null">
            <template v-if="stacked">
              <div class="flex w-full max-w-9 flex-col-reverse justify-start" :style="{ height: pctOf(totals[ci] ?? 0) }">
                <span
                  v-for="(s, si) in sers"
                  :key="si"
                  class="block w-full border-t-2 border-surface first:border-t-0 first:rounded-b-none last:rounded-t-[4px]"
                  :class="active && active.ci !== ci && 'opacity-45'"
                  :style="{ height: `${((s.values[ci] ?? 0) / (totals[ci] || 1)) * 100}%`, background: colorOf(si, ci) }"
                />
              </div>
            </template>
            <template v-else>
              <span
                v-for="(s, si) in sers"
                :key="si"
                class="block w-full max-w-9 rounded-t-[4px] transition-[opacity,height] duration-300"
                :class="active && active.ci !== ci && 'opacity-45'"
                :style="{ height: pctOf(s.values[ci] ?? 0), background: colorOf(si, ci) }"
              />
            </template>
            <span v-if="showValues" class="tnum absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] text-ink" :style="{ bottom: `calc(${pctOf(totals[ci] ?? 0)} + 2px)`, top: 'auto' }">{{ compact(totals[ci] ?? 0) }}</span>
            <span class="absolute -bottom-6 left-1/2 w-full -translate-x-1/2 truncate text-center text-[11px] text-muted">{{ c }}</span>
            <div v-if="active?.ci === ci" class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow)]" role="tooltip">
              <p class="font-medium text-ink">{{ c }}</p>
              <p v-for="(s, si) in sers" :key="si" class="tnum flex items-center gap-1.5 text-muted">
                <span class="size-2 rounded-[2px]" :style="{ background: colorOf(si, ci) }" aria-hidden="true" />{{ sers.length > 1 ? `${s.name} : ` : '' }}{{ fmt(s.values[ci] ?? 0) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ChartLegend v-if="hasLegend" class="mt-3" :items="sers.map((s, i) => ({ label: s.name, tone: s.tone ?? ((i + 1) as ChartTone) }))" />
    <details class="mt-2 text-[13px] text-muted">
      <summary class="cursor-pointer select-none hover:text-ink">Voir les données</summary>
      <table class="tnum mt-2 w-full text-left">
        <thead><tr><th class="py-1 pr-3 font-medium" scope="col">Catégorie</th><th v-for="s in sers" :key="s.name" class="py-1 pr-3 text-right font-medium" scope="col">{{ s.name }}</th></tr></thead>
        <tbody><tr v-for="(c, ci) in cats" :key="c" class="border-t border-line/60"><th class="py-1 pr-3 font-normal text-ink" scope="row">{{ c }}</th><td v-for="(s, si) in sers" :key="si" class="py-1 pr-3 text-right">{{ fmt(s.values[ci] ?? 0) }}</td></tr></tbody>
      </table>
    </details>
  </figure>
</template>
