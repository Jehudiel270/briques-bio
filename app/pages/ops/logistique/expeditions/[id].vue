<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <WsDeliveryDetail :id="String(route.params.id)" back="/ops/logistique/expeditions" />
</template>
