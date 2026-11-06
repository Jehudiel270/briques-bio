<script setup lang="ts">
import { VALIDATION_RESTRICTION } from '#shared/services/catalog'
import { fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { MediaRef, Product, ValidationStatus } from '#shared/types/domain'
import { cleanValues, initialValues, validateAll, type FieldDef } from '~/utils/forms'

/** Fiche produit complète (création si `id` absent). Le statut de validation ne se change que par le service catalogue. */
const props = defineProps<{ id?: string }>()
const db = useDb()
const svc = useServices()
const act = useAction()
const toast = useToast()

const product = computed(() => (props.id ? db.get('products', props.id) : undefined))
const isNew = computed(() => !props.id)
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const categories = computed(() => db.all('categories').map((c) => ({ value: c.id, label: c.name })))
const zones = computed(() => useSettings().value.zones.map((z) => ({ value: z.id, label: z.name })))
const base = computed<FieldDef[]>(() => [
  { key: 'ref', label: 'Référence', type: 'text', required: true },
  { key: 'name', label: 'Nom', type: 'text', required: true },
  { key: 'categoryId', label: 'Catégorie', type: 'select', required: true, options: categories.value },
  { key: 'pattern', label: 'Forme du visuel de repli', type: 'select', required: true, options: ['paver', 'slab', 'kerb', 'tile', 'plank', 'block'].map((value) => ({ value, label: { paver: 'Pavé', slab: 'Dalle', kerb: 'Bordure', tile: 'Carreau', plank: 'Lame', block: 'Bloc' }[value]! })) },
  { key: 'description', label: 'Description', type: 'textarea', required: true, span: 2, rows: 4, hint: 'Décrivez la matière et l’usage visé sans promesse de performance non démontrée.' },
  { key: 'photos', label: 'Photos (Cloudinary)', type: 'media', folder: 'produits', multiple: true, span: 2 },
])
const dims = computed<FieldDef[]>(() => [
  { key: 'lengthMm', label: 'Longueur (mm)', type: 'number', required: true, min: 1 },
  { key: 'widthMm', label: 'Largeur (mm)', type: 'number', required: true, min: 1 },
  { key: 'heightMm', label: 'Épaisseur (mm)', type: 'number', required: true, min: 1 },
  { key: 'unitWeightKg', label: 'Poids unitaire (kg)', type: 'number', min: 0, step: 0.01 },
  { key: 'saleUnit', label: 'Unité de vente', type: 'select', required: true, options: [{ value: 'piece', label: 'Pièce' }, { value: 'm2', label: 'm²' }, { value: 'ml', label: 'Mètre linéaire' }, { value: 'pallet', label: 'Palette' }] },
  { key: 'unitsPerPallet', label: 'Pièces par palette', type: 'number', min: 1 },
  { key: 'm2PerUnit', label: 'm² par pièce', type: 'number', min: 0, step: 0.001 },
  { key: 'finishes', label: 'Finitions', type: 'tags', span: 2, placeholder: 'Ajouter une finition puis Entrée' },
])
const commerce = computed<FieldDef[]>(() => [
  { key: 'priceIndicative', label: 'Prix indicatif (FCFA par unité de vente)', type: 'currency', min: 0, hint: 'Laissez vide pour « sur devis ». Prix fictif de démonstration.' },
  { key: 'minOrderQty', label: 'Quantité minimale de commande', type: 'number', required: true, min: 1 },
  { key: 'minStockUnits', label: 'Seuil d’alerte de stock (pièces)', type: 'number', required: true, min: 0 },
  { key: 'deliveryZones', label: 'Zones de livraison', type: 'multiselect', options: zones.value, span: 2 },
  { key: 'published', label: 'Publié dans le catalogue public', type: 'switch' },
  { key: 'featured', label: 'Mis en avant', type: 'switch' },
])
const usage = computed<FieldDef[]>(() => [
  { key: 'allowedUses', label: 'Usages prévus (non structurels)', type: 'tags', span: 2, placeholder: 'Ex. allée piétonne, jardin, terrasse' },
  { key: 'restrictions', label: 'Restrictions d’usage', type: 'tags', span: 2, placeholder: 'Ex. non destiné aux usages structurels' },
  { key: 'installNotes', label: 'Notes de pose', type: 'textarea', span: 2, rows: 3, hint: 'Publiées uniquement si elles sont validées par la qualité.' },
])
const all = computed(() => [...base.value, ...dims.value, ...commerce.value, ...usage.value])

const values = reactive<Record<string, any>>({})
const errors = reactive<Record<string, string>>({})
const colors = ref<{ name: string; hex: string }[]>([])
const tone = ref('#8a8f98')
function load() {
  for (const k of Object.keys(values)) delete values[k]
  const p = product.value
  const seed = p ? { ...p, ...p.dimensions, photos: p.photos } : { pattern: 'paver', saleUnit: 'piece', minOrderQty: 1, minStockUnits: 0, published: false, featured: false, categoryId: String(categories.value[0]?.value ?? ''), finishes: [], allowedUses: [], restrictions: [VALIDATION_RESTRICTION], deliveryZones: [], photos: [] }
  Object.assign(values, initialValues(all.value, seed as any))
  colors.value = p ? p.colors.map((c) => ({ ...c })) : [{ name: 'Gris anthracite', hex: '#4b5059' }]
  tone.value = p?.tone ?? '#8a8f98'
}
load()
watch(product, load)

const saving = ref(false)
async function save() {
  for (const k of Object.keys(errors)) delete errors[k]
  Object.assign(errors, validateAll(all.value, values))
  if (colors.value.some((c) => !c.name.trim())) errors.colors = 'Chaque couleur doit avoir un nom.'
  if (Object.keys(errors).length) { toast.error('Corrigez les champs signalés avant d’enregistrer.'); return }
  const v = cleanValues(all.value, values)
  const now = new Date().toISOString()
  const data = {
    ref: v.ref, name: v.name, slug: product.value?.slug ?? slugify(String(v.name)), categoryId: v.categoryId, description: v.description, photos: (v.photos ?? []) as MediaRef[], tone: tone.value, pattern: v.pattern,
    dimensions: { lengthMm: Number(v.lengthMm), widthMm: Number(v.widthMm), heightMm: Number(v.heightMm) }, unitWeightKg: v.unitWeightKg ?? undefined, saleUnit: v.saleUnit, unitsPerPallet: v.unitsPerPallet ?? undefined, m2PerUnit: v.m2PerUnit ?? undefined,
    finishes: v.finishes ?? [], colors: colors.value.map((c) => ({ name: c.name.trim(), hex: c.hex })), priceIndicative: v.priceIndicative == null || v.priceIndicative === '' ? null : Number(v.priceIndicative),
    minOrderQty: Number(v.minOrderQty), minStockUnits: Number(v.minStockUnits), deliveryZones: v.deliveryZones ?? [], allowedUses: v.allowedUses ?? [], restrictions: v.restrictions ?? [], installNotes: v.installNotes || undefined,
    published: !!v.published, featured: !!v.featured, updatedAt: now,
  }
  saving.value = true
  let newId = ''
  const ok = await act(() => {
    if (product.value) db.update('products', product.value.id, data as any, { summary: `Produit modifié · ${data.ref}` })
    else newId = db.create('products', { ...data, documentIds: [], leadTimeLabel: 'À confirmer', validation: 'development', installNotesValidated: false, requiresReleasedLot: true, createdAt: now, demo: true } as any, { summary: `Produit créé · ${data.ref}` }).id
  }, isNew.value ? 'Produit créé (en développement).' : 'Produit enregistré.')
  saving.value = false
  if (ok && newId) await navigateTo(`/admin/produits/${newId}`)
}

// Validation
const vOpen = ref(false)
const vFields = computed<FieldDef[]>(() => [
  { key: 'status', label: 'Nouveau statut', type: 'select', required: true, options: (Object.keys(STATUS.validation) as ValidationStatus[]).map((value) => ({ value, label: STATUS.validation[value].label, disabled: value === product.value?.validation })), span: 2 },
  { key: 'note', label: 'Justification', type: 'textarea', required: true, span: 2, rows: 3 },
])
const setValidation = (v: Record<string, any>) => svc.catalog.setValidation(props.id!, v.status, String(v.note))
const docs = computed(() => db.all('documents').filter((d) => d.productId === props.id))
</script>

<template>
  <div>
    <UiEmpty v-if="!isNew && !product" icon="package-x" title="Produit introuvable"><UiButton icon="arrow-left" to="/admin/produits">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="isNew ? 'Nouveau produit' : product!.name" back="/admin/produits" icon="package" :description="isNew ? 'Un nouveau produit démarre « en développement » : il ne devient commercialisable qu’après validation.' : `${product!.ref} · mis à jour le ${fdate(product!.updatedAt)}`">
        <template v-if="product" #meta><UiStatusBadge kind="validation" :value="product.validation" /><UiBadge :tone="product.published ? 'success' : 'neutral'" dot>{{ product.published ? 'Publié' : 'Masqué' }}</UiBadge></template>
        <template #actions><UiButton v-if="product" variant="outline" icon="external-link" :to="`/catalogue/${product.slug}`">Voir la fiche publique</UiButton><UiButton icon="save" :loading="saving" @click="save">Enregistrer</UiButton></template>
      </UiPageHeader>

      <div class="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <form class="flex flex-col gap-5" novalidate @submit.prevent="save">
          <UiCard title="Identité" icon="tag"><UiFormFields :fields="base" :values="values" :errors="errors" prefix="p-base" /></UiCard>
          <UiCard title="Dimensions et conditionnement" icon="ruler"><UiFormFields :fields="dims" :values="values" :errors="errors" prefix="p-dims" /></UiCard>
          <UiCard title="Couleurs" icon="palette" :description="errors.colors">
            <div class="flex flex-col gap-2">
              <div v-for="(c, i) in colors" :key="i" class="flex items-center gap-2">
                <input v-model="c.hex" type="color" class="size-10 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5" :aria-label="`Teinte de ${c.name || 'la couleur'}`">
                <UiInput v-model="c.name" placeholder="Nom de la couleur" class="flex-1" :aria-label="`Nom de la couleur ${i + 1}`" />
                <UiButton variant="ghost" icon="trash-2" :aria-label="`Retirer la couleur ${i + 1}`" @click="colors.splice(i, 1)" />
              </div>
              <div class="flex items-center gap-3"><UiButton size="sm" variant="outline" icon="plus" @click="colors.push({ name: '', hex: '#888888' })">Ajouter une couleur</UiButton>
                <label class="flex items-center gap-2 text-[13px] text-muted"><input v-model="tone" type="color" class="size-7 cursor-pointer rounded border border-line bg-transparent p-0">Teinte du visuel de repli</label></div>
            </div>
          </UiCard>
          <UiCard title="Commerce" icon="shopping-cart"><UiFormFields :fields="commerce" :values="values" :errors="errors" prefix="p-com" /></UiCard>
          <UiCard title="Usages et restrictions" icon="shield-alert"><UiFormFields :fields="usage" :values="values" :errors="errors" prefix="p-use" /></UiCard>
          <div class="flex justify-end"><UiButton type="submit" icon="save" :loading="saving">Enregistrer le produit</UiButton></div>
        </form>

        <aside class="flex flex-col gap-5">
          <UiCard v-if="product" title="Validation produit" icon="badge-check">
            <UiStatusBadge kind="validation" :value="product.validation" />
            <p class="mt-3 text-sm text-muted">Statuts : développement → test → résultats → autorisé. « Autorisé » exige au moins un rapport d’essai ou une fiche technique <strong>publié</strong> pour ce produit.</p>
            <p class="mt-2 text-sm">Délai affiché : <strong>{{ product.leadTimeLabel }}</strong></p>
            <UiButton class="mt-4" icon="shield-check" @click="vOpen = true">Changer le statut</UiButton>
          </UiCard>
          <UiCard v-if="product" title="Documents rattachés" icon="files">
            <UiEmpty v-if="!docs.length" compact icon="files" title="Aucun document" hint="Ajoutez fiches et rapports dans Qualité → Documents." />
            <ul v-else class="divide-y divide-line text-sm"><li v-for="d in docs" :key="d.id" class="flex items-center justify-between gap-2 py-2"><span class="truncate">{{ d.title }}</span><UiStatusBadge kind="document" :value="d.status" size="sm" /></li></ul>
          </UiCard>
          <UiAlert tone="warning" icon="octagon-alert" title="Règles de crédibilité">Pas de promesse « plus résistant que le béton », « ignifuge » ou « sans danger ». Aucun usage structurel. Les mentions « certifié » ou « conforme à la norme » sont interdites sans preuve publiée.</UiAlert>
        </aside>
      </div>
      <UiFormDialog v-if="product" v-model:open="vOpen" title="Changer le statut de validation" :fields="vFields" :initial="{ note: '' }" submit-label="Appliquer" @submit="setValidation" />
    </template>
  </div>
</template>
