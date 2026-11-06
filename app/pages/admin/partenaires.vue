<script setup lang="ts">
usePageTitle('Partenaires')
const db = useDb()
const cards = computed(() => {
  const sup = db.all('suppliers'); const car = db.all('carriers'); const dist = db.all('companies').filter((c) => c.kind === 'distributor')
  return [
    { title: 'Collecteurs et fournisseurs', icon: 'handshake', to: '/ops/appro/fournisseurs', text: 'Agrément, plastiques acceptés, rémunération simulée, historique des apports.', stats: [`${sup.length} partenaires`, `${sup.filter((s) => s.status === 'approved').length} agréés`, `${sup.filter((s) => s.status === 'pending').length} en attente`] },
    { title: 'Transporteurs', icon: 'truck', to: '/ops/logistique/transporteurs', text: 'Véhicules, zones desservies et frais forfaitaires pour les livraisons.', stats: [`${car.length} transporteurs`, `${car.filter((c) => c.status === 'active').length} actifs`] },
    { title: 'Distributeurs et revendeurs', icon: 'store', to: '/admin/clients', text: 'Comptes revendeurs : conditions commerciales, grille tarifaire et portefeuille.', stats: [`${dist.length} distributeurs`, `${dist.filter((c) => c.status === 'active').length} actifs`] },
  ]
})
const pendingSuppliers = computed(() => db.all('suppliers').filter((s) => s.status === 'pending'))
</script>

<template>
  <div>
    <UiPageHeader title="Partenaires" description="Collecteurs, transporteurs et distributeurs : un point d’entrée vers chaque annuaire." icon="handshake" />
    <div class="grid gap-5 lg:grid-cols-3">
      <UiCard v-for="c in cards" :key="c.title" :title="c.title" :icon="c.icon">
        <p class="text-sm text-muted">{{ c.text }}</p>
        <div class="mt-3 flex flex-wrap gap-2"><UiBadge v-for="s in c.stats" :key="s" size="sm">{{ s }}</UiBadge></div>
        <UiButton class="mt-4" variant="outline" iconRight="arrow-right" :to="c.to">Ouvrir</UiButton>
      </UiCard>
    </div>
    <UiCard v-if="pendingSuppliers.length" class="mt-5" title="Agréments à traiter" icon="badge-check">
      <ul class="divide-y divide-line text-sm"><li v-for="s in pendingSuppliers" :key="s.id" class="flex items-center justify-between gap-3 py-2.5"><span class="font-medium">{{ s.name }}<span class="font-normal text-muted"> · {{ s.address.city }}</span></span><UiButton size="sm" variant="outline" iconRight="arrow-right" :to="`/ops/appro/fournisseurs/${s.id}`">Examiner</UiButton></li></ul>
    </UiCard>
  </div>
</template>
