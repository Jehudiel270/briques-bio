<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
/** Case à cocher avec libellé (slot par défaut ou prop `label`) et aide. */
const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string; hint?: string; disabled?: boolean; id?: string; touch?: boolean }>()
const uid = useId()
</script>

<template>
  <div class="flex items-start gap-2.5" :class="touch && 'min-h-11 items-center'">
    <CheckboxRoot
      :id="id ?? `cb-${uid}`"
      v-model="model"
      :disabled="disabled"
      class="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-xs border border-line bg-surface outline-none transition-colors hover:border-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[disabled]:opacity-50"
      :class="touch && 'size-6'"
    >
      <CheckboxIndicator><Icon name="lucide:check" class="size-3.5 text-primary-ink" aria-hidden="true" /></CheckboxIndicator>
    </CheckboxRoot>
    <label :for="id ?? `cb-${uid}`" class="min-w-0 cursor-pointer text-sm leading-snug text-ink" :class="disabled && 'opacity-60'">
      <slot>{{ label }}</slot>
      <span v-if="hint" class="mt-0.5 block text-[13px] text-muted">{{ hint }}</span>
    </label>
  </div>
</template>
