<script setup lang="ts">
import type { AppSettings } from '#shared/types/domain'

usePageTitle('Paramètres')
const db = useDb()
const act = useAction()
const settings = useSettings()

const clone = (s: AppSettings) => JSON.parse(JSON.stringify(s)) as AppSettings
const form = reactive(clone(settings.value))
const resync = () => Object.assign(form, clone(settings.value))
watch(() => settings.value, resync)
const dirty = computed(() => JSON.stringify(form) !== JSON.stringify(settings.value))
const saving = ref(false)
const errors = reactive<Record<string, string>>({})

const num = (v: unknown) => (v === '' || v == null ? NaN : Number(v))
function validate() {
  for (const k of Object.keys(errors)) delete errors[k]
  if (!form.brand.name.trim()) errors.brandName = 'Le nom de la marque est requis.'
  if (!form.company.legalName.trim()) errors.legalName = 'La raison sociale est requise.'
  if (form.company.email && !/^\S+@\S+\.\S+$/.test(form.company.email)) errors.email = 'Adresse e-mail invalide.'
  const vat = num(form.vatRatePct); if (!(vat >= 0 && vat <= 40)) errors.vat = 'Entre 0 et 40 %.'
  const dep = num(form.defaultDepositPct); if (!(dep >= 0 && dep <= 100)) errors.deposit = 'Entre 0 et 100 %.'
  const val = num(form.quoteValidityDays); if (!(val >= 1 && val <= 180)) errors.validity = 'Entre 1 et 180 jours.'
  return !Object.keys(errors).length
}
async function save() {
  if (!validate()) return
  saving.value = true
  await act(() => db.update('settings', 'company', { brand: form.brand, company: form.company, vatRatePct: Number(form.vatRatePct), defaultDepositPct: Number(form.defaultDepositPct), quoteValidityDays: Number(form.quoteValidityDays), features: form.features, demoBanner: form.demoBanner } as any, { summary: 'Paramètres de la plateforme modifiés' }), 'Paramètres enregistrés.')
  saving.value = false
}
const features: { key: keyof AppSettings['features']; label: string; hint: string }[] = [
  { key: 'collectorPayouts', label: 'Rémunération simulée des collecteurs', hint: 'Calcule une rémunération fictive à chaque réception.' },
  { key: 'distributorPortfolio', label: 'Portefeuille distributeur', hint: 'Suivi des ventes et marges pour les revendeurs.' },
  { key: 'proPriceGrid', label: 'Grilles tarifaires professionnelles', hint: 'Applique les prix négociés aux comptes pro.' },
  { key: 'publicImpactPage', label: 'Page d’impact publique', hint: 'N’affiche que les indicateurs validés et publiés.' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Paramètres" description="Identité, coordonnées, règles commerciales et fonctionnalités de la plateforme." icon="settings">
      <template #actions><UiButton v-if="dirty" variant="ghost" @click="resync">Annuler</UiButton><UiButton icon="save" :disabled="!dirty" :loading="saving" @click="save">Enregistrer</UiButton></template>
    </UiPageHeader>
    <form class="grid gap-5 xl:grid-cols-2" novalidate @submit.prevent="save">
      <UiCard title="Marque" icon="badge">
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Nom de la marque" required :error="errors.brandName" #default="{ id }"><UiInput :id="id" v-model="form.brand.name" /></UiField>
          <UiField label="Monogramme" hint="2 lettres, affichées dans le logo." #default="{ id }"><UiInput :id="id" v-model="form.brand.monogram" :maxlength="3" /></UiField>
          <UiField label="Slogan" class="sm:col-span-2" #default="{ id }"><UiInput :id="id" v-model="form.brand.tagline" /></UiField>
        </div>
      </UiCard>
      <UiCard title="Entreprise" icon="building-2">
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Raison sociale" required :error="errors.legalName" class="sm:col-span-2" #default="{ id }"><UiInput :id="id" v-model="form.company.legalName" /></UiField>
          <UiField label="Adresse" #default="{ id }"><UiInput :id="id" v-model="form.company.address" /></UiField>
          <UiField label="Ville" #default="{ id }"><UiInput :id="id" v-model="form.company.city" /></UiField>
          <UiField label="Téléphone" #default="{ id }"><UiInput :id="id" v-model="form.company.phone" type="tel" /></UiField>
          <UiField label="E-mail" :error="errors.email" #default="{ id }"><UiInput :id="id" v-model="form.company.email" type="email" /></UiField>
        </div>
      </UiCard>
      <UiCard title="Règles commerciales" icon="percent">
        <div class="grid gap-4 sm:grid-cols-3">
          <UiField label="TVA" :error="errors.vat" #default="{ id }"><UiInput :id="id" v-model="form.vatRatePct" type="number" suffix="%" /></UiField>
          <UiField label="Acompte par défaut" :error="errors.deposit" #default="{ id }"><UiInput :id="id" v-model="form.defaultDepositPct" type="number" suffix="%" /></UiField>
          <UiField label="Validité des devis" :error="errors.validity" #default="{ id }"><UiInput :id="id" v-model="form.quoteValidityDays" type="number" suffix="jours" /></UiField>
        </div>
        <p class="mt-3 text-[13px] text-muted">Devise : {{ form.currency === 'XOF' ? 'franc CFA (FCFA)' : form.currency }}. Les montants restent des valeurs de démonstration.</p>
      </UiCard>
      <UiCard title="Fonctionnalités" icon="toggle-right">
        <ul class="flex flex-col gap-4">
          <li v-for="f in features" :key="f.key" class="flex items-start justify-between gap-4"><div><p class="text-sm font-medium">{{ f.label }}</p><p class="text-[13px] text-muted">{{ f.hint }}</p></div><UiSwitch v-model="form.features[f.key]" :aria-label="f.label" /></li>
        </ul>
      </UiCard>
      <UiCard title="Bandeau de démonstration" icon="flask-conical" class="xl:col-span-2">
        <UiField label="Message affiché sur toutes les pages en mode démonstration" #default="{ id }"><UiTextarea :id="id" v-model="form.demoBanner" :rows="2" /></UiField>
        <p class="mt-2 text-[13px] text-muted">Conservez la mention « fictif » : elle protège contre toute confusion avec une activité réelle.</p>
      </UiCard>
      <p class="text-[13px] text-muted xl:col-span-2">Les zones de livraison se gèrent dans <NuxtLink to="/ops/logistique/frais" class="underline">Logistique → Frais</NuxtLink>, les règles par plastique dans <NuxtLink to="/ops/appro/polymeres" class="underline">Appro → Types de plastique</NuxtLink>.</p>
    </form>
  </div>
</template>
