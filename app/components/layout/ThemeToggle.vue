<script setup lang="ts">
/** Choix du thème : Clair « Atelier », Sombre « Graphite », ou celui du système. */
const theme = useTheme()
const items = computed(() => [
  { label: 'Clair — Atelier', icon: 'sun', onSelect: () => theme.setMode('light') },
  { label: 'Sombre — Graphite', icon: 'moon', onSelect: () => theme.setMode('dark') },
  { label: 'Selon l’appareil', icon: 'monitor', onSelect: () => theme.setMode('system') },
])
</script>

<template>
  <UiDropdown :items="items">
    <UiButton variant="ghost" icon-only :icon="theme.resolved.value === 'dark' ? 'moon' : 'sun'" aria-label="Changer de thème" />
  </UiDropdown>
</template>
