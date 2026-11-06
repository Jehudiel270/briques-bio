<script setup lang="ts">
usePageTitle('Pavés, dalles et bordures en plastique valorisé')
const db = useDb()
const cart = useCart()
const root = ref<HTMLElement>()
useReveal(root)

const products = computed(() => db.all('products').filter((p) => p.published))
const featured = computed(() => {
  const f = products.value.filter((p) => p.featured)
  return (f.length ? f : products.value.filter((p) => p.validation === 'authorized')).slice(0, 4)
})
const indicators = computed(() => db.all('envIndicators').filter((i) => i.status === 'published').slice(0, 4))
const authorizedCount = computed(() => products.value.filter((p) => p.validation === 'authorized').length)

const steps = [
  { icon: 'truck', title: 'Collecte', text: 'Des collecteurs partenaires apportent des plastiques triés, avec un justificatif par collecte.' },
  { icon: 'scale', title: 'Réception et pesée', text: 'Chaque apport est pesé, contrôlé, puis accepté, refusé ou mis en quarantaine.' },
  { icon: 'factory', title: 'Transformation', text: 'Les lots de matière sont affectés à un ordre de fabrication, avec traçabilité de ce qui a été utilisé.' },
  { icon: 'microscope', title: 'Contrôle qualité', text: 'Un lot fini n’est vendable qu’après contrôle et décision documentée de l’équipe qualité.' },
  { icon: 'package-check', title: 'Livraison', text: 'Livraison avec preuve de réception, rattachée au lot expédié.' },
]
const levels = [
  { kind: 'development', text: 'Idée ou prototype : aucun prix ferme, aucun engagement.' },
  { kind: 'testing', text: 'Essais en cours : devis possible sous réserve, rien n’est garanti.' },
  { kind: 'results', text: 'Résultats d’essais disponibles : à lire avec leur méthode et leurs limites.' },
  { kind: 'authorized', text: 'Autorisé à la vente selon notre processus interne de validation.' },
] as const
const audiences = [
  { icon: 'hard-hat', title: 'Professionnels du bâtiment', text: 'Devis, tarifs par palier, suivi des lots et factures.', to: '/services-pro', cta: 'Services pour pros' },
  { icon: 'recycle', title: 'Collecteurs', text: 'Déclarez vos apports, suivez les pesées et vos rémunérations simulées.', to: '/devenir-collecteur', cta: 'Devenir collecteur' },
  { icon: 'store', title: 'Distributeurs', text: 'Conditions revendeur, portefeuille clients et commandes groupées.', to: '/devenir-distributeur', cta: 'Devenir distributeur' },
  { icon: 'house', title: 'Particuliers', text: 'Allée, terrasse, bordure de jardin : commandez en petites quantités.', to: '/catalogue', cta: 'Voir le catalogue' },
]

function addToList(p: { id: string; name: string }) {
  cart.add(p.id, 1)
  useToast().success(`« ${p.name} » ajouté à votre liste.`)
}
</script>

<template>
  <div ref="root">
    <!-- Hero -->
    <section class="relative isolate overflow-hidden border-b border-line">
      <SitePaverScene class="!opacity-100" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" aria-hidden="true" />
      <div class="relative mx-auto flex min-h-[min(86dvh,46rem)] max-w-7xl flex-col justify-center gap-7 px-4 py-20 sm:px-6">
        <div class="max-w-2xl">
          <p class="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[13px] text-muted backdrop-blur">
            <Icon name="lucide:map-pin" class="size-3.5 text-primary" aria-hidden="true" /> Cotonou, Bénin · maquette de démonstration
          </p>
          <h1 class="font-display-wide text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[1.02]">Du plastique collecté, posé en pavés.</h1>
          <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            EcoBloc collecte, trie et transforme des déchets plastiques en pavés, dalles et bordures non structurels, avec un suivi lot par lot, de la pesée à la livraison.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UiButton variant="primary" size="lg" icon="layout-grid" to="/catalogue">Voir le catalogue</UiButton>
            <UiButton variant="outline" size="lg" icon="file-text" to="/devis">Demander un devis</UiButton>
          </div>
        </div>
        <SiteNotice kind="structural" class="max-w-xl bg-surface/85 backdrop-blur" dense />
      </div>
    </section>

    <!-- Chiffres -->
    <section class="border-b border-line bg-surface">
      <div class="mx-auto grid max-w-7xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
        <div v-for="i in indicators" :key="i.id" class="bg-surface p-6">
          <p class="flex items-center gap-2 text-sm text-muted">{{ i.label }} <UiDemoBadge /></p>
          <p class="mt-2 font-display text-4xl font-semibold tnum">{{ num(i.value) }} <span class="text-lg font-normal text-muted">{{ i.unit }}</span></p>
        </div>
        <div v-if="!indicators.length" class="bg-surface p-6 sm:col-span-2 lg:col-span-4">
          <p class="text-sm text-muted">Les indicateurs d’impact sont publiés après validation, avec leur méthodologie. <NuxtLink class="text-primary underline underline-offset-4" to="/impact">Voir la page impact</NuxtLink></p>
        </div>
      </div>
    </section>

    <!-- Chaîne -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SiteSectionHead title="De la collecte au lot contrôlé" intro="Chaque étape laisse une trace : qui a apporté quoi, combien, dans quel état, et ce que le contrôle a décidé.">
        <UiButton variant="ghost" icon-right="arrow-right" to="/tracabilite">Traçabilité et qualité</UiButton>
      </SiteSectionHead>
      <ol class="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5" data-reveal data-reveal-group>
        <li v-for="(s, i) in steps" :key="s.title" class="relative bg-surface p-5">
          <span class="font-display text-sm text-muted tnum">0{{ i + 1 }}</span>
          <span class="mt-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon :name="`lucide:${s.icon}`" class="size-5" aria-hidden="true" /></span>
          <h3 class="mt-4 text-lg font-semibold">{{ s.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <!-- Produits -->
    <section class="border-y border-line bg-surface-2/40">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SiteSectionHead title="Quelques produits du catalogue" :intro="`${authorizedCount} produit${authorizedCount > 1 ? 's' : ''} autorisé${authorizedCount > 1 ? 's' : ''} à la vente sur ${products.length}. Les autres affichent leur statut réel.`">
          <UiButton variant="outline" icon-right="arrow-right" to="/catalogue">Tout le catalogue</UiButton>
        </SiteSectionHead>
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
          <ProductCard v-for="p in featured" :key="p.id" :product="p" show-actions :in-list="cart.has(p.id)" @add="addToList(p)" />
        </div>
      </div>
    </section>

    <!-- Statuts -->
    <section class="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div data-reveal>
        <h2 class="text-3xl font-semibold sm:text-4xl">Ce que nous affirmons, et ce que nous ne prétendons pas</h2>
        <p class="mt-4 text-[17px] leading-relaxed text-muted">
          Un matériau recyclé n’est ni testé ni certifié par défaut. Chaque produit porte un statut de validation visible, et les documents techniques de cette maquette sont tous fictifs.
        </p>
        <SiteNotice kind="technical" class="mt-6" />
      </div>
      <ul class="space-y-3" data-reveal data-reveal-group>
        <li v-for="l in levels" :key="l.kind" class="flex items-start gap-4 rounded-lg border border-line bg-surface p-4">
          <UiStatusBadge kind="validation" :value="l.kind" class="mt-0.5 shrink-0" />
          <p class="text-sm leading-relaxed text-muted">{{ l.text }}</p>
        </li>
      </ul>
    </section>

    <!-- Publics -->
    <section class="border-t border-line bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SiteSectionHead title="Un espace pour chaque métier" />
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
          <NuxtLink v-for="a in audiences" :key="a.title" :to="a.to" class="group flex flex-col rounded-xl border border-line bg-bg p-5 transition-colors hover:border-primary/50">
            <Icon :name="`lucide:${a.icon}`" class="size-7 text-primary" aria-hidden="true" />
            <h3 class="mt-5 text-lg font-semibold">{{ a.title }}</h3>
            <p class="mt-2 flex-1 text-sm leading-relaxed text-muted">{{ a.text }}</p>
            <span class="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">{{ a.cta }} <Icon name="lucide:arrow-right" class="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Appel -->
    <section class="relative overflow-hidden bg-primary text-primary-ink">
      <div class="paver-bg absolute inset-0 opacity-[0.08]" aria-hidden="true" />
      <div class="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-16 sm:px-6">
        <div class="max-w-xl">
          <h2 class="text-3xl font-semibold sm:text-4xl">Un projet d’aménagement ?</h2>
          <p class="mt-3 text-primary-ink/80">Décrivez vos besoins : l’équipe commerciale répond avec un chiffrage et un délai à confirmer.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <UiButton variant="accent" size="lg" icon="file-text" to="/devis">Demander un devis</UiButton>
          <UiButton variant="outline" size="lg" class="!border-primary-ink/40 !text-primary-ink hover:!bg-primary-ink/10" icon="mail" to="/contact">Nous écrire</UiButton>
        </div>
      </div>
    </section>
  </div>
</template>
