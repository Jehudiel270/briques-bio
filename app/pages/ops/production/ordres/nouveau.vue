<script setup lang="ts">
import { addDays, kg } from '#shared/utils/format'

usePageTitle('Nouvel ordre de fabrication')
const route = useRoute()
const db = useDb()
const svc = useServices()
const act = useAction()
const { rawByPolymer } = useStockView()

const productId = ref(String(route.query.product ?? ''))
const qty = ref<number | string>(Number(route.query.qty) || '')
const start = ref(new Date().toISOString().slice(0, 10))
const end = ref(addDays(new Date(), 3).slice(0, 10))
const operatorIds = ref<string[]>([])
const note = ref('')
const errors = reactive<{ product?: string; qty?: string; dates?: string }>({})
const busy = ref(false)

const products = computed(() => db.all('products').map((p) => ({ value: p.id, label: `${p.ref} · ${p.name}` })))
const operators = computed(() => db.all('operators').filter((o) => o.active))
const product = computed(() => db.peek('products', productId.value))
const freeKg = computed(() => rawByPolymer.value.reduce((a, r) => a + r.free, 0))
const toggleOp = (id: string) => { operatorIds.value = operatorIds.value.includes(id) ? operatorIds.value.filter((x) => x !== id) : [...operatorIds.value, id] }

async function submit() {
  errors.product = productId.value ? undefined : 'Choisissez un produit.'
  errors.qty = Number(qty.value) > 0 ? undefined : 'Indiquez une quantité supérieure à zéro.'
  errors.dates = start.value && end.value && end.value >= start.value ? undefined : 'La fin doit suivre le début.'
  if (errors.product || errors.qty || errors.dates) return
  busy.value = true
  let id = ''
  const ok = await act(() => {
    const wo = svc.production.createOrder({ productId: productId.value, plannedQty: Number(qty.value), plannedStart: new Date(`${start.value}T07:00:00`).toISOString(), plannedEnd: new Date(`${end.value}T17:00:00`).toISOString(), operatorIds: operatorIds.value, internalRecipeNote: note.value || undefined })
    id = wo.id
  }, 'Ordre de fabrication créé.')
  busy.value = false
  if (ok) await navigateTo(`/ops/production/ordres/${id}`)
}
</script>

<template>
  <div>
    <UiPageHeader title="Nouvel ordre de fabrication" back="/ops/production/ordres" icon="clipboard-plus" description="La matière nécessaire est estimée à la création ; la réservation se fait ensuite sur l’ordre." />
    <form class="grid gap-5 xl:grid-cols-[1.7fr_1fr]" novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-5">
        <UiCard title="Produit et quantité" icon="package">
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="Produit" required :error="errors.product" class="sm:col-span-2" #default="{ id }"><UiSelect :id="id" v-model="productId" :options="products" searchable placeholder="Choisir un produit" /></UiField>
            <UiField label="Quantité à produire (pièces)" required :error="errors.qty" #default="{ id }"><UiInput :id="id" v-model="qty" type="number" suffix="pièces" /></UiField>
            <UiField label="Stock minimum du produit" #default="{ id }"><UiInput :id="id" :model-value="product?.minStockUnits ?? '—'" disabled suffix="pièces" /></UiField>
            <UiField label="Début prévu" required :error="errors.dates" #default="{ id }"><UiInput :id="id" v-model="start" type="date" /></UiField>
            <UiField label="Fin prévue" required #default="{ id }"><UiInput :id="id" v-model="end" type="date" /></UiField>
          </div>
        </UiCard>
        <UiCard title="Équipe" icon="users">
          <UiEmpty v-if="!operators.length" compact icon="users" title="Aucun opérateur actif" hint="Ajoutez des opérateurs dans la rubrique Opérateurs." />
          <div v-else class="grid gap-2 sm:grid-cols-2">
            <UiCheckbox v-for="o in operators" :key="o.id" :model-value="operatorIds.includes(o.id)" :label="`${o.name} · ${o.station} (${o.shift})`" @update:model-value="toggleOp(o.id)" />
          </div>
        </UiCard>
        <UiCard title="Note technique interne" icon="notebook-pen">
          <UiTextarea v-model="note" :rows="3" placeholder="Réglages ou remarques de l’équipe (facultatif)" />
          <UiAlert class="mt-3" tone="warning" icon="clipboard-check" dense>Note interne uniquement : ce n’est ni une instruction de fabrication certifiée ni une donnée publiée.</UiAlert>
        </UiCard>
      </div>
      <aside class="flex flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
        <UiCard title="Disponibilité matière" icon="recycle">
          <p class="tnum font-display text-2xl font-semibold">{{ kg(freeKg) }}</p>
          <p class="mt-1 text-sm text-muted">Matière libre (hors réservations et quarantaine). La réservation vérifie la disponibilité réelle.</p>
          <UiButton class="mt-4" type="submit" icon="check" block :loading="busy">Créer l’ordre</UiButton>
        </UiCard>
        <SiteNotice kind="technical" dense />
      </aside>
    </form>
  </div>
</template>
