<script setup lang="ts">
/** Montant en FCFA (chiffres tabulaires). `null`/`undefined` → `fallback` (« Sur devis »). */
withDefaults(defineProps<{ value?: number | null; fallback?: string; muted?: boolean; strong?: boolean }>(), { fallback: 'Sur devis' })
</script>

<template>
  <span class="tnum whitespace-nowrap" :class="[muted && 'text-muted', strong && 'font-semibold']">{{ value == null ? fallback : fcfa(value) }}</span>
</template>
