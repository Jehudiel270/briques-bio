<script setup lang="ts">
/**
 * Bouton. `to` → lien interne (NuxtLink), `href` → lien externe.
 * Props en plus du contrat : `iconOnly` (+ `ariaLabel`), `disabled`, `touch` (cible ≥ 44 px).
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent'
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    iconRight?: string
    loading?: boolean
    to?: string
    href?: string
    block?: boolean
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    iconOnly?: boolean
    ariaLabel?: string
    touch?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)

const NuxtLink = resolveComponent('NuxtLink')
const tag = computed(() => (props.to ? NuxtLink : props.href ? 'a' : 'button'))
const inert = computed(() => props.disabled || props.loading)

const variants: Record<string, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary/90 border border-transparent',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-2/60 border border-line',
  outline: 'bg-transparent text-ink hover:bg-surface-2 border border-line',
  ghost: 'bg-transparent text-ink hover:bg-surface-2 border border-transparent',
  danger: 'bg-danger text-danger-ink hover:bg-danger/90 border border-transparent',
  accent: 'bg-accent text-accent-ink hover:bg-accent/90 border border-transparent',
}
const sizes = computed(() => {
  const t = props.touch
  const map = {
    sm: props.iconOnly ? 'size-8 text-sm' : 'h-8 px-3 text-[13px] gap-1.5',
    md: props.iconOnly ? 'size-9 text-sm' : 'h-9 px-3.5 text-sm gap-2',
    lg: props.iconOnly ? 'size-11 text-base' : 'h-11 px-5 text-[15px] gap-2.5',
  }
  return t ? `${map[props.size]} min-h-11 ${props.iconOnly ? 'min-w-11' : ''}` : map[props.size]
})
const iconSize = computed(() => (props.size === 'lg' ? 'size-5' : 'size-4'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? inert : undefined"
    :aria-disabled="inert || undefined"
    :aria-busy="loading || undefined"
    :aria-label="ariaLabel"
    :tabindex="tag !== 'button' && inert ? -1 : undefined"
    class="relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-[background-color,transform,opacity] duration-150 active:translate-y-px"
    :class="[variants[variant], sizes, block && 'w-full', inert && 'pointer-events-none opacity-55']"
  >
    <Icon v-if="loading" name="lucide:loader-circle" class="animate-spin" :class="iconSize" aria-hidden="true" />
    <Icon v-else-if="icon" :name="icon.includes(':') ? icon : `lucide:${icon}`" :class="iconSize" aria-hidden="true" />
    <span v-if="!iconOnly" class="truncate"><slot /></span>
    <Icon v-if="iconRight && !iconOnly" :name="iconRight.includes(':') ? iconRight : `lucide:${iconRight}`" :class="iconSize" aria-hidden="true" />
  </component>
</template>
