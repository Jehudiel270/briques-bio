<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id))
</script>

<template>
  <WsLotDetail :id="id" back="/ops/production/lots" />
</template>
