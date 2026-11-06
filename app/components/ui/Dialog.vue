<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
/** Boîte de dialogue modale. `v-model:open`. Slots : default (corps), footer (actions). `scroll` limite la hauteur et fait défiler le corps. */
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(defineProps<{ title: string; description?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; hideClose?: boolean; dismissable?: boolean }>(), { size: 'md', dismissable: true })
const width = computed(() => ({ sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' })[props.size])
function guard(e: Event) { if (!props.dismissable) e.preventDefault() }
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[120] bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.15s_ease-out]" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-[121] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-[var(--shadow)] outline-none data-[state=open]:animate-[dialog-in_0.18s_ease-out]"
        :class="width"
        @interact-outside="guard"
        @escape-key-down="guard"
      >
        <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div class="min-w-0">
            <DialogTitle class="font-display text-lg font-semibold leading-snug text-ink">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-muted">{{ description }}</DialogDescription>
            <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>
          </div>
          <DialogClose v-if="!hideClose" as-child>
            <UiButton variant="ghost" size="sm" icon="x" icon-only aria-label="Fermer" class="-mr-2 -mt-1" />
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4"><slot /></div>
        <footer v-if="$slots.footer" class="flex flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:justify-end"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
