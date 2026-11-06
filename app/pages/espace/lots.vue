<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { ProductionLot } from '#shared/types/domain'

usePageTitle('Suivi des lots')
const db = useDb()
const L = useLookups()

/** Lots livrés ou réservés pour les commandes de l'utilisateur. */
const rows = computed(() => {
  const ids = new Set(db.all('orders').flatMap((o) => o.lines.flatMap((l) => l.allocations.map((a) => a.lotId))))
  return db.all('productionLots').filter((l) => ids.has(l.id)).sort((a, b) => b.producedAt.localeCompare(a.producedAt))
})
const ordersOf = (lotId: string) => db.all('orders').filter((o) => o.lines.some((l) => l.allocations.some((a) => a.lotId === lotId)))
const docsOf = (lot: ProductionLot) => db.all('documents').filter((d) => d.status === 'published' && (d.lotId === lot.id || (d.productId === lot.productId && d.kind === 'datasheet')))

const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('productionLots', openId.value))
const columns = [
  { key: 'ref', label: 'Lot', sortable: true },
  { key: 'product', label: 'Produit', value: (l: ProductionLot) => L.productName(l.productId) },
  { key: 'producedAt', label: 'Fabriqué le', sortable: true, hide: 'sm' as const, value: (l: ProductionLot) => fdate(l.producedAt), sortValue: (l: ProductionLot) => l.producedAt },
  { key: 'orders', label: 'Commandes', hide: 'md' as const, value: (l: ProductionLot) => ordersOf(l.id).map((o) => o.ref).join(', ') },
  { key: 'status', label: 'Contrôle qualité', value: (l: ProductionLot) => STATUS.lotQc[l.qcStatus].label },
]
</script>

<template>
  <div>
    <UiPageHeader title="Suivi des lots" description="De quel lot viennent les pièces que vous avez reçues ? Statut qualité et documents associés." icon="qr-code">
      <template #actions><UiButton variant="outline" icon="info" to="/tracabilite">Comprendre la traçabilité</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" @row-click="(l: ProductionLot) => (openId = l.id)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="lotQc" :value="row.qcStatus" size="sm" /></template>
      <template #empty><UiEmpty icon="qr-code" title="Aucun lot rattaché" hint="Les lots apparaissent lorsqu’ils sont réservés pour l’une de vos commandes." /></template>
    </UiDataTable>

    <UiSheet v-model:open="open" :title="sel?.ref ?? 'Lot'" side="right" width="30rem">
      <div v-if="sel" class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center gap-2"><UiStatusBadge kind="lotQc" :value="sel.qcStatus" /><UiDemoBadge /></div>
        <UiKeyValue :items="[
          { label: 'Produit', value: L.productName(sel.productId) },
          { label: 'Fabriqué le', value: fdate(sel.producedAt) },
          { label: 'Libéré le', value: sel.releasedAt ? fdate(sel.releasedAt) : 'Non libéré' },
          { label: 'Quantité produite', value: sel.producedQty },
        ]" />
        <div>
          <h3 class="mb-2 font-display font-semibold">Documents</h3>
          <UiEmpty v-if="!docsOf(sel).length" compact icon="files" title="Aucun document publié" />
          <ul v-else class="space-y-2"><li v-for="d in docsOf(sel)" :key="d.id" class="flex items-center gap-3 rounded-md border border-line p-2.5 text-sm"><Icon name="lucide:file-text" class="size-4 text-primary" aria-hidden="true" /><span class="flex-1">{{ d.title }}</span><UiDemoBadge /></li></ul>
        </div>
        <SiteNotice kind="document" dense />
      </div>
    </UiSheet>
  </div>
</template>
