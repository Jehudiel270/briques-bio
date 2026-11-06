<script setup lang="ts">
import { kg, num } from '#shared/utils/format'
import type { WorkOrder } from '#shared/types/domain'

usePageTitle('Rendements')
const db = useDb()
const L = useLookups()
const done = computed(() => db.all('workOrders').filter((w) => w.status === 'completed' || (w.status === 'in_progress' && w.producedQty > 0)))
const pctOf = (w: WorkOrder) => (w.producedQty + w.scrapQty ? Math.round((w.producedQty / (w.producedQty + w.scrapQty)) * 1000) / 10 : 0)
const kgPerUnit = (w: WorkOrder) => (w.producedQty ? Math.round((w.materialKgConsumed / w.producedQty) * 100) / 100 : 0)

const byProduct = computed(() => {
  const map = new Map<string, { produced: number; scrap: number; kg: number }>()
  for (const w of done.value) { const x = map.get(w.productId) ?? { produced: 0, scrap: 0, kg: 0 }; x.produced += w.producedQty; x.scrap += w.scrapQty; x.kg += w.materialKgConsumed; map.set(w.productId, x) }
  return [...map.entries()].map(([id, x]) => ({ id, name: L.productName(id), ...x, yield: x.produced + x.scrap ? Math.round((x.produced / (x.produced + x.scrap)) * 1000) / 10 : 0, kgPerUnit: x.produced ? Math.round((x.kg / x.produced) * 100) / 100 : 0 }))
})
const yieldBars = computed(() => byProduct.value.map((p) => ({ label: p.name, value: p.yield, tone: p.yield < 90 ? 'warning' as const : 'success' as const })))
const trend = computed(() => [{ name: 'Rendement (%)', points: [...done.value].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)).map((w) => ({ x: w.ref, y: pctOf(w) })) }])
const totalProduced = computed(() => byProduct.value.reduce((a, p) => a + p.produced, 0))
const totalScrap = computed(() => byProduct.value.reduce((a, p) => a + p.scrap, 0))
const totalKg = computed(() => byProduct.value.reduce((a, p) => a + p.kg, 0))
const overall = computed(() => (totalProduced.value + totalScrap.value ? Math.round((totalProduced.value / (totalProduced.value + totalScrap.value)) * 1000) / 10 : null))
const columns = [
  { key: 'name', label: 'Produit', sortable: true },
  { key: 'produced', label: 'Produit', align: 'right' as const, sortable: true, value: (p: any) => num(p.produced) },
  { key: 'scrap', label: 'Rebut', align: 'right' as const, value: (p: any) => num(p.scrap) },
  { key: 'yield', label: 'Rendement', align: 'right' as const, sortable: true, value: (p: any) => `${p.yield} %`, sortValue: (p: any) => p.yield },
  { key: 'kg', label: 'Matière', align: 'right' as const, hide: 'sm' as const, value: (p: any) => kg(p.kg) },
  { key: 'kgPerUnit', label: 'kg / pièce', align: 'right' as const, hide: 'md' as const, value: (p: any) => p.kgPerUnit },
]
</script>

<template>
  <div>
    <UiPageHeader title="Rendements" description="Rendement matière et taux de rebut par produit et par ordre. Valeurs de démonstration." icon="gauge" />
    <div class="grid gap-4 sm:grid-cols-3">
      <UiStat label="Rendement global" :value="overall != null ? `${overall} %` : '—'" icon="gauge" tone="success" demo />
      <UiStat label="Matière consommée" :value="kg(totalKg)" icon="recycle" tone="info" demo />
      <UiStat label="Pièces produites" :value="num(totalProduced)" icon="package-check" tone="accent" demo />
    </div>
    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      <UiCard title="Rendement par produit" icon="chart-column"><ChartBar v-if="yieldBars.length" :data="yieldBars" horizontal unit="%" :height="220" title="Rendement par produit" /><UiEmpty v-else compact icon="chart-column" title="Pas encore de production" /></UiCard>
      <UiCard title="Rendement par ordre" icon="chart-line"><ChartLine v-if="trend[0]!.points.length > 1" :series="trend" unit="%" :height="220" title="Rendement par ordre" /><UiEmpty v-else compact icon="chart-line" title="Au moins deux ordres nécessaires" /></UiCard>
    </div>
    <UiCard class="mt-5" title="Détail par produit" icon="table-2" padding="none"><UiDataTable :rows="byProduct" :columns="columns" dense :searchable="false" export-name="rendements" /></UiCard>
    <SiteNotice class="mt-5" kind="demo" dense />
  </div>
</template>
