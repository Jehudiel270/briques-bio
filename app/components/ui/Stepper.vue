<script setup lang="ts">
/** Étapes d'un parcours. `steps` : libellés ou { label, hint? } ; `current` : index de l'étape en cours (0-based) ; `failed` marque l'étape courante en erreur. */
const props = defineProps<{ steps: (string | { label: string; hint?: string })[]; current: number; failed?: boolean }>()
const items = computed(() => props.steps.map((s) => (typeof s === 'string' ? { label: s } : s)) as { label: string; hint?: string }[])
</script>

<template>
  <ol class="flex w-full items-start" aria-label="Progression">
    <li v-for="(s, i) in items" :key="s.label" class="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" :aria-current="i === current ? 'step' : undefined">
      <span v-if="i > 0" class="absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2" :class="i <= current ? 'bg-primary' : 'bg-line'" aria-hidden="true" />
      <span
        class="relative z-10 grid size-7 place-items-center rounded-full border text-xs font-semibold"
        :class="
          i < current ? 'border-primary bg-primary text-primary-ink'
          : i === current ? (failed ? 'border-danger bg-danger text-danger-ink' : 'border-primary bg-surface text-primary ring-4 ring-primary/15')
          : 'border-line bg-surface text-muted'
        "
      >
        <Icon v-if="i < current" name="lucide:check" class="size-3.5" aria-hidden="true" />
        <Icon v-else-if="i === current && failed" name="lucide:x" class="size-3.5" aria-hidden="true" />
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span class="px-1 text-xs leading-tight" :class="i <= current ? 'font-medium text-ink' : 'text-muted'">{{ s.label }}</span>
      <span v-if="s.hint" class="hidden px-1 text-[11px] leading-tight text-muted sm:block">{{ s.hint }}</span>
    </li>
  </ol>
</template>
