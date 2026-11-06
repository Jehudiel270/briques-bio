<script setup lang="ts">
/** Pagination. `v-model:page` (1-based), `total` (nombre de lignes), `pageSize`. */
const page = defineModel<number>('page', { default: 1 })
const props = withDefaults(defineProps<{ total: number; pageSize?: number; compact?: boolean }>(), { pageSize: 10 })
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total === 0 ? 0 : (page.value - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.total, page.value * props.pageSize))
const window = computed(() => {
  const n = pages.value
  const cur = page.value
  const set = new Set([1, n, cur, cur - 1, cur + 1])
  const list = [...set].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  list.forEach((p, i) => {
    if (i && p - list[i - 1]! > 1) out.push('…')
    out.push(p)
  })
  return out
})
watch(pages, (n) => { if (page.value > n) page.value = n })
</script>

<template>
  <nav v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted" aria-label="Pagination">
    <p class="tnum">{{ from }}–{{ to }} sur {{ num(total) }}</p>
    <div v-if="pages > 1" class="flex items-center gap-1">
      <UiButton variant="ghost" size="sm" icon="chevron-left" icon-only aria-label="Page précédente" :disabled="page <= 1" @click="page--" />
      <template v-if="!compact">
        <template v-for="(p, i) in window" :key="i">
          <span v-if="p === '…'" class="px-1">…</span>
          <button
            v-else
            type="button"
            class="tnum h-8 min-w-8 rounded-md px-2 text-[13px] transition-colors"
            :class="p === page ? 'bg-primary font-semibold text-primary-ink' : 'text-ink hover:bg-surface-2'"
            :aria-current="p === page ? 'page' : undefined"
            @click="page = p"
          >{{ p }}</button>
        </template>
      </template>
      <span v-else class="tnum px-2 text-ink">{{ page }} / {{ pages }}</span>
      <UiButton variant="ghost" size="sm" icon="chevron-right" icon-only aria-label="Page suivante" :disabled="page >= pages" @click="page++" />
    </div>
  </nav>
</template>
