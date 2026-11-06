<script setup lang="ts">
usePageTitle('Livraisons')
</script>

<template>
  <div>
    <UiPageHeader title="Livraisons" description="Toutes les expéditions, avec preuve de livraison et incidents." icon="package-check" />
    <WsDeliveriesTable base="/ops/logistique/expeditions" export-name="livraisons" />
  </div>
</template>
