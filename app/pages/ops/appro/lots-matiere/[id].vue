<script setup lang="ts">
import { fdate, fdatetime, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const L = useLookups()
const lot = computed(() => db.get('rawLots', id.value))
usePageTitle(lot.value ? `Lot ${lot.value.ref}` : 'Lot de matière')

const receipt = computed(() => (lot.value ? db.peek('receipts', lot.value.receiptId) : undefined))
const movements = computed(() => db.all('stockMovements').filter((m) => m.itemKind === 'raw' && m.itemId === id.value).sort((a, b) => b.at.localeCompare(a.at)))
const workOrders = computed(() => db.all('workOrders').filter((w) => w.reservations.some((r) => r.rawLotId === id.value)))
const produced = computed(() => db.all('productionLots').filter((p) => p.rawInputs.some((r) => r.rawLotId === id.value)))
const used = computed(() => (lot.value ? Math.round(((lot.value.kgConsumed / (lot.value.kgInitial || 1)) * 100)) : 0))
</script>

<template>
  <div>
    <UiEmpty v-if="!lot" icon="boxes" title="Lot introuvable"><UiButton icon="arrow-left" to="/ops/appro/lots-matiere">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Lot ${lot.ref}`" back="/ops/appro/lots-matiere" icon="boxes" :description="`${POLYMER_LABEL[lot.polymer]} · reçu le ${fdate(lot.receivedAt)} · ${L.supplierName(lot.supplierId)}`">
        <template #meta><UiStatusBadge kind="rawLot" :value="lot.status" /><UiDemoBadge /></template>
      </UiPageHeader>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStat label="Quantité initiale" :value="kg(lot.kgInitial)" icon="package" tone="info" />
        <UiStat label="Disponible" :value="kg(lot.kgAvailable)" icon="circle-check" tone="success" />
        <UiStat label="Réservé" :value="kg(lot.kgReserved)" icon="lock" tone="warning" />
        <UiStat label="Consommé" :value="kg(lot.kgConsumed)" icon="factory" tone="accent" :hint="`${used} % du lot`" />
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Traçabilité aval" icon="git-branch" description="Où cette matière a été utilisée.">
            <UiEmpty v-if="!workOrders.length && !produced.length" compact icon="git-branch" title="Pas encore utilisé en production" />
            <template v-else>
              <p class="mb-2 text-[13px] font-medium text-muted">Ordres de fabrication</p>
              <ul class="mb-4 divide-y divide-line text-sm"><li v-for="w in workOrders" :key="w.id" class="flex items-center justify-between gap-3 py-2.5"><NuxtLink :to="`/ops/production/ordres/${w.id}`" class="font-medium hover:underline">{{ w.ref }}</NuxtLink><span class="text-muted">{{ L.productName(w.productId) }} · {{ kg(w.reservations.find((r) => r.rawLotId === id)?.kg ?? 0) }}</span><UiStatusBadge kind="workOrder" :value="w.status" size="sm" /></li></ul>
              <p class="mb-2 text-[13px] font-medium text-muted">Lots de produits finis</p>
              <ul v-if="produced.length" class="divide-y divide-line text-sm"><li v-for="p in produced" :key="p.id" class="flex items-center justify-between gap-3 py-2.5"><NuxtLink :to="`/ops/production/lots/${p.id}`" class="font-medium hover:underline">{{ p.ref }}</NuxtLink><span class="text-muted">{{ L.productName(p.productId) }} · {{ p.producedQty }} pièces</span><UiStatusBadge kind="lotQc" :value="p.qcStatus" size="sm" /></li></ul>
              <p v-else class="text-sm text-muted">Aucun lot fini encore issu de cette matière.</p>
            </template>
          </UiCard>
          <UiCard title="Mouvements" icon="arrow-left-right">
            <UiEmpty v-if="!movements.length" compact icon="arrow-left-right" title="Aucun mouvement" />
            <ul v-else class="divide-y divide-line text-sm"><li v-for="m in movements" :key="m.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5"><span>{{ fdatetime(m.at) }}<span class="text-muted"> · {{ L.userName(m.userId) }}{{ m.note ? ` · ${m.note}` : '' }}</span></span><span class="flex items-center gap-2"><UiStatusBadge kind="stockMovement" :value="m.type" size="sm" /><span class="tnum font-medium">{{ kg(m.qty) }}</span></span></li></ul>
          </UiCard>
        </div>
        <aside class="flex flex-col gap-5">
          <UiCard title="Origine" icon="truck">
            <UiKeyValue :items="[{ label: 'Réception', value: receipt?.ref ?? '—' }, { label: 'Fournisseur', value: L.supplierName(lot.supplierId) }, { label: 'Emplacement', value: L.locationName(lot.locationId) }, { label: 'Reçu le', value: fdate(lot.receivedAt) }]" />
            <UiButton v-if="receipt" class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/appro/receptions/${receipt.id}`">Voir la réception</UiButton>
            <p v-if="lot.notes" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ lot.notes }}</p>
          </UiCard>
          <UiAlert v-if="lot.status === 'quarantine'" tone="warning" icon="shield-alert" title="Lot en quarantaine">Ce lot ne peut pas être réservé en production tant qu’il n’est pas déclaré disponible.</UiAlert>
        </aside>
      </div>
    </template>
  </div>
</template>
