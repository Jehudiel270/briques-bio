<script setup lang="ts">
import { fcfa } from '#shared/utils/format'
import type { PriceGrid } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Prix et grilles')
const db = useDb()
const act = useAction()
const L = useLookups()
const audienceLabel = { public: 'Public', pro: 'Professionnels', distributor: 'Distributeurs' } as const
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom de la grille', type: 'text', required: true, span: 2 },
  { key: 'audience', label: 'Public concerné', type: 'select', required: true, options: Object.entries(audienceLabel).map(([value, label]) => ({ value, label })) },
  { key: 'defaultDiscountPct', label: 'Remise par défaut (%)', type: 'number', required: true, min: 0, max: 60, step: 0.5 },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 2 },
  { key: 'active', label: 'Grille active', type: 'switch', span: 2 },
]
const columns = [
  { key: 'name', label: 'Grille', sortable: true },
  { key: 'audience', label: 'Public', hide: 'sm' as const, value: (g: PriceGrid) => audienceLabel[g.audience] },
  { key: 'defaultDiscountPct', label: 'Remise', align: 'right' as const, sortable: true, value: (g: PriceGrid) => `${g.defaultDiscountPct} %`, sortValue: (g: PriceGrid) => g.defaultDiscountPct },
  { key: 'tiers', label: 'Paliers', align: 'right' as const, hide: 'md' as const, value: (g: PriceGrid) => g.tiers.length },
  { key: 'companies', label: 'Entreprises', align: 'right' as const, hide: 'md' as const, value: (g: PriceGrid) => db.all('companies').filter((c) => c.priceGridId === g.id).length },
  { key: 'active', label: 'Statut', value: (g: PriceGrid) => (g.active ? 'Active' : 'Inactive') },
]
const fromValues = (v: Record<string, any>, row?: PriceGrid) => ({ name: v.name, audience: v.audience, defaultDiscountPct: Number(v.defaultDiscountPct), tiers: row?.tiers ?? [], notes: v.notes || undefined, active: !!v.active })

// Éditeur de paliers
const grid = ref<PriceGrid | null>(null)
const tiers = ref<{ productId: string; minQty: number | string; unitPrice: number | string }[]>([])
const open = computed({ get: () => !!grid.value, set: (v) => { if (!v) grid.value = null } })
const edit = (g: PriceGrid) => { grid.value = g; tiers.value = g.tiers.map((t) => ({ ...t })) }
const productOptions = computed(() => db.all('products').map((p) => ({ value: p.id, label: `${p.ref} · ${p.name}` })))
const add = () => tiers.value.push({ productId: String(productOptions.value[0]?.value ?? ''), minQty: 1, unitPrice: '' })
const tierError = computed(() => tiers.value.some((t) => !t.productId || !(Number(t.minQty) >= 1) || !(Number(t.unitPrice) > 0)) ? 'Chaque palier exige un produit, une quantité minimale ≥ 1 et un prix positif.' : '')
const saving = ref(false)
async function saveTiers() {
  if (tierError.value || !grid.value) return
  saving.value = true
  const ok = await act(() => db.update('priceGrids', grid.value!.id, { tiers: tiers.value.map((t) => ({ productId: t.productId, minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) })).sort((a, b) => a.productId.localeCompare(b.productId) || a.minQty - b.minQty) } as any, { summary: `Paliers de prix · ${grid.value!.name}` }), 'Paliers enregistrés.')
  saving.value = false
  if (ok) grid.value = null
}
</script>

<template>
  <div>
    <WsCrud collection="priceGrids" title="Prix et grilles" description="Grilles tarifaires par public et paliers de prix par produit. Tous les prix sont fictifs." icon="badge-percent" :columns="columns" :fields="fields" noun="grille" create-label="Nouvelle grille" :defaults="{ audience: 'pro', defaultDiscountPct: 0, active: true }" :from-values="fromValues" export-name="grilles-tarifaires">
      <template #cell-active="{ row }"><UiBadge :tone="row.active ? 'success' : 'neutral'" size="sm" dot>{{ row.active ? 'Active' : 'Inactive' }}</UiBadge></template>
      <template #row-actions="{ row }"><UiButton size="sm" variant="outline" icon="list-ordered" @click.stop="edit(row)">Paliers</UiButton></template>
    </WsCrud>
    <SiteNotice class="mt-4" kind="demo" dense />
    <UiAlert class="mt-3" tone="info" icon="truck" dense>Les frais de livraison par zone se gèrent dans <NuxtLink to="/ops/logistique/frais" class="underline">Logistique → Frais</NuxtLink>.</UiAlert>

    <UiDialog v-model:open="open" :title="`Paliers · ${grid?.name ?? ''}`" description="Prix unitaire en FCFA à partir d’une quantité minimale, par produit." size="xl">
      <UiEmpty v-if="!tiers.length" compact icon="list-ordered" title="Aucun palier" hint="Sans palier, la remise par défaut s’applique au tarif public." />
      <ul v-else class="flex flex-col gap-3">
        <li v-for="(t, i) in tiers" :key="i" class="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <UiField label="Produit" #default="{ id }"><UiSelect :id="id" :model-value="t.productId" :options="productOptions" searchable @update:model-value="(v: any) => (t.productId = String(v))" /></UiField>
          <UiField label="À partir de" #default="{ id }"><UiInput :id="id" v-model="t.minQty" type="number" /></UiField>
          <UiField label="Prix unitaire" #default="{ id }"><UiInput :id="id" v-model="t.unitPrice" type="number" suffix="FCFA" /></UiField>
          <UiButton variant="ghost" icon="trash-2" :aria-label="`Retirer le palier ${i + 1}`" @click="tiers.splice(i, 1)" />
        </li>
      </ul>
      <p v-if="tierError" class="mt-3 text-sm text-danger" role="alert">{{ tierError }}</p>
      <p v-else-if="tiers.length" class="mt-3 text-[13px] text-muted">{{ tiers.length }} palier(s) · exemple : {{ L.productName(tiers[0]!.productId) }} à partir de {{ tiers[0]!.minQty }} → {{ fcfa(Number(tiers[0]!.unitPrice) || 0) }}</p>
      <template #footer><UiButton variant="outline" icon="plus" @click="add">Ajouter un palier</UiButton><UiButton icon="save" :disabled="!!tierError" :loading="saving" @click="saveTiers">Enregistrer</UiButton></template>
    </UiDialog>
  </div>
</template>
