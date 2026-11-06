<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle } from 'reka-ui'
const confirm = useConfirm()
const state = confirm.state
const open = computed({
  get: () => state.value.open,
  set: (v) => { if (!v && state.value.open) confirm.settle(false) },
})
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-[150] bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_0.15s_ease-out]" />
      <AlertDialogContent class="fixed left-1/2 top-1/2 z-[151] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)] outline-none">
        <div class="flex gap-3.5">
          <span class="grid size-10 shrink-0 place-items-center rounded-full" :class="state.tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-primary/10 text-primary'">
            <Icon :name="state.tone === 'danger' ? 'lucide:triangle-alert' : 'lucide:circle-help'" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <AlertDialogTitle class="font-display text-lg font-semibold leading-snug text-ink">{{ state.title }}</AlertDialogTitle>
            <AlertDialogDescription v-if="state.message" class="mt-1.5 text-sm text-muted">{{ state.message }}</AlertDialogDescription>
          </div>
        </div>
        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel as-child><UiButton variant="outline" @click="confirm.settle(false)">{{ state.cancelLabel ?? 'Annuler' }}</UiButton></AlertDialogCancel>
          <AlertDialogAction as-child>
            <UiButton :variant="state.tone === 'danger' ? 'danger' : 'primary'" @click="confirm.settle(true)">{{ state.confirmLabel ?? 'Confirmer' }}</UiButton>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
