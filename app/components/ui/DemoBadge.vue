<script setup lang="ts">
/** Puce « Démo » à poser à côté d'un chiffre, d'un document ou d'un paiement fictif. `label` pour un autre libellé (ex. « Simulé »). */
withDefaults(defineProps<{ label?: string }>(), { label: 'Démo' })
</script>

<template>
  <span
    class="inline-flex h-[18px] items-center rounded-sm border border-accent/60 bg-accent/22 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink"
    title="Donnée de démonstration fictive"
  >{{ label }}</span>
</template>
