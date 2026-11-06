<script setup lang="ts">
usePageTitle('Traçabilité')
const db = useDb()
const L = useLookups()
const route = useRoute()
const lotId = ref(String(route.query.lot ?? ''))
const options = computed(() => [...db.all('productionLots')].sort((a, b) => b.producedAt.localeCompare(a.producedAt)).map((l) => ({ value: l.id, label: `${l.ref} · ${L.productName(l.productId)}` })))
if (!lotId.value && options.value[0]) lotId.value = String(options.value[0].value)
</script>

<template>
  <div>
    <UiPageHeader title="Traçabilité" description="Remontez d’un lot de produits finis aux matières premières, aux fournisseurs et aux clients livrés." icon="git-branch" />
    <UiCard class="mb-5" padding="sm">
      <UiField label="Lot de produits finis" #default="{ id }"><UiSelect :id="id" v-model="lotId" :options="options" searchable placeholder="Choisir un lot" /></UiField>
    </UiCard>
    <UiEmpty v-if="!lotId" icon="git-branch" title="Aucun lot à tracer" hint="Clôturez un ordre de fabrication pour créer un lot." />
    <WsLotDetail v-else :id="lotId" back="/ops/production/lots" />
  </div>
</template>
