<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <WsCompanyDetail :id="String(route.params.id)" back="/admin/clients" />
</template>
