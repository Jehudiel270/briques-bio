<script setup lang="ts">
usePageTitle('Études de cas')
const db = useDb()
const root = ref<HTMLElement | null>(null)
useReveal(root)

const cases = computed(() => db.all('caseStudies').filter((c) => c.published))
const sector = ref('')
const sectors = computed(() => [...new Set(cases.value.map((c) => c.sector))])
const shown = computed(() => (sector.value ? cases.value.filter((c) => c.sector === sector.value) : cases.value))
const tabs = computed(() => [{ value: '', label: 'Tous', count: cases.value.length }, ...sectors.value.map((s) => ({ value: s, label: s }))])
const sectorIcon = (s: string) => (/collect/i.test(s) ? 'recycle' : /collectiv/i.test(s) ? 'trees' : /immobili/i.test(s) ? 'building-2' : 'house')
</script>

<template>
  <div ref="root">
    <SitePageHero title="Études de cas" intro="Des scénarios imaginés pour montrer le parcours complet : devis, livraison, traçabilité. Aucun n’est un projet réel." crumb="Études de cas" />

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <UiAlert tone="accent" icon="flask-conical" title="Scénarios fictifs"> Ces études de cas servent à illustrer la plateforme. Elles ne rapportent aucun chantier, client ni résultat réel et ne constituent pas des références commerciales.</UiAlert>

      <div class="mt-8"><UiTabs v-model="sector" :items="tabs" aria-label="Filtrer par secteur" /></div>

      <UiEmpty v-if="!shown.length" class="mt-8" icon="folder-search" title="Aucune étude de cas dans ce secteur" />
      <div v-else class="mt-8 grid gap-5 lg:grid-cols-2" data-reveal data-reveal-group>
        <article v-for="c in shown" :key="c.id" class="card flex flex-col p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3">
            <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${sectorIcon(c.sector)}`" class="size-5" aria-hidden="true" /></span>
            <div class="flex items-center gap-2"><UiBadge tone="neutral">{{ c.sector }}</UiBadge><UiDemoBadge label="Fictif" /></div>
          </div>
          <h2 class="mt-4 text-2xl font-semibold">{{ c.title }}</h2>
          <p class="mt-2 text-muted">{{ c.summary }}</p>
          <dl class="mt-5 space-y-4 border-t border-line pt-5 text-[15px]">
            <div><dt class="flex items-center gap-2 font-display font-semibold"><Icon name="lucide:target" class="size-4 text-primary" aria-hidden="true" />Besoin</dt><dd class="mt-1 text-muted">{{ c.challenge }}</dd></div>
            <div><dt class="flex items-center gap-2 font-display font-semibold"><Icon name="lucide:route" class="size-4 text-primary" aria-hidden="true" />Approche</dt><dd class="mt-1 text-muted">{{ c.approach }}</dd></div>
            <div><dt class="flex items-center gap-2 font-display font-semibold"><Icon name="lucide:flag" class="size-4 text-primary" aria-hidden="true" />Ce que le scénario illustre</dt><dd class="mt-1 text-muted">{{ c.outcome }}</dd></div>
          </dl>
        </article>
      </div>

      <div class="mt-10 card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-xl font-semibold">Un projet en tête ?</h2><p class="mt-1 text-muted">Décrivez votre besoin : nous le transformons en demande de devis.</p></div>
        <UiButton icon="file-text" to="/devis">Demander un devis</UiButton>
      </div>
    </section>
  </div>
</template>
