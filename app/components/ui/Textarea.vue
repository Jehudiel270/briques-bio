<script setup lang="ts">
const model = defineModel<string | null | undefined>()
withDefaults(
  defineProps<{ rows?: number; placeholder?: string; error?: string; disabled?: boolean; id?: string; maxlength?: number; touch?: boolean }>(),
  { rows: 4 },
)
const emit = defineEmits<{ blur: [e: FocusEvent] }>()
</script>

<template>
  <textarea
    :id="id"
    :value="model ?? ''"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :maxlength="maxlength"
    :aria-invalid="error ? true : undefined"
    class="w-full resize-y rounded-md border bg-surface px-3 py-2 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
    :class="[error ? 'border-danger ring-2 ring-danger/20' : 'border-line hover:border-muted/60', disabled && 'opacity-55', touch ? 'text-base' : 'text-sm']"
    @input="model = ($event.target as HTMLTextAreaElement).value"
    @blur="emit('blur', $event)"
  />
</template>
