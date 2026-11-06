<script setup lang="ts">
usePageTitle('Historique des livraisons')
</script>

<template>
  <div>
    <UiPageHeader title="Historique des livraisons" description="Livraisons terminées, échouées ou annulées, avec leur preuve de réception." icon="history" />
    <WsDeliveriesTable base="/ops/logistique/expeditions" :statuses="['delivered', 'failed', 'cancelled']" export-name="historique-livraisons" />
  </div>
</template>
