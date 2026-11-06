<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <WsLotDetail :id="String(route.params.id)" back="/admin/lots" />
</template>
