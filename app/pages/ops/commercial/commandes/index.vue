<script setup lang="ts">
usePageTitle('Commandes')
</script>

<template>
  <div>
    <UiPageHeader title="Commandes" description="Paiements simulés, passage en préparation, réservation des lots libérés." icon="package" />
    <WsOrdersTable base="/ops/commercial/commandes" />
  </div>
</template>
