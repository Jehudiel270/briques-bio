<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
/** Interrupteur on/off avec libellé (slot ou prop). `ariaLabel` si pas de libellé visible. */
const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string; hint?: string; disabled?: boolean; ariaLabel?: string; id?: string }>()
const uid = useId()
</script>

<template>
  <div class="flex items-start gap-3">
    <SwitchRoot
      :id="id ?? `sw-${uid}`"
      v-model="model"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border border-line bg-surface-2 outline-none transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[disabled]:opacity-50"
    >
      <SwitchThumb class="block size-3.5 translate-x-[3px] rounded-full bg-ink/70 transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-primary-ink" />
    </SwitchRoot>
    <label v-if="label || $slots.default" :for="id ?? `sw-${uid}`" class="min-w-0 cursor-pointer text-sm leading-snug text-ink">
      <slot>{{ label }}</slot>
      <span v-if="hint" class="mt-0.5 block text-[13px] text-muted">{{ hint }}</span>
    </label>
  </div>
</template>
