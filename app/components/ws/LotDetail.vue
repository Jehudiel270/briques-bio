<script setup lang="ts">
import { fdate, fdatetime, kg, num } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'

/** Fiche d'un lot de produits finis : traçabilité amont (matières, fournisseurs) et aval (contrôles, commandes, livraisons). */
const props = defineProps<{ id: string; back: string }>()
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

const lot = computed(() => db.get('productionLots', props.id))
usePageTitle(lot.value ? `Lot ${lot.value.ref}` : 'Lot')
const wo = computed(() => (lot.value ? db.peek('workOrders', lot.value.workOrderId) : undefined))
const inputs = computed(() => (lot.value?.rawInputs ?? []).map((i) => ({ ...i, raw: db.peek('rawLots', i.rawLotId) })))
const inspections = computed(() => db.all('qcInspections').filter((q) => q.lotId === props.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)))
const orders = computed(() => db.all('orders').filter((o) => o.lines.some((l) => l.allocations.some((a) => a.lotId === props.id))))
const deliveries = computed(() => db.all('deliveries').filter((d) => d.lotIds.includes(props.id)))
const movements = computed(() => db.all('stockMovements').filter((m) => m.itemKind === 'finished' && m.itemId === props.id).sort((a, b) => b.at.localeCompare(a.at)))
const canRequest = computed(() => !!lot.value && ['pending_qc', 'quarantine'].includes(lot.value.qcStatus) && !inspections.value.some((q) => q.status !== 'completed') && (auth.can('quality.inspect') || auth.can('production.manage')))
const request = () => act(() => svc.quality.request(props.id), 'Contrôle qualité demandé.')
const rate = computed(() => (lot.value && lot.value.producedQty + lot.value.scrapQty ? Math.round((lot.value.producedQty / (lot.value.producedQty + lot.value.scrapQty)) * 100) : null))
const qtyOf = (o: { lines: { allocations: { lotId: string; qty: number }[] }[] }) => o.lines.reduce((a, l) => a + l.allocations.filter((x) => x.lotId === props.id).reduce((s, x) => s + x.qty, 0), 0)
</script>

<template>
  <div>
    <UiEmpty v-if="!lot" icon="boxes" title="Lot introuvable"><UiButton icon="arrow-left" :to="back">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Lot ${lot.ref}`" :back="back" icon="boxes" :description="`${L.productName(lot.productId)} · produit le ${fdate(lot.producedAt)}`">
        <template #meta><UiStatusBadge kind="lotQc" :value="lot.qcStatus" /><UiDemoBadge /></template>
        <template #actions><UiButton v-if="canRequest" icon="microscope" @click="request">Demander un contrôle qualité</UiButton></template>
      </UiPageHeader>

      <UiAlert v-if="lot.qcStatus !== 'released'" tone="warning" icon="shield-alert" title="Lot non libéré : non vendable">Seuls les lots libérés par la qualité peuvent être réservés par une commande ou expédiés.</UiAlert>

      <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <UiStat label="Produit" :value="num(lot.producedQty)" icon="package" tone="info" :hint="rate != null ? `${rate} % de rendement` : undefined" />
        <UiStat label="Rebut" :value="num(lot.scrapQty)" icon="trash-2" :tone="lot.scrapQty ? 'warning' : 'neutral'" />
        <UiStat label="Disponible" :value="num(lot.availableQty)" icon="circle-check" tone="success" />
        <UiStat label="Réservé" :value="num(lot.reservedQty)" icon="lock" tone="accent" />
        <UiStat label="Expédié" :value="num(lot.shippedQty)" icon="truck" tone="neutral" />
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-2">
        <UiCard title="Traçabilité amont" icon="git-branch" description="Matières premières consommées par cet ordre de fabrication.">
          <p class="mb-3 text-sm">Ordre de fabrication : <NuxtLink v-if="wo" :to="`/ops/production/ordres/${wo.id}`" class="font-medium hover:underline">{{ wo.ref }}</NuxtLink><span v-else>—</span></p>
          <UiEmpty v-if="!inputs.length" compact icon="recycle" title="Aucune matière enregistrée" />
          <ul v-else class="divide-y divide-line text-sm">
            <li v-for="i in inputs" :key="i.rawLotId" class="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><NuxtLink :to="`/ops/appro/lots-matiere/${i.rawLotId}`" class="font-medium hover:underline">{{ i.raw?.ref ?? '—' }}</NuxtLink><span class="text-muted"> · {{ i.raw ? POLYMER_LABEL[i.raw.polymer] : '' }} · {{ i.raw ? L.supplierName(i.raw.supplierId) : '' }}</span></span>
              <span class="tnum font-medium">{{ kg(i.kg) }}</span>
            </li>
          </ul>
        </UiCard>

        <UiCard title="Contrôles qualité" icon="microscope">
          <UiEmpty v-if="!inspections.length" compact icon="microscope" title="Aucun contrôle" hint="Demandez un contrôle pour pouvoir libérer le lot." />
          <ul v-else class="divide-y divide-line text-sm">
            <li v-for="q in inspections" :key="q.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><NuxtLink :to="`/ops/qualite/controles/${q.id}`" class="font-medium hover:underline">{{ q.ref }}</NuxtLink><span class="text-muted"> · {{ fdate(q.requestedAt) }}</span></span>
              <span class="flex items-center gap-2"><UiStatusBadge kind="inspection" :value="q.status" size="sm" /><UiStatusBadge v-if="q.decision" kind="inspectionDecision" :value="q.decision" size="sm" /></span>
            </li>
          </ul>
          <p v-if="lot.releasedAt" class="mt-3 text-[13px] text-muted">Libéré le {{ fdatetime(lot.releasedAt) }} par {{ L.userName(lot.releasedBy) }}.</p>
        </UiCard>

        <UiCard title="Commandes ayant réservé ce lot" icon="shopping-bag">
          <UiEmpty v-if="!orders.length" compact icon="shopping-bag" title="Aucune commande" />
          <ul v-else class="divide-y divide-line text-sm"><li v-for="o in orders" :key="o.id" class="flex items-center justify-between gap-3 py-2.5"><NuxtLink :to="`/ops/commercial/commandes/${o.id}`" class="font-medium hover:underline">{{ o.ref }}</NuxtLink><span class="text-muted">{{ o.companyId ? L.companyName(o.companyId) : L.userName(o.userId) }}</span><span class="tnum">{{ num(qtyOf(o)) }} pièces</span></li></ul>
        </UiCard>

        <UiCard title="Livraisons" icon="truck">
          <UiEmpty v-if="!deliveries.length" compact icon="truck" title="Aucune livraison" />
          <ul v-else class="divide-y divide-line text-sm"><li v-for="d in deliveries" :key="d.id" class="flex items-center justify-between gap-3 py-2.5"><NuxtLink :to="`/ops/logistique/expeditions/${d.id}`" class="font-medium hover:underline">{{ d.ref }}</NuxtLink><span class="text-muted">{{ L.orderRef(d.orderId) }}</span><UiStatusBadge kind="delivery" :value="d.status" size="sm" /></li></ul>
        </UiCard>

        <UiCard title="Mouvements de stock" icon="arrow-left-right" class="xl:col-span-2">
          <UiEmpty v-if="!movements.length" compact icon="arrow-left-right" title="Aucun mouvement" />
          <ul v-else class="divide-y divide-line text-sm"><li v-for="m in movements" :key="m.id" class="flex flex-wrap items-center justify-between gap-2 py-2.5"><span>{{ fdatetime(m.at) }}<span class="text-muted"> · {{ L.userName(m.userId) }}{{ m.note ? ` · ${m.note}` : '' }}</span></span><span class="flex items-center gap-2"><UiStatusBadge kind="stockMovement" :value="m.type" size="sm" /><span class="tnum font-medium">{{ num(m.qty) }}</span></span></li></ul>
        </UiCard>
      </div>
      <SiteNotice class="mt-6" kind="technical" dense />
    </template>
  </div>
</template>
