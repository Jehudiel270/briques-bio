<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
/**
 * Choix unique. `options` : { value, label, hint?, icon?, disabled? }. `variant="cards"` → grandes cartes sélectionnables
 * (utile pour choisir un rôle, un mode de paiement…). `inline` aligne les puces sur une ligne.
 */
type Opt = { value: string; label: string; hint?: string; icon?: string; disabled?: boolean }
const model = defineModel<string | null | undefined>()
withDefaults(defineProps<{ options: Opt[]; variant?: 'list' | 'cards'; inline?: boolean; label?: string; touch?: boolean }>(), { variant: 'list' })
</script>

<template>
  <RadioGroupRoot v-model="model" :aria-label="label" class="gap-2" :class="[variant === 'cards' ? 'grid sm:grid-cols-2' : inline ? 'flex flex-wrap gap-x-5' : 'flex flex-col']">
    <RadioGroupItem
      v-for="o in options"
      :key="o.value"
      :value="o.value"
      :disabled="o.disabled"
      class="group text-left outline-none data-[disabled]:opacity-50"
      :class="
        variant === 'cards'
          ? 'flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-muted/70 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:ring-1 data-[state=checked]:ring-primary'
          : 'flex items-start gap-2.5'
      "
      :style="touch ? { minHeight: '2.75rem' } : undefined"
    >
      <span v-if="variant === 'cards' && o.icon" class="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-ink">
        <Icon :name="o.icon.includes(':') ? o.icon : `lucide:${o.icon}`" class="size-4.5" aria-hidden="true" />
      </span>
      <span v-else class="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-line bg-surface group-data-[state=checked]:border-primary">
        <RadioGroupIndicator class="size-2 rounded-full bg-primary" />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-medium text-ink">{{ o.label }}</span>
        <span v-if="o.hint" class="mt-0.5 block text-[13px] text-muted">{{ o.hint }}</span>
      </span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
