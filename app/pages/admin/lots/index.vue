<script setup lang="ts">
usePageTitle('Lots et traçabilité')
</script>

<template>
  <div>
    <UiPageHeader title="Lots et traçabilité" description="Du lot de matière au client livré : ouvrez un lot pour remonter toute la chaîne." icon="git-branch" />
    <WsLotsTable base="/admin/lots" />
  </div>
</template>
