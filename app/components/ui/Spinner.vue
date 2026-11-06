<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; label?: string }>(), { size: 'md', label: 'Chargement' })
</script>

<template>
  <span role="status" class="inline-flex items-center gap-2 text-muted">
    <Icon name="lucide:loader-circle" class="animate-spin" :class="size === 'sm' ? 'size-4' : size === 'lg' ? 'size-7' : 'size-5'" aria-hidden="true" />
    <span class="sr-only">{{ label }}</span>
  </span>
</template>
