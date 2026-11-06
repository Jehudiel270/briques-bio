<script setup lang="ts">
usePageTitle('Expéditions')
</script>

<template>
  <div>
    <UiPageHeader title="Expéditions" description="Toutes les livraisons : planification, expédition et preuve de livraison." icon="package-check" />
    <WsDeliveriesTable base="/ops/logistique/expeditions" export-name="expeditions" />
  </div>
</template>
