<script setup lang="ts">
usePageTitle('Commandes')
</script>

<template>
  <div>
    <UiPageHeader title="Commandes" description="Suivi de bout en bout : paiement simulé, préparation, lots réservés, livraison." icon="shopping-bag" />
    <WsOrdersTable base="/admin/commandes" />
  </div>
</template>
