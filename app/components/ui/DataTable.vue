<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * Tableau de données : recherche (sans accents), filtres, tri, pagination et export CSV réellement fonctionnels.
 *
 * Colonnes : { key, label, sortable?, align?, width?, hide?, value?, sortValue? }
 *  - `hide: 'sm'|'md'|'lg'` : la colonne n'est affichée qu'à partir de ce point de rupture.
 *  - `value(row)` : valeur affichée par défaut, utilisée aussi pour la recherche, le tri et l'export CSV.
 * Slots : `cell-<key>` { row, value } · `actions` { row } (colonne finale) · `toolbar` · `empty` · `card` { row } (rendu < 640 px).
 * Événement : `row-click(row)` (rend les lignes cliquables et accessibles au clavier).
 */
export interface Column<R = any> {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  hide?: 'sm' | 'md' | 'lg'
  value?: (row: R) => string | number | null | undefined
  sortValue?: (row: R) => string | number
}
export interface TableFilter<R = any> {
  key: string
  label: string
  options: { value: string; label: string }[]
  accessor: (row: R) => string | string[] | undefined | null
}

const props = withDefaults(
  defineProps<{
    rows: T[]
    columns: Column<T>[]
    rowKey?: string
    searchable?: boolean
    searchText?: (row: T) => string
    filters?: TableFilter<T>[]
    pageSize?: number
    initialSort?: { key: string; dir: 'asc' | 'desc' }
    loading?: boolean
    dense?: boolean
    exportName?: string
    emptyTitle?: string
    emptyHint?: string
    searchPlaceholder?: string
  }>(),
  { rowKey: 'id', searchable: true, pageSize: 10, emptyTitle: 'Aucun résultat', emptyHint: 'Modifiez la recherche ou les filtres.' },
)
const emit = defineEmits<{ 'row-click': [row: T] }>()
const slots = useSlots()
const instance = getCurrentInstance()
const clickable = computed(() => !!instance?.vnode.props && ('onRowClick' in instance.vnode.props || 'onRow-click' in instance.vnode.props))

const query = ref('')
const filterValues = reactive<Record<string, string>>({})
const sort = ref<{ key: string; dir: 'asc' | 'desc' } | null>(props.initialSort ?? null)
const page = ref(1)

const cellValue = (row: T, col: Column<T>) => (col.value ? col.value(row) : (row as any)[col.key])

function defaultSearchText(row: T): string {
  const out: string[] = []
  for (const v of Object.values(row)) {
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v))
  }
  for (const c of props.columns) {
    const v = c.value?.(row)
    if (v != null) out.push(String(v))
  }
  return out.join(' ')
}

const filtered = computed(() => {
  const q = norm(query.value.trim())
  const active = Object.entries(filterValues).filter(([, v]) => v)
  return props.rows.filter((row) => {
    for (const [key, val] of active) {
      const f = props.filters?.find((x) => x.key === key)
      if (!f) continue
      const a = f.accessor(row)
      const list = Array.isArray(a) ? a : a == null ? [] : [a]
      if (!list.includes(val)) return false
    }
    if (!q) return true
    return norm((props.searchText ?? defaultSearchText)(row)).includes(q)
  })
})

const sorted = computed(() => {
  const s = sort.value
  if (!s) return filtered.value
  const col = props.columns.find((c) => c.key === s.key)
  if (!col) return filtered.value
  const get = (r: T) => (col.sortValue ? col.sortValue(r) : cellValue(r, col)) as string | number | null | undefined
  const dir = s.dir === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const x = get(a)
    const y = get(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
    return String(x).localeCompare(String(y), 'fr', { numeric: true, sensitivity: 'base' }) * dir
  })
})

const paged = computed(() => sorted.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize))
watch([query, filterValues, () => props.rows.length], () => { page.value = 1 }, { deep: true })

function toggleSort(col: Column<T>) {
  if (!col.sortable) return
  const s = sort.value
  if (!s || s.key !== col.key) sort.value = { key: col.key, dir: 'asc' }
  else if (s.dir === 'asc') sort.value = { key: col.key, dir: 'desc' }
  else sort.value = null
}
const ariaSort = (col: Column<T>) => (sort.value?.key === col.key ? (sort.value.dir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined)

const hideCls = (c: Column<T>) => (c.hide === 'sm' ? 'max-sm:hidden' : c.hide === 'md' ? 'max-md:hidden' : c.hide === 'lg' ? 'max-lg:hidden' : '')
const alignCls = (c: Column<T>) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')
const keyOf = (row: T, i: number) => String((row as any)[props.rowKey] ?? i)
const hasFilters = computed(() => !!props.filters?.length)
const filtering = computed(() => !!query.value.trim() || Object.values(filterValues).some(Boolean))
function reset() {
  query.value = ''
  for (const k of Object.keys(filterValues)) filterValues[k] = ''
}

function exportCsv() {
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [props.columns.map((c) => esc(c.label)).join(';')]
  for (const row of sorted.value) lines.push(props.columns.map((c) => esc(cellValue(row, c))).join(';'))
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.exportName ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const pad = computed(() => (props.dense ? 'px-3 py-1.5' : 'px-3.5 py-2.5'))
const hasActions = computed(() => !!slots.actions)
function onKey(e: KeyboardEvent, row: T) {
  if (clickable.value && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    emit('row-click', row)
  }
}
</script>

<template>
  <div class="card min-w-0 overflow-hidden">
    <!-- Barre d'outils -->
    <div v-if="searchable || hasFilters || exportName || $slots.toolbar" class="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div v-if="searchable" class="min-w-0 sm:w-72"><UiSearch v-model="query" :placeholder="searchPlaceholder ?? 'Rechercher…'" size="sm" /></div>
      <div v-if="hasFilters" class="flex flex-wrap gap-2">
        <div v-for="f in filters" :key="f.key" class="w-40">
          <UiSelect
            :model-value="filterValues[f.key] ?? ''"
            :options="[{ value: '', label: f.label }, ...f.options]"
            size="sm"
            :aria-label="`Filtrer : ${f.label}`"
            @update:model-value="filterValues[f.key] = String($event ?? '')"
          />
        </div>
      </div>
      <UiButton v-if="filtering" variant="ghost" size="sm" icon="filter-x" @click="reset">Réinitialiser</UiButton>
      <div class="flex flex-1 items-center justify-end gap-2">
        <slot name="toolbar" />
        <UiButton v-if="exportName" variant="outline" size="sm" icon="download" :disabled="!sorted.length" @click="exportCsv">Exporter en CSV</UiButton>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="space-y-2 p-4" aria-busy="true"><UiSkeleton v-for="i in 5" :key="i" height="2.25rem" /></div>

    <template v-else-if="sorted.length">
      <!-- Tableau (≥ 640 px) -->
      <div class="scroll-x max-sm:hidden">
        <table class="w-full border-collapse text-sm">
          <thead class="bg-surface-2/60">
            <tr>
              <th
                v-for="c in columns"
                :key="c.key"
                scope="col"
                class="whitespace-nowrap border-b border-line text-[12px] font-semibold text-muted"
                :class="[pad, hideCls(c), alignCls(c)]"
                :style="c.width ? { width: c.width } : undefined"
                :aria-sort="ariaSort(c)"
              >
                <button v-if="c.sortable" type="button" class="inline-flex items-center gap-1 rounded-sm hover:text-ink" :class="c.align === 'right' && 'flex-row-reverse'" @click="toggleSort(c)">
                  {{ c.label }}
                  <Icon
                    :name="sort?.key === c.key ? (sort.dir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down') : 'lucide:arrow-up-down'"
                    class="size-3"
                    :class="sort?.key === c.key ? 'text-primary' : 'opacity-45'"
                    aria-hidden="true"
                  />
                </button>
                <template v-else>{{ c.label }}</template>
              </th>
              <th v-if="hasActions" scope="col" class="border-b border-line" :class="pad"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in paged"
              :key="keyOf(row, i)"
              class="border-b border-line/70 last:border-0 transition-colors"
              :class="clickable && 'cursor-pointer hover:bg-surface-2/50 focus-visible:bg-surface-2/50'"
              :tabindex="clickable ? 0 : undefined"
              @click="clickable && emit('row-click', row)"
              @keydown="onKey($event, row)"
            >
              <td v-for="c in columns" :key="c.key" class="align-middle text-ink" :class="[pad, hideCls(c), alignCls(c), c.align === 'right' && 'tnum']">
                <slot :name="`cell-${c.key}`" :row="row" :value="cellValue(row, c)">{{ cellValue(row, c) ?? '—' }}</slot>
              </td>
              <td v-if="hasActions" class="whitespace-nowrap text-right" :class="pad" @click.stop><slot name="actions" :row="row" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cartes (< 640 px) -->
      <ul class="divide-y divide-line sm:hidden">
        <li
          v-for="(row, i) in paged"
          :key="keyOf(row, i)"
          class="p-3.5"
          :class="clickable && 'active:bg-surface-2/60'"
          :tabindex="clickable ? 0 : undefined"
          @click="clickable && emit('row-click', row)"
          @keydown="onKey($event, row)"
        >
          <slot name="card" :row="row">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 font-medium text-ink">
                  <slot :name="`cell-${columns[0]?.key}`" :row="row" :value="cellValue(row, columns[0]!)">{{ cellValue(row, columns[0]!) ?? '—' }}</slot>
                </div>
                <div v-if="hasActions" @click.stop><slot name="actions" :row="row" /></div>
              </div>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <template v-for="c in columns.slice(1)" :key="c.key">
                  <div class="min-w-0">
                    <dt class="text-[11px] text-muted">{{ c.label }}</dt>
                    <dd class="truncate text-ink"><slot :name="`cell-${c.key}`" :row="row" :value="cellValue(row, c)">{{ cellValue(row, c) ?? '—' }}</slot></dd>
                  </div>
                </template>
              </dl>
            </div>
          </slot>
        </li>
      </ul>

      <div class="border-t border-line p-3"><UiPagination v-model:page="page" :total="sorted.length" :page-size="pageSize" /></div>
    </template>

    <slot v-else name="empty">
      <UiEmpty :icon="filtering ? 'search-x' : 'inbox'" :title="emptyTitle" :hint="filtering ? 'Aucune ligne ne correspond à la recherche ou aux filtres.' : emptyHint" compact>
        <UiButton v-if="filtering" variant="outline" size="sm" icon="filter-x" @click="reset">Réinitialiser les filtres</UiButton>
      </UiEmpty>
    </slot>
  </div>
</template>
