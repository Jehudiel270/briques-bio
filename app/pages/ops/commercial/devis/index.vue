<script setup lang="ts">
usePageTitle('Devis')
</script>

<template>
  <div>
    <UiPageHeader title="Devis" description="Prenez en charge, chiffrez et envoyez les offres. Triez par statut pour traiter la file." icon="file-text" />
    <WsQuotesTable base="/ops/commercial/devis" />
  </div>
</template>
