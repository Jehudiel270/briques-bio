<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <WsOrderDetail :id="String(route.params.id)" back="/ops/commercial/commandes" delivery-base="/ops/logistique/expeditions" />
</template>
