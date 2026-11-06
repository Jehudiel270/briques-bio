<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
/**
 * Menu déroulant. Slot par défaut = déclencheur (un seul élément, ex. <UiButton>).
 * `items` : { label, icon?, onSelect?, to?, danger?, divider?, heading?, disabled? }. Le slot `header` s'affiche en tête du menu.
 */
export interface DropdownItem {
  label?: string
  icon?: string
  onSelect?: () => void
  to?: string
  danger?: boolean
  divider?: boolean
  heading?: string
  disabled?: boolean
}
withDefaults(defineProps<{ items: DropdownItem[]; align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom'; width?: string }>(), { align: 'end', side: 'bottom' })
const router = useRouter()
function select(it: DropdownItem) {
  if (it.to) router.push(it.to)
  it.onSelect?.()
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child><slot /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align"
        :side="side"
        :side-offset="6"
        class="z-[90] max-h-[70vh] min-w-52 overflow-y-auto rounded-lg border border-line bg-surface p-1 text-sm text-ink shadow-[var(--shadow)]"
        :style="width ? { width } : undefined"
      >
        <slot name="header" />
        <template v-for="(it, i) in items" :key="i">
          <DropdownMenuSeparator v-if="it.divider" class="-mx-1 my-1 h-px bg-line" />
          <DropdownMenuLabel v-else-if="it.heading" class="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ it.heading }}</DropdownMenuLabel>
          <DropdownMenuItem
            v-else
            :disabled="it.disabled"
            class="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
            :class="it.danger && 'text-danger'"
            @select="select(it)"
          >
            <Icon v-if="it.icon" :name="it.icon.includes(':') ? it.icon : `lucide:${it.icon}`" class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{{ it.label }}</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
