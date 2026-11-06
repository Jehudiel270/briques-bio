<script setup lang="ts">
usePageTitle('Lots produits')
</script>

<template>
  <div>
    <UiPageHeader title="Lots produits" description="Lots de produits finis, statut qualité et quantités disponibles. Seuls les lots libérés sont vendables." icon="boxes" />
    <WsLotsTable base="/ops/production/lots" />
  </div>
</template>
