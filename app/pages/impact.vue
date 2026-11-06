<script setup lang="ts">
import { fmonth, num } from '#shared/utils/format'

usePageTitle('Tableau d’impact')
const db = useDb()
const root = ref<HTMLElement | null>(null)
useReveal(root)

const methodBlock = computed(() => db.all('contentBlocks').find((b) => b.key === 'impact.method')?.body)
/** Seuls les indicateurs publiés sont visibles sur la vitrine : brouillons et indicateurs validés restent en interne. */
const indicators = computed(() => db.all('envIndicators').filter((i) => i.status === 'published'))
const ICONS: Record<string, string> = { received_kg: 'package-open', rejection_rate: 'filter', used_kg: 'factory', finished_units: 'blocks' }
const period = computed(() => {
  const from = indicators.value.map((i) => i.periodFrom).sort()[0]
  const to = indicators.value.map((i) => i.periodTo).sort().at(-1)
  return from && to ? `${fmonth(from)} – ${fmonth(to)}` : ''
})
const validatedBy = (id?: string) => (id ? db.peek('users', id)?.name : undefined)

const notPublished = [
  { icon: 'cloud-off', title: 'Économie de carbone', text: 'Non calculée : elle exigerait une méthode documentée et une comparaison étayée.' },
  { icon: 'scale', title: 'Comparaison avec d’autres matériaux', text: 'Aucune comparaison tant qu’une étude indépendante n’existe pas.' },
  { icon: 'badge-percent', title: 'Labels et certifications', text: 'Aucun label n’est revendiqué.' },
  { icon: 'eye-off', title: 'Données non validées', text: 'Les brouillons et les chiffres en attente de validation restent internes.' },
]
</script>

<template>
  <div ref="root">
    <SitePageHero title="Tableau d’impact" intro="Quantités pesées, période, méthode et validation : uniquement des chiffres que nous pouvons expliquer." crumb="Impact">
      <template #aside>
        <div class="flex flex-wrap items-center gap-2"><UiDemoBadge label="Données fictives" /><span v-if="period" class="text-sm text-muted">{{ period }}</span></div>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SiteNotice kind="demo" />

      <div v-if="!indicators.length" class="mt-8">
        <UiEmpty icon="chart-no-axes-combined" title="Aucun indicateur publié pour l’instant" hint="L’équipe environnement publie un indicateur seulement après validation de sa méthode et de ses justificatifs." />
      </div>

      <div v-else class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
        <UiStat v-for="i in indicators" :key="i.id" :label="i.label" :value="`${num(i.value, i.unit === '%' ? 1 : 0)} ${i.unit}`" :icon="ICONS[i.key] ?? 'chart-no-axes-combined'" tone="accent" demo :hint="`${fmonth(i.periodFrom)} – ${fmonth(i.periodTo)}`" />
      </div>

      <div v-if="indicators.length" class="mt-10" data-reveal>
        <SiteSectionHead title="Méthode de chaque indicateur" intro="Aucun chiffre n’est publié sans sa méthodologie, sa période, un justificatif et la personne qui l’a approuvé." />
        <div class="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          <details v-for="i in indicators" :key="i.id" class="group p-4 sm:p-5">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-display font-semibold">
              <span>{{ i.label }}</span>
              <Icon name="lucide:chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p class="mt-3 max-w-3xl leading-relaxed text-muted">{{ i.methodology }}</p>
            <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt class="text-muted">Période</dt><dd class="font-medium">{{ fmonth(i.periodFrom) }} – {{ fmonth(i.periodTo) }}</dd></div>
              <div><dt class="text-muted">Justificatifs</dt><dd class="font-medium">{{ i.evidenceDocumentIds.length }} pièce(s) <UiDemoBadge /></dd></div>
              <div><dt class="text-muted">Approuvé par</dt><dd class="font-medium">{{ validatedBy(i.approvedBy) ?? 'Équipe environnement' }}</dd></div>
            </dl>
          </details>
        </div>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div data-reveal>
          <SiteSectionHead title="Comment nous mesurons" />
          <p class="mt-4 max-w-xl leading-relaxed text-muted">{{ methodBlock ?? 'Quantités mesurées à la pesée à la réception et en production, consolidées par mois et par polymère.' }}</p>
          <ul class="mt-5 space-y-3 text-[15px]">
            <li class="flex gap-3"><Icon name="lucide:scale" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>Chaque pesée est rattachée à un fournisseur, une date et un bon de réception.</span></li>
            <li class="flex gap-3"><Icon name="lucide:layers" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>Les totaux sont consolidés par mois et par polymère, puis validés avant publication.</span></li>
            <li class="flex gap-3"><Icon name="lucide:file-check-2" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>Un indicateur sans justificatif ne peut pas être publié.</span></li>
          </ul>
        </div>
        <div data-reveal>
          <SiteSectionHead title="Ce que nous ne publions pas" />
          <ul class="mt-5 grid gap-3">
            <li v-for="n in notPublished" :key="n.title" class="card flex gap-3 p-4">
              <Icon :name="`lucide:${n.icon}`" class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div><p class="font-display font-semibold">{{ n.title }}</p><p class="mt-0.5 text-[15px] text-muted">{{ n.text }}</p></div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div class="flex flex-wrap gap-2">
        <UiButton variant="outline" icon="leaf" to="/environnement">Démarche environnementale</UiButton>
        <UiButton variant="outline" icon="qr-code" to="/tracabilite">Traçabilité par lot</UiButton>
        <UiButton variant="ghost" icon="help-circle" to="/faq">Questions fréquentes</UiButton>
      </div>
    </section>
  </div>
</template>
