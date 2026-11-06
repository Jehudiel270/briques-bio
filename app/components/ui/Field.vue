<script setup lang="ts">
/** Étiquette + aide + erreur autour d'un contrôle. Le contrôle reçoit `id` via le slot (`#default="{ id }"`). */
const props = defineProps<{ label?: string; hint?: string; error?: string; required?: boolean; for?: string }>()
const uid = useId()
const id = computed(() => props.for ?? `f-${uid}`)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-[13px] font-medium text-ink">
      {{ label }}<span v-if="required" class="ml-0.5 text-danger" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only"> (obligatoire)</span>
    </label>
    <slot :id="id" :invalid="!!error" />
    <p v-if="error" class="flex items-start gap-1.5 text-[13px] text-danger" role="alert">
      <Icon name="lucide:circle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{{ error }}
    </p>
    <p v-else-if="hint" class="text-[13px] text-muted">{{ hint }}</p>
  </div>
</template>
