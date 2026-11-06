<script setup lang="ts">
usePageTitle('Démarche environnementale')

const principles = [
  { icon: 'ruler', title: 'Mesurer avant d’affirmer', text: 'Nous publions des quantités pesées : kilos reçus, acceptés, rejetés, utilisés, pièces fabriquées. Chaque chiffre a une méthode et une pièce justificative.' },
  { icon: 'book-open-check', title: 'Dire comment c’est calculé', text: 'Aucun indicateur n’est publié sans sa méthodologie, sa période et la personne qui l’a validé.' },
  { icon: 'ban', title: 'Ne pas surpromettre', text: 'Pas d’économie de carbone annoncée sans méthode documentée, pas de comparaison avec d’autres matériaux sans étude, pas de label non obtenu.' },
  { icon: 'users', title: 'Impliquer la filière', text: 'Collecteurs, coopératives et ateliers voient leurs quantités acceptées et leurs justificatifs : la mesure sert aussi à les rémunérer correctement.' },
]

const watchpoints = [
  { icon: 'flame', title: 'Comportement au feu', text: 'Non qualifié à ce stade : aucun usage où le feu est un risque ne peut être proposé.' },
  { icon: 'sun', title: 'Vieillissement et UV', text: 'Tenue dans le temps à documenter par des essais, notamment en plein soleil et en climat chaud et humide.' },
  { icon: 'footprints', title: 'Glissance', text: 'À mesurer selon la finition avant tout usage en zone humide ou en pente.' },
  { icon: 'recycle', title: 'Fin de vie', text: 'Reprise et recyclage des produits en fin de vie à organiser avec les clients.' },
  { icon: 'microscope', title: 'Particules et usure', text: 'Émission de microparticules par abrasion à évaluer.' },
]
</script>

<template>
  <div>
    <SitePageHero title="Démarche environnementale" intro="Donner une seconde vie à des plastiques collectés localement, en restant précis sur ce que nous savons, ce que nous mesurons et ce qui reste à démontrer." crumb="Démarche">
      <template #actions>
        <UiButton icon="chart-no-axes-combined" to="/impact">Voir le tableau d’impact</UiButton>
        <UiButton variant="outline" icon="recycle" to="/materiaux">Nos matériaux</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Quatre principes" />
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <article v-for="p in principles" :key="p.title" class="card flex gap-4 p-5">
          <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${p.icon}`" class="size-5" aria-hidden="true" /></span>
          <div><h3 class="font-display text-lg font-semibold">{{ p.title }}</h3><p class="mt-1.5 leading-relaxed text-muted">{{ p.text }}</p></div>
        </article>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SiteSectionHead title="Points de vigilance connus" intro="Un matériau recyclé n’est pas sans question. Voici ce qui doit être documenté avant toute commercialisation." />
        <ul class="mt-8 grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
          <li v-for="w in watchpoints" :key="w.title" class="flex gap-3">
            <Icon :name="`lucide:${w.icon}`" class="mt-1 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div><h3 class="font-display font-semibold">{{ w.title }}</h3><p class="mt-1 text-[15px] leading-relaxed text-muted">{{ w.text }}</p></div>
          </li>
        </ul>
        <div class="mt-8 max-w-3xl"><SiteNotice kind="technical" /></div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div class="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div class="max-w-2xl">
          <h2 class="text-2xl font-semibold">Des chiffres, avec leur méthode</h2>
          <p class="mt-2 text-muted">Le tableau d’impact ne montre que les indicateurs validés puis publiés par l’équipe environnement, chacun avec sa période, sa méthodologie et ses justificatifs.</p>
        </div>
        <UiButton icon="chart-no-axes-combined" to="/impact">Ouvrir le tableau d’impact</UiButton>
      </div>
    </section>
  </div>
</template>
