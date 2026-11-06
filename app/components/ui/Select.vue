<script setup lang="ts">
import {
  ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxPortal, ComboboxRoot, ComboboxTrigger, ComboboxViewport,
  SelectContent, SelectItem, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport,
} from 'reka-ui'

/**
 * Liste déroulante. `v-model` = valeur (string | number | null). `options` : { value, label, disabled? }.
 * La valeur vide ('' ou null) est autorisée (option « Tous »). `searchable` → champ de recherche (sans accents).
 * Props en plus du contrat : `size`, `touch`, `clearable` (searchable seulement).
 */
type Opt = { value: string | number; label: string; disabled?: boolean; hint?: string }
const model = defineModel<string | number | null | undefined>()
const props = withDefaults(
  defineProps<{ options: Opt[]; placeholder?: string; searchable?: boolean; disabled?: boolean; error?: string; id?: string; size?: 'sm' | 'md' | 'lg'; touch?: boolean }>(),
  { placeholder: 'Choisir…', size: 'md' },
)

const EMPTY = '__vide__'
const enc = (v: string | number | null | undefined) => (v === '' ? EMPTY : v == null ? undefined : String(v))
const dec = (v: unknown) => {
  const s = v == null ? '' : String(v)
  if (s === EMPTY) return ''
  const hit = props.options.find((o) => String(o.value) === s)
  return hit ? hit.value : s
}
const selectModel = computed({ get: () => enc(model.value), set: (v) => (model.value = dec(v) as any) })
const selected = computed(() => props.options.find((o) => String(o.value) === String(model.value ?? '')))

const query = ref('')
const open = ref(false)
const filtered = computed(() => {
  const q = norm(query.value)
  return q ? props.options.filter((o) => norm(o.label).includes(q)) : props.options
})
watch(open, (o) => { if (!o) query.value = '' })

const height = computed(() => (props.touch ? 'h-12 text-base' : props.size === 'sm' ? 'h-8 text-[13px]' : props.size === 'lg' ? 'h-11 text-[15px]' : 'h-9 text-sm'))
const triggerCls = computed(() => [
  'flex w-full items-center justify-between gap-2 rounded-md border bg-surface px-2.5 text-left text-ink outline-none transition-colors',
  'focus:border-primary focus:ring-2 focus:ring-primary/25 data-[state=open]:border-primary',
  props.error ? 'border-danger ring-2 ring-danger/20' : 'border-line hover:border-muted/60',
  props.disabled && 'pointer-events-none opacity-55',
  height.value,
])
const contentCls = 'z-[95] max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface text-sm text-ink shadow-[var(--shadow)]'
const itemCls = 'relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-md px-2.5 py-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2 data-[state=checked]:font-medium'
</script>

<template>
  <ComboboxRoot v-if="searchable" v-model="selectModel" v-model:open="open" :disabled="disabled" :ignore-filter="true" class="w-full">
    <ComboboxAnchor :class="triggerCls">
      <ComboboxInput
        :id="id"
        v-model="query"
        :placeholder="selected?.label ?? placeholder"
        :display-value="() => query"
        class="h-full min-w-0 flex-1 bg-transparent outline-none"
        :class="selected && !query ? 'placeholder:text-ink' : 'placeholder:text-muted/70'"
        autocomplete="off"
      />
      <ComboboxTrigger aria-label="Ouvrir la liste"><Icon name="lucide:chevrons-up-down" class="size-4 text-muted" aria-hidden="true" /></ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent :class="contentCls" position="popper" :side-offset="4">
        <ComboboxViewport class="max-h-72 overflow-y-auto p-1">
          <ComboboxEmpty class="px-3 py-3 text-center text-[13px] text-muted">Aucun résultat</ComboboxEmpty>
          <ComboboxItem v-for="o in filtered" :key="String(o.value)" :value="enc(o.value) ?? ''" :disabled="o.disabled" :class="itemCls">
            <span class="truncate">{{ o.label }}</span>
            <Icon v-if="String(model ?? '') === String(o.value)" name="lucide:check" class="size-4 text-primary" aria-hidden="true" />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>

  <SelectRoot v-else v-model="selectModel" :disabled="disabled">
    <SelectTrigger :id="id" :class="triggerCls" :aria-invalid="error ? true : undefined">
      <SelectValue :placeholder="placeholder" class="min-w-0 truncate">
        <span v-if="selected" class="truncate">{{ selected.label }}</span>
      </SelectValue>
      <Icon name="lucide:chevron-down" class="size-4 shrink-0 text-muted" aria-hidden="true" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent :class="contentCls" position="popper" :side-offset="4">
        <SelectViewport class="max-h-72 overflow-y-auto p-1">
          <SelectItem v-for="o in options" :key="String(o.value)" :value="enc(o.value) ?? ''" :disabled="o.disabled" :class="itemCls">
            <SelectItemText>{{ o.label }}</SelectItemText>
            <Icon v-if="String(model ?? '') === String(o.value)" name="lucide:check" class="size-4 text-primary" aria-hidden="true" />
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
