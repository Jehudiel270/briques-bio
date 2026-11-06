<script setup lang="ts">
import { contrastRatio, DENSITY_KEYS, DENSITY_LABEL, RADIUS_KEYS, RADIUS_LABEL, THEME_MODES, THEME_MODE_LABEL, type ThemeName } from '~/utils/theme'
import { useToast } from '~/composables/useToast'

usePageTitle('Apparence et thèmes')
const theme = useTheme()
const toast = useToast()
const editing = ref<ThemeName>('light')
const groups = computed(() => [...new Set(theme.tokens.map((t) => t.group))].map((g) => ({ group: g, items: theme.tokens.filter((t) => t.group === g) })))
const radiusOptions = RADIUS_KEYS.map((value) => ({ value, label: RADIUS_LABEL[value] }))
const densityOptions = DENSITY_KEYS.map((value) => ({ value, label: DENSITY_LABEL[value] }))
const modeOptions = THEME_MODES.map((value) => ({ value, label: THEME_MODE_LABEL[value] }))
const tabs = [{ value: 'light', label: 'Thème Clair « Atelier »' }, { value: 'dark', label: 'Thème Sombre « Graphite »' }]

const hexOf = (key: string) => { const v = theme.valueFor(editing.value, key); return /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000' }
const set = (key: string, value: string) => { if (!theme.setOverride(editing.value, key, value)) toast.error('Couleur invalide. Utilisez un format hexadécimal (#1a2b3c) ou rgb/hsl.') }
const ratio = (a: string, b: string) => contrastRatio(theme.valueFor(editing.value, a), theme.valueFor(editing.value, b))
const checks = computed(() => [
  { label: 'Texte principal sur fond', r: ratio('ink', 'bg') },
  { label: 'Texte secondaire sur surface', r: ratio('muted', 'surface') },
  { label: 'Texte sur couleur principale', r: ratio('primary-ink', 'primary') },
  { label: 'Texte sur accent', r: ratio('accent-ink', 'accent') },
])
const fmtRatio = (r: number | null) => (r == null ? '—' : `${r.toFixed(1)} : 1`)

const importText = ref('')
const importOpen = ref(false)
const download = () => {
  const blob = new Blob([theme.exportState()], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ecobloc-theme.json'; a.click(); URL.revokeObjectURL(a.href)
}
const doImport = () => { if (theme.importState(importText.value)) { toast.success('Thème importé.'); importOpen.value = false; importText.value = '' } else toast.error('Fichier de thème invalide.') }
</script>

<template>
  <div>
    <UiPageHeader title="Apparence et thèmes" description="Deux thèmes professionnels entièrement personnalisables : couleurs, angles et densité. Les réglages s’appliquent en direct sur cet appareil." icon="palette">
      <template #actions>
        <UiButton variant="outline" icon="upload" @click="importOpen = true">Importer</UiButton>
        <UiButton variant="outline" icon="download" @click="download">Exporter (JSON)</UiButton>
      </template>
    </UiPageHeader>

    <div class="grid gap-5 xl:grid-cols-[1fr_1.7fr]">
      <div class="flex flex-col gap-5">
        <UiCard title="Mode d’affichage" icon="sun-moon">
          <UiField label="Thème actif" #default="{ id }"><UiSelect :id="id" :model-value="theme.mode.value" :options="modeOptions" @update:model-value="(v: any) => theme.setMode(v)" /></UiField>
          <p class="mt-2 text-[13px] text-muted">Mode actuellement affiché : <strong>{{ theme.resolved.value === 'dark' ? 'Sombre' : 'Clair' }}</strong>.</p>
        </UiCard>
        <UiCard title="Formes et densité" icon="square-round-corner">
          <div class="flex flex-col gap-4">
            <UiField label="Arrondis" #default="{ id }"><UiSelect :id="id" :model-value="theme.radius.value" :options="radiusOptions" @update:model-value="(v: any) => theme.setRadius(v)" /></UiField>
            <UiField label="Densité" #default="{ id }"><UiSelect :id="id" :model-value="theme.density.value" :options="densityOptions" @update:model-value="(v: any) => theme.setDensity(v)" /></UiField>
          </div>
        </UiCard>
        <UiCard title="Lisibilité (contraste)" icon="contrast" :description="editing === 'light' ? 'Thème Clair' : 'Thème Sombre'">
          <ul class="divide-y divide-line text-sm">
            <li v-for="c in checks" :key="c.label" class="flex items-center justify-between gap-2 py-2.5"><span>{{ c.label }}</span><span class="flex items-center gap-2"><span class="tnum text-muted">{{ fmtRatio(c.r) }}</span><UiBadge :tone="c.r != null && c.r >= 4.5 ? 'success' : 'warning'" size="sm">{{ c.r != null && c.r >= 4.5 ? 'AA' : 'Faible' }}</UiBadge></span></li>
          </ul>
          <p class="mt-3 text-[13px] text-muted">Un rapport d’au moins 4,5 : 1 est recommandé pour le texte courant.</p>
        </UiCard>
      </div>

      <UiCard title="Palette de couleurs" icon="paintbrush" description="Cliquez sur une pastille pour modifier une couleur ; « Réinitialiser » restaure la valeur d’origine.">
        <template #actions><UiButton size="sm" variant="ghost" icon="rotate-ccw" @click="theme.resetOverrides(editing)">Réinitialiser ce thème</UiButton></template>
        <UiTabs v-model="editing" :items="tabs" aria-label="Thème à modifier" class="mb-4" />
        <div class="flex flex-col gap-6">
          <section v-for="g in groups" :key="g.group">
            <h3 class="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{{ g.group }}</h3>
            <ul class="grid gap-3 sm:grid-cols-2">
              <li v-for="t in g.items" :key="t.key" class="flex items-center gap-3 rounded-lg border border-line p-2.5">
                <label class="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line" :style="{ background: theme.valueFor(editing, t.key) }">
                  <span class="sr-only">Couleur : {{ t.label }}</span>
                  <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" :value="hexOf(t.key)" @input="set(t.key, ($event.target as HTMLInputElement).value)">
                </label>
                <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">{{ t.label }}</p><p class="tnum truncate text-[12px] text-muted">{{ theme.valueFor(editing, t.key) }}</p></div>
                <UiButton v-if="theme.isOverridden(editing, t.key)" size="sm" variant="ghost" icon="rotate-ccw" :aria-label="`Réinitialiser ${t.label}`" @click="theme.setOverride(editing, t.key, '')" />
              </li>
            </ul>
          </section>
        </div>
      </UiCard>
    </div>

    <UiCard class="mt-5" title="Aperçu en direct" icon="eye">
      <div class="flex flex-wrap items-center gap-3">
        <UiButton icon="check">Action principale</UiButton><UiButton variant="outline" icon="download">Secondaire</UiButton>
        <UiBadge tone="success" dot>Succès</UiBadge><UiBadge tone="warning" dot>Alerte</UiBadge><UiBadge tone="danger" dot>Erreur</UiBadge><UiBadge tone="info" dot>Information</UiBadge>
      </div>
    </UiCard>

    <UiDialog v-model:open="importOpen" title="Importer un thème" description="Collez le contenu d’un fichier exporté depuis cette page.">
      <UiTextarea v-model="importText" :rows="8" placeholder="{ &quot;mode&quot;: &quot;light&quot;, … }" aria-label="Contenu JSON du thème" />
      <template #footer><UiButton variant="ghost" @click="importOpen = false">Annuler</UiButton><UiButton icon="upload" :disabled="!importText.trim()" @click="doImport">Importer</UiButton></template>
    </UiDialog>
  </div>
</template>
