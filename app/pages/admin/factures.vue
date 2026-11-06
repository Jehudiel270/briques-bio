<script setup lang="ts">
usePageTitle('Factures simulées')
</script>

<template>
  <div>
    <UiPageHeader title="Factures simulées" description="Documents de démonstration générés à l’acceptation des devis. Sans valeur comptable ni fiscale." icon="receipt-text" />
    <WsInvoicesTable order-base="/admin/commandes" />
  </div>
</template>
