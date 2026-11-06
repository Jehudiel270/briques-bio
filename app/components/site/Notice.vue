<script setup lang="ts">
/** Mention de prudence réutilisable (données fictives, prudence technique, paiement simulé…). */
const props = withDefaults(defineProps<{ kind?: 'demo' | 'technical' | 'simulated' | 'document' | 'structural' | 'leadTime'; dense?: boolean }>(), { kind: 'demo' })
const map = {
  demo: { icon: 'flask-conical', text: NOTICES.demoData, tone: 'accent' },
  technical: { icon: 'clipboard-check', text: NOTICES.technicalUnconfirmed, tone: 'warning' },
  simulated: { icon: 'wallet', text: NOTICES.simulatedPayment, tone: 'accent' },
  document: { icon: 'file-warning', text: NOTICES.demoDocument, tone: 'accent' },
  structural: { icon: 'octagon-alert', text: NOTICES.notStructural, tone: 'warning' },
  leadTime: { icon: 'clock', text: NOTICES.leadTime, tone: 'neutral' },
} as const
const m = computed(() => map[props.kind])
</script>

<template>
  <UiAlert :tone="m.tone" :icon="m.icon" :dense="dense"><slot>{{ m.text }}</slot></UiAlert>
</template>
