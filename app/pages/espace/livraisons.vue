<script setup lang="ts">
import { fcfa, fdate, fdatetime, fmtAddress } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Delivery } from '#shared/types/domain'

usePageTitle('Mes livraisons')
const db = useDb()
const L = useLookups()

const rows = computed(() => [...db.all('deliveries')].sort((a, b) => (b.plannedDate ?? b.history[0]?.at ?? '').localeCompare(a.plannedDate ?? a.history[0]?.at ?? '')))
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('deliveries', openId.value))

const columns = [
  { key: 'ref', label: 'Livraison', sortable: true },
  { key: 'order', label: 'Commande', value: (d: Delivery) => L.orderRef(d.orderId) },
  { key: 'plannedDate', label: 'Date prévue', sortable: true, hide: 'sm' as const, value: (d: Delivery) => (d.plannedDate ? fdate(d.plannedDate) : 'À confirmer'), sortValue: (d: Delivery) => d.plannedDate ?? '' },
  { key: 'carrier', label: 'Transporteur', hide: 'md' as const, value: (d: Delivery) => L.carrierName(d.carrierId) },
  { key: 'status', label: 'Statut', value: (d: Delivery) => STATUS.delivery[d.status].label },
]
const filters = [{ key: 'status', label: 'Statut', options: Object.entries(STATUS.delivery).map(([value, m]) => ({ value, label: m.label })), accessor: (d: Delivery) => d.status }]
</script>

<template>
  <div>
    <UiPageHeader title="Mes livraisons" description="Suivi du transport et preuve de réception de chaque livraison." icon="truck" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" @row-click="(d: Delivery) => (openId = d.id)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="delivery" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="truck" title="Aucune livraison" hint="Une livraison est créée quand une commande passe en préparation." /></template>
    </UiDataTable>

    <UiSheet v-model:open="open" :title="sel?.ref ?? 'Livraison'" side="right" width="30rem">
      <div v-if="sel" class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center gap-2"><UiStatusBadge kind="delivery" :value="sel.status" /><UiDemoBadge /></div>
        <UiKeyValue :items="[
          { label: 'Commande', value: L.orderRef(sel.orderId) },
          { label: 'Adresse', value: fmtAddress(sel.address) },
          { label: 'Date prévue', value: sel.plannedDate ? fdate(sel.plannedDate) : 'À confirmer' },
          { label: 'Transporteur', value: L.carrierName(sel.carrierId) },
          { label: 'Chauffeur', value: sel.driverName },
          { label: 'Frais', value: fcfa(sel.fee) },
          { label: 'Lots livrés', value: sel.lotIds.map((id) => L.lotRef(id)).join(', ') || '—' },
        ]" />
        <UiAlert v-if="sel.proof" tone="success" icon="badge-check" title="Preuve de livraison">Réceptionnée par {{ sel.proof.receivedBy }} le {{ fdatetime(sel.proof.at) }}.<template v-if="sel.proof.note"> « {{ sel.proof.note }} »</template></UiAlert>
        <div v-if="sel.incidents.length">
          <h3 class="mb-2 font-display font-semibold">Incidents</h3>
          <ul class="space-y-2"><li v-for="i in sel.incidents" :key="i.id" class="rounded-md border border-line p-3 text-sm"><p>{{ i.description }}</p><p class="mt-1 text-[12px] text-muted">{{ fdatetime(i.at) }} · {{ i.resolved ? 'Résolu' : 'En cours' }}</p></li></ul>
        </div>
        <div><h3 class="mb-2 font-display font-semibold">Historique</h3><UiTimeline :items="[...sel.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note }))" empty="Aucun événement." /></div>
        <UiButton variant="outline" icon="package" :to="`/espace/commandes/${sel.orderId}`">Voir la commande</UiButton>
      </div>
    </UiSheet>
  </div>
</template>
