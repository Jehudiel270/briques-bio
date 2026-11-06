<script setup lang="ts">
import { POLYMER_LABEL } from '#shared/utils/labels'

usePageTitle('Nos matériaux')
const db = useDb()
const settings = useSettings()
const intro = computed(() => db.all('contentBlocks').find((b) => b.key === 'materials.intro')?.body)

const levels = [
  { icon: 'recycle', tone: 'bg-primary/10 text-primary', title: 'Recyclé', text: 'La matière provient de déchets plastiques collectés, triés et contrôlés à la réception. Cela décrit l’origine, pas la performance.' },
  { icon: 'microscope', tone: 'bg-accent/25 text-ink', title: 'Testé', text: 'Des essais ont été réalisés sur ce produit et leurs résultats sont consultables. Les valeurs de ce prototype sont des valeurs de démonstration.' },
  { icon: 'badge-check', tone: 'bg-success/12 text-success', title: 'Certifié ou autorisé', text: 'Le produit a franchi le processus de validation défini avant commercialisation. Aucun produit du prototype n’est certifié par un organisme.' },
]

const steps = [
  { icon: 'truck', title: 'Collecte', text: 'Enlèvement chez les collecteurs partenaires ou dépôt à l’atelier, sur demande planifiée.' },
  { icon: 'scale', title: 'Pesée et réception', text: 'Chaque arrivage est pesé et rattaché à son fournisseur : c’est le point de départ de la traçabilité.' },
  { icon: 'list-filter', title: 'Tri et contrôle', text: 'Polymères identifiés, contamination mesurée. Ce qui ne convient pas est rejeté ou mis en quarantaine.' },
  { icon: 'droplets', title: 'Broyage et lavage', text: 'La matière acceptée est réduite en paillettes, lavée puis séchée avant stockage en lot de matière.' },
  { icon: 'flame', title: 'Transformation et moulage', text: 'Les paramètres de fabrication sont internes : ils ne sont pas publiés et ne constituent pas une instruction certifiée.' },
  { icon: 'snowflake', title: 'Refroidissement et finition', text: 'Démoulage, ébavurage, finition de surface et comptage des pièces et des rebuts du lot.' },
  { icon: 'clipboard-check', title: 'Contrôle qualité et libération', text: 'Le lot n’est vendable qu’après décision du technicien qualité : libéré, rejeté ou mis en quarantaine.' },
]

const polymers = computed(() => settings.value.polymers.map((p) => ({ ...p, label: POLYMER_LABEL[p.code] ?? p.code })))
</script>

<template>
  <div>
    <SitePageHero title="Nos matériaux" :intro="intro ?? 'Les plastiques collectés sont triés, contrôlés, broyés puis transformés. Chaque étape est documentée.'" crumb="Matériaux">
      <template #actions>
        <UiButton icon="layout-grid" to="/catalogue">Voir les produits</UiButton>
        <UiButton variant="outline" icon="qr-code" to="/tracabilite">Comprendre la traçabilité</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Recyclé, testé, certifié : trois choses différentes" intro="Nous ne confondons pas l’origine d’un matériau avec ses performances. Chaque fiche produit affiche son niveau réel." />
      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article v-for="l in levels" :key="l.title" class="card p-5">
          <span class="grid size-11 place-items-center rounded-lg" :class="l.tone"><Icon :name="`lucide:${l.icon}`" class="size-5" aria-hidden="true" /></span>
          <h3 class="mt-4 text-xl font-semibold">{{ l.title }}</h3>
          <p class="mt-2 leading-relaxed text-muted">{{ l.text }}</p>
        </article>
      </div>
      <div class="mt-6 flex flex-wrap gap-2" aria-label="Statuts de validation des produits">
        <UiStatusBadge v-for="v in (['development', 'testing', 'results', 'authorized'] as const)" :key="v" kind="validation" :value="v" />
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SiteSectionHead title="De la collecte au produit fini" intro="Sept étapes, chacune enregistrée dans l’outil : quantités, opérateurs, décisions." />
        <ol class="mt-10 grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
          <li v-for="(s, i) in steps" :key="s.title" class="flex gap-4">
            <span class="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary"><Icon :name="`lucide:${s.icon}`" class="size-5" aria-hidden="true" /></span>
            <div>
              <h3 class="font-display text-lg font-semibold"><span class="tnum mr-1.5 text-muted">{{ i + 1 }}.</span>{{ s.title }}</h3>
              <p class="mt-1 text-[15px] leading-relaxed text-muted">{{ s.text }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Plastiques acceptés à la réception" intro="La liste est configurable par l’équipe approvisionnement. Un arrivage hors critères est rejeté ou mis en quarantaine, jamais mélangé au stock." />
      <div class="scroll-x card mt-8">
        <table class="w-full min-w-[34rem] text-left text-sm">
          <caption class="sr-only">Polymères acceptés ou refusés</caption>
          <thead><tr class="border-b border-line text-[13px] text-muted"><th scope="col" class="p-3 font-medium">Polymère</th><th scope="col" class="p-3 font-medium">Statut</th><th scope="col" class="p-3 font-medium">Critères</th><th scope="col" class="p-3 text-right font-medium">Contamination max.</th></tr></thead>
          <tbody>
            <tr v-for="p in polymers" :key="p.code" class="border-b border-line/70 last:border-0">
              <th scope="row" class="p-3 font-medium">{{ p.label }}</th>
              <td class="p-3"><UiBadge :tone="p.accepted ? 'success' : 'danger'" :icon="p.accepted ? 'check' : 'x'" size="sm">{{ p.accepted ? 'Accepté' : 'Refusé' }}</UiBadge></td>
              <td class="p-3 text-muted">{{ p.criteria }}</td>
              <td class="tnum p-3 text-right">{{ p.accepted ? `${p.maxContaminationPct} %` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-6 grid gap-4 md:grid-cols-2"><SiteNotice kind="technical" /><SiteNotice kind="structural" /></div>
    </section>
  </div>
</template>
