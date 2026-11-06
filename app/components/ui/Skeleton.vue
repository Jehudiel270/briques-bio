<script setup lang="ts">
withDefaults(defineProps<{ lines?: number; height?: string; rounded?: boolean }>(), { height: '1rem' })
</script>

<template>
  <div v-if="lines" class="flex flex-col gap-2" aria-hidden="true">
    <span v-for="i in lines" :key="i" class="block animate-pulse rounded bg-surface-2" :style="{ height, width: i === lines && lines > 1 ? '62%' : '100%' }" />
  </div>
  <span v-else class="block animate-pulse bg-surface-2" :class="rounded ? 'rounded-full' : 'rounded-md'" :style="{ height }" aria-hidden="true" />
</template>
