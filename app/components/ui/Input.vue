<script setup lang="ts">
/** Champ de saisie. `v-model` ; `icon` (Lucide, à gauche), `prefix`/`suffix` (texte), `error` (message). */
const model = defineModel<string | number | null | undefined>()
const props = withDefaults(
  defineProps<{
    type?: string
    icon?: string
    prefix?: string
    suffix?: string
    error?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    id?: string
    name?: string
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'search' | 'url'
    min?: number | string
    max?: number | string
    step?: number | string
    maxlength?: number
    size?: 'sm' | 'md' | 'lg'
    touch?: boolean
  }>(),
  { type: 'text', size: 'md' },
)
const emit = defineEmits<{ blur: [e: FocusEvent]; focus: [e: FocusEvent]; enter: [e: KeyboardEvent] }>()
const el = ref<HTMLInputElement>()
defineExpose({ focus: () => el.value?.focus(), el })

const height = computed(() => (props.touch ? 'h-12 text-base' : props.size === 'sm' ? 'h-8 text-[13px]' : props.size === 'lg' ? 'h-11 text-[15px]' : 'h-9 text-sm'))
function onInput(e: Event) {
  const t = e.target as HTMLInputElement
  if (props.type === 'number') model.value = t.value === '' ? null : Number(t.value)
  else model.value = t.value
}
</script>

<template>
  <div
    class="group flex w-full items-center rounded-md border bg-surface text-ink transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25"
    :class="[height, error ? 'border-danger ring-2 ring-danger/20' : 'border-line hover:border-muted/60', disabled && 'opacity-55', readonly && 'bg-surface-2']"
  >
    <Icon v-if="icon" :name="icon.includes(':') ? icon : `lucide:${icon}`" class="ml-2.5 size-4 shrink-0 text-muted" aria-hidden="true" />
    <span v-if="prefix" class="pl-2.5 text-muted">{{ prefix }}</span>
    <input
      :id="id"
      ref="el"
      :name="name"
      :type="type"
      :value="model ?? ''"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      :min="min"
      :max="max"
      :step="step"
      :maxlength="maxlength"
      :aria-invalid="error ? true : undefined"
      class="h-full min-w-0 flex-1 rounded-[inherit] bg-transparent px-2.5 outline-none placeholder:text-muted/70 focus-visible:outline-none"
      :class="[type === 'number' && 'tnum', icon && 'pl-2']"
      @input="onInput"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
      @keydown.enter="emit('enter', $event)"
    />
    <span v-if="suffix" class="pr-2.5 text-muted">{{ suffix }}</span>
    <slot name="trailing" />
  </div>
</template>
