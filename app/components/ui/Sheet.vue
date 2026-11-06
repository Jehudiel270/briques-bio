<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
/** Tiroir latéral (ou bas d'écran). `v-model:open`, `side` right|left|bottom, `title`. Slots : default, footer. */
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(defineProps<{ title: string; description?: string; side?: 'right' | 'left' | 'bottom'; width?: string }>(), { side: 'right', width: '26rem' })
const pos = computed(() => ({
  right: 'inset-y-0 right-0 h-dvh w-[min(100vw,var(--sheet-w))] border-l data-[state=open]:animate-[sheet-right_0.22s_ease-out]',
  left: 'inset-y-0 left-0 h-dvh w-[min(100vw,var(--sheet-w))] border-r data-[state=open]:animate-[sheet-left_0.22s_ease-out]',
  bottom: 'inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-2xl border-t data-[state=open]:animate-[sheet-bottom_0.22s_ease-out]',
})[props.side])
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[120] bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.15s_ease-out]" />
      <DialogContent class="fixed z-[121] flex flex-col border-line bg-surface shadow-[var(--shadow)] outline-none" :class="pos" :style="{ '--sheet-w': width }">
        <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div class="min-w-0">
            <DialogTitle class="font-display text-lg font-semibold leading-snug text-ink">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-muted">{{ description }}</DialogDescription>
            <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>
          </div>
          <DialogClose as-child><UiButton variant="ghost" size="sm" icon="x" icon-only aria-label="Fermer" class="-mr-2 -mt-1" /></DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4"><slot /></div>
        <footer v-if="$slots.footer" class="flex gap-2 border-t border-line px-5 py-3.5"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
