<script setup lang="ts">
const { items, dismiss } = useToast()
const meta = {
  success: { icon: 'circle-check', bar: 'bg-success', ico: 'text-success', title: 'Terminé' },
  error: { icon: 'octagon-alert', bar: 'bg-danger', ico: 'text-danger', title: 'Action impossible' },
  info: { icon: 'info', bar: 'bg-info', ico: 'text-info', title: 'Information' },
  warning: { icon: 'triangle-alert', bar: 'bg-warning', ico: 'text-warning', title: 'Attention' },
} as const

const timers = new Map<number, ReturnType<typeof setTimeout>>()
function arm(id: number, ms: number) {
  clearTimeout(timers.get(id))
  if (ms > 0) timers.set(id, setTimeout(() => dismiss(id), ms))
}
function hold(id: number) { clearTimeout(timers.get(id)) }

watch(
  items,
  (list) => {
    for (const t of list) if (!timers.has(t.id)) arm(t.id, t.duration)
    for (const id of [...timers.keys()]) if (!list.some((t) => t.id === id)) { clearTimeout(timers.get(id)); timers.delete(id) }
  },
  { immediate: true, deep: false },
)
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t)))
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-0 sm:items-end sm:p-5" aria-live="polite" aria-atomic="false">
        <TransitionGroup name="toast">
          <div
            v-for="t in items"
            :key="t.id"
            class="pointer-events-auto relative flex w-full max-w-sm gap-3 overflow-hidden rounded-lg border border-line bg-surface p-3.5 pl-4 shadow-[var(--shadow)]"
            :role="t.kind === 'error' ? 'alert' : 'status'"
            @mouseenter="hold(t.id)"
            @mouseleave="arm(t.id, 3000)"
          >
            <span class="absolute inset-y-0 left-0 w-1" :class="meta[t.kind].bar" aria-hidden="true" />
            <Icon :name="`lucide:${meta[t.kind].icon}`" class="mt-0.5 size-4.5 shrink-0" :class="meta[t.kind].ico" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink">{{ t.title ?? meta[t.kind].title }}</p>
              <p class="mt-0.5 text-[13px] leading-snug text-muted">{{ t.message }}</p>
            </div>
            <button type="button" class="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label="Fermer la notification" @click="dismiss(t.id)">
              <Icon name="lucide:x" class="size-4" aria-hidden="true" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.toast-enter-from { opacity: 0; transform: translateY(12px); }
.toast-leave-to { opacity: 0; transform: translateX(16px); }
.toast-move { transition: transform 0.22s ease; }
</style>
