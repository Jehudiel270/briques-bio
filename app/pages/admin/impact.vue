<script setup lang="ts">
import { fmonth } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'

usePageTitle('Impact environnemental')
const db = useDb()
const settings = useSettings()
const act = useAction()
const indicators = computed(() => [...db.all('envIndicators')].sort((a, b) => b.periodTo.localeCompare(a.periodTo)))
const published = computed(() => indicators.value.filter((i) => i.status === 'published'))
const enabled = computed(() => settings.value.features.publicImpactPage)
const toggle = () => act(() => db.update('settings', 'company', { features: { ...settings.value.features, publicImpactPage: !enabled.value } } as any, { summary: `Page d’impact publique ${enabled.value ? 'désactivée' : 'activée'}` }), enabled.value ? 'Page d’impact masquée.' : 'Page d’impact activée.')
const steps = [
  { icon: 'table-2', title: 'Mesurer', text: 'Quantités pesées et produites, agrégées par mois.', to: '/ops/environnement/donnees' },
  { icon: 'book-text', title: 'Documenter', text: 'Méthodologie obligatoire pour chaque indicateur.', to: '/ops/environnement/methodologie' },
  { icon: 'files', title: 'Prouver', text: 'Pièces justificatives rattachées à l’indicateur.', to: '/ops/environnement/preuves' },
  { icon: 'globe', title: 'Publier', text: 'Validation puis publication sur la page publique.', to: '/ops/environnement/publication' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Impact environnemental" description="Supervision de ce qui est publié. Un indicateur n’est visible du public qu’après validation, méthodologie et preuves." icon="leaf">
      <template #actions><UiButton variant="outline" icon="external-link" to="/impact">Voir la page publique</UiButton></template>
    </UiPageHeader>
    <div class="grid gap-4 sm:grid-cols-3">
      <UiStat label="Indicateurs publiés" :value="published.length" icon="globe" tone="success" />
      <UiStat label="En attente de validation" :value="indicators.filter((i) => i.status === 'draft').length" icon="clock" tone="warning" />
      <UiStat label="Page publique" :value="enabled ? 'Activée' : 'Masquée'" icon="eye" :tone="enabled ? 'info' : 'neutral'" />
    </div>
    <UiAlert class="mt-5" tone="info" icon="calculator" title="Pas de calcul automatique de CO₂">La plateforme publie des quantités mesurées. Aucune économie de carbone n’est affichée sans protocole validé et preuves.</UiAlert>
    <div class="mt-5 grid gap-4 md:grid-cols-4">
      <UiCard v-for="s in steps" :key="s.title" :title="s.title" :icon="s.icon"><p class="text-sm text-muted">{{ s.text }}</p><UiButton class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="s.to">Ouvrir</UiButton></UiCard>
    </div>
    <UiCard class="mt-5" title="Indicateurs" icon="list-checks">
      <template #actions><UiButton size="sm" variant="outline" :icon="enabled ? 'eye-off' : 'eye'" @click="toggle">{{ enabled ? 'Masquer la page publique' : 'Activer la page publique' }}</UiButton></template>
      <UiEmpty v-if="!indicators.length" compact icon="leaf" title="Aucun indicateur" />
      <ul v-else class="divide-y divide-line text-sm">
        <li v-for="i in indicators" :key="i.id" class="flex flex-wrap items-center justify-between gap-2 py-3"><div class="min-w-0"><p class="font-medium">{{ i.label }}</p><p class="text-[13px] text-muted">{{ new Intl.NumberFormat('fr-FR').format(i.value) }} {{ i.unit }} · {{ fmonth(i.periodFrom) }} → {{ fmonth(i.periodTo) }} · {{ i.evidenceDocumentIds.length }} preuve(s)</p></div><UiStatusBadge kind="indicator" :value="i.status" size="sm" /></li>
      </ul>
      <p class="mt-3 text-[13px] text-muted">{{ STATUS.indicator.published.label }} : visible sur la page d’impact publique.</p>
    </UiCard>
  </div>
</template>
