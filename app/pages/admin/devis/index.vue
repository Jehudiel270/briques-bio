<script setup lang="ts">
usePageTitle('Devis')
</script>

<template>
  <div>
    <UiPageHeader title="Devis" description="Vue globale de toutes les demandes de devis et offres, tous commerciaux confondus." icon="file-text" />
    <WsQuotesTable base="/admin/devis" />
  </div>
</template>
