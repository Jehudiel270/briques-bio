<script setup lang="ts">
import { statusMeta, type StatusKind } from '#shared/utils/labels'
/** Affiche un statut métier (libellé, teinte et icône viennent de shared/utils/labels.ts). À utiliser PARTOUT pour un statut. */
const props = withDefaults(defineProps<{ kind: StatusKind; value?: string | null; size?: 'sm' | 'md'; noIcon?: boolean }>(), { size: 'md' })
const meta = computed(() => statusMeta(props.kind, props.value))
</script>

<template>
  <UiBadge :tone="meta.tone" :icon="noIcon ? undefined : meta.icon" :size="size">{{ meta.label }}</UiBadge>
</template>
