<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <WsQuoteDetail :id="String(route.params.id)" back="/admin/devis" />
</template>
