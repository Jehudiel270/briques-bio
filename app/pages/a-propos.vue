<script setup lang="ts">
usePageTitle('À propos')
const db = useDb()
const settings = useSettings()
const root = ref<HTMLElement | null>(null)
useReveal(root)

const story = computed(() => db.all('contentBlocks').find((b) => b.key === 'about.story')?.body)

const values = [
  { icon: 'ruler', title: 'Précision', text: 'Nous disons ce qui est mesuré, ce qui est testé et ce qui ne l’est pas encore.' },
  { icon: 'route', title: 'Traçabilité', text: 'Chaque pièce vendue se rattache à un lot, une matière, un contrôle.' },
  { icon: 'handshake', title: 'Filière locale', text: 'Collecteurs, ateliers et distributeurs sont des partenaires visibles dans la plateforme.' },
  { icon: 'shield-check', title: 'Prudence', text: 'Pas d’usage structurel, pas de certification revendiquée, pas de promesse sans preuve.' },
]

const prototype = [
  { icon: 'check-circle-2', tone: 'text-success', title: 'Ce que le prototype fait', items: ['Parcours devis, commande, paiement simulé, livraison', 'Collecte, pesée, réception et lots de matière', 'Production, contrôle qualité et libération des lots', 'Rôles et permissions, journal d’audit'] },
  { icon: 'flask-conical', tone: 'text-warning', title: 'Ce qui est simulé', items: ['Paiements, remboursements et versements', 'Documents, factures et certificats de démonstration', 'Données, prix, clients, lots et indicateurs', 'Notifications SMS, WhatsApp ou e-mail'] },
]
const roadmap = [
  'Essais en laboratoire sur chaque produit et publication des résultats',
  'Cadre juridique et fiscal de l’entreprise, assurances, conformité réglementaire locale',
  'Agrégateur de paiement réel (mobile money, cartes) et facturation conforme',
  'Procédures d’exploitation écrites et formation des équipes',
]
</script>

<template>
  <div ref="root">
    <SitePageHero title="À propos" :intro="story ?? 'Un projet de valorisation de déchets plastiques en matériaux d’aménagement non structurels.'" crumb="À propos" />

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Nos principes" />
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
        <article v-for="v in values" :key="v.title" class="card p-5">
          <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${v.icon}`" class="size-5" aria-hidden="true" /></span>
          <h3 class="mt-4 font-display text-lg font-semibold">{{ v.title }}</h3>
          <p class="mt-1.5 text-[15px] leading-relaxed text-muted">{{ v.text }}</p>
        </article>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SiteSectionHead title="Un prototype, pas une entreprise en activité" intro="Cette plateforme montre comment l’activité pourrait être pilotée de bout en bout. Rien de ce que vous y voyez n’est réel." />
        <div class="mt-8 grid gap-5 md:grid-cols-2" data-reveal data-reveal-group>
          <article v-for="b in prototype" :key="b.title" class="card p-5">
            <h3 class="flex items-center gap-2 font-display text-lg font-semibold"><Icon :name="`lucide:${b.icon}`" class="size-5" :class="b.tone" aria-hidden="true" />{{ b.title }}</h3>
            <ul class="mt-3 space-y-2 text-[15px] text-muted"><li v-for="i in b.items" :key="i" class="flex gap-2"><Icon name="lucide:dot" class="mt-0.5 size-5 shrink-0" aria-hidden="true" /><span>{{ i }}</span></li></ul>
          </article>
        </div>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
      <div data-reveal>
        <SiteSectionHead title="Avant toute commercialisation" intro="Ce qu’il reste à établir pour passer d’une maquette à une activité réelle." />
        <ol class="mt-6 space-y-3">
          <li v-for="(r, i) in roadmap" :key="r" class="flex gap-3 text-[15px]"><span class="tnum grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{{ i + 1 }}</span><span>{{ r }}</span></li>
        </ol>
        <div class="mt-6"><SiteNotice kind="technical" /></div>
      </div>
      <div data-reveal>
        <h2 class="text-3xl font-semibold sm:text-4xl">Nous contacter</h2>
        <dl class="mt-5 space-y-3 text-[15px]">
          <div class="flex items-start gap-3"><Icon name="lucide:map-pin" class="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><dt class="sr-only">Adresse</dt><dd>{{ settings.company.address || 'Adresse à communiquer' }}<template v-if="settings.company.city">, {{ settings.company.city }}</template>, {{ settings.company.country }}</dd></div></div>
          <div v-if="settings.company.email" class="flex items-start gap-3"><Icon name="lucide:mail" class="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><dt class="sr-only">E-mail</dt><dd>{{ settings.company.email }}</dd></div></div>
          <div v-if="settings.company.phone" class="flex items-start gap-3"><Icon name="lucide:phone" class="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><dt class="sr-only">Téléphone</dt><dd>{{ settings.company.phone }}</dd></div></div>
        </dl>
        <div class="mt-6 flex flex-wrap gap-2"><UiButton icon="mail" to="/contact">Écrire à l’équipe</UiButton><UiButton variant="outline" icon="help-circle" to="/faq">FAQ</UiButton></div>
      </div>
    </section>
  </div>
</template>
