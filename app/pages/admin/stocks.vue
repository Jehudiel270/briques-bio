<script setup lang="ts">
import { kg, num } from '#shared/utils/format'

usePageTitle('Stocks et matières')
const db = useDb()
const { rawByPolymer, finishedByProduct } = useStockView()
const locations = computed(() => db.all('stockLocations').map((loc) => {
  const raw = db.all('rawLots').filter((l) => l.locationId === loc.id && ['available', 'quarantine'].includes(l.status)).reduce((a, l) => a + l.kgAvailable, 0)
  const fin = db.all('productionLots').filter((l) => l.locationId === loc.id).reduce((a, l) => a + l.availableQty, 0)
  const qty = loc.kind === 'finished' ? fin : raw
  return { loc, qty, pct: loc.capacity ? Math.round((qty / loc.capacity) * 100) : null }
}))
const rawColumns = [
  { key: 'label', label: 'Plastique', sortable: true },
  { key: 'available', label: 'Disponible', align: 'right' as const, sortable: true, value: (r: any) => kg(r.available), sortValue: (r: any) => r.available },
  { key: 'reserved', label: 'Réservé', align: 'right' as const, hide: 'sm' as const, value: (r: any) => kg(r.reserved) },
  { key: 'free', label: 'Libre', align: 'right' as const, value: (r: any) => kg(r.free) },
  { key: 'quarantine', label: 'Quarantaine', align: 'right' as const, hide: 'md' as const, value: (r: any) => kg(r.quarantine) },
  { key: 'threshold', label: 'Seuil', align: 'right' as const, hide: 'md' as const, value: (r: any) => (r.threshold != null ? kg(r.threshold) : '—') },
  { key: 'state', label: 'État', value: (r: any) => (r.low ? 'Sous le seuil' : 'Suffisant') },
]
const finColumns = [
  { key: 'name', label: 'Produit', sortable: true, value: (r: any) => r.product.name, sortValue: (r: any) => r.product.name },
  { key: 'sellable', label: 'Vendable', align: 'right' as const, sortable: true, value: (r: any) => num(r.sellable), sortValue: (r: any) => r.sellable },
  { key: 'reserved', label: 'Réservé', align: 'right' as const, hide: 'sm' as const, value: (r: any) => num(r.reserved) },
  { key: 'waiting', label: 'En attente qualité', align: 'right' as const, hide: 'md' as const, value: (r: any) => num(r.waiting) },
  { key: 'blocked', label: 'Bloqué', align: 'right' as const, hide: 'md' as const, value: (r: any) => num(r.blocked) },
  { key: 'min', label: 'Seuil', align: 'right' as const, hide: 'lg' as const, value: (r: any) => num(r.product.minStockUnits) },
  { key: 'state', label: 'État', value: (r: any) => (r.low ? 'Sous le seuil' : 'Suffisant') },
]
</script>

<template>
  <div>
    <UiPageHeader title="Stocks et matières" description="Vue globale : matière première par plastique, produits finis vendables et emplacements." icon="warehouse" />
    <div class="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
      <div class="flex flex-col gap-5">
        <UiCard title="Matière première" icon="recycle" padding="none">
          <UiDataTable :rows="rawByPolymer" :columns="rawColumns" row-key="code" dense :searchable="false" export-name="stock-matiere">
            <template #cell-state="{ row }"><UiBadge :tone="row.low ? 'danger' : 'success'" size="sm" dot>{{ row.low ? 'Sous le seuil' : 'Suffisant' }}</UiBadge></template>
          </UiDataTable>
        </UiCard>
        <UiCard title="Produits finis" icon="package-check" description="Seuls les lots libérés par la qualité comptent comme vendables." padding="none">
          <UiDataTable :rows="finishedByProduct" :columns="finColumns" dense :searchable="false" export-name="stock-produits-finis">
            <template #cell-state="{ row }"><UiBadge :tone="row.low ? 'warning' : 'success'" size="sm" dot>{{ row.low ? 'Sous le seuil' : 'Suffisant' }}</UiBadge></template>
          </UiDataTable>
        </UiCard>
      </div>
      <UiCard title="Emplacements" icon="map-pinned">
        <ul class="flex flex-col gap-4">
          <li v-for="x in locations" :key="x.loc.id">
            <div class="flex items-baseline justify-between gap-2 text-sm"><span class="font-medium">{{ x.loc.name }} <span class="text-muted">· {{ x.loc.code }}</span></span><span class="tnum text-muted">{{ x.loc.kind === 'finished' ? `${num(x.qty)} pièces` : kg(x.qty) }}</span></div>
            <UiProgress v-if="x.pct != null" class="mt-1.5" :value="x.pct" :tone="x.pct > 90 ? 'danger' : x.pct > 70 ? 'warning' : 'info'" :label="`Occupation de ${x.loc.name}`" show-value size="sm" />
          </li>
        </ul>
      </UiCard>
    </div>
  </div>
</template>
