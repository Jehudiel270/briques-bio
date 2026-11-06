<script setup lang="ts">
usePageTitle('Politique de confidentialité')
const db = useDb()
const body = computed(() => db.all('contentBlocks').find((b) => b.key === 'legal.privacy')?.body)
const settings = useSettings()

const sections = [
  { icon: 'database', title: 'Données enregistrées', text: 'Les informations saisies (nom, e-mail, téléphone, adresses de livraison, quantités, messages) servent à faire fonctionner les parcours de démonstration : devis, commandes, collectes, livraisons.' },
  { icon: 'hard-drive', title: 'Où elles sont conservées', text: 'Sans base connectée, les données restent dans le stockage local de votre navigateur et peuvent être réinitialisées à tout moment. Avec la base du prototype connectée, elles sont enregistrées dans cette base.' },
  { icon: 'shield-alert', title: 'Ce qu’il ne faut pas saisir', text: 'Ce prototype n’est pas prévu pour recevoir des données personnelles sensibles ni des moyens de paiement réels. Utilisez des informations fictives.' },
  { icon: 'user-round-check', title: 'Vos droits', text: 'Vous pouvez demander l’accès, la correction ou la suppression des données vous concernant en écrivant à l’adresse de contact. En mode démonstration, un administrateur peut aussi réinitialiser l’ensemble des données.' },
  { icon: 'cookie', title: 'Stockage dans le navigateur', text: 'Le site mémorise localement votre session de démonstration, votre thème, votre liste de devis et vos préférences d’affichage. Il n’utilise pas de traceur publicitaire.' },
  { icon: 'scroll-text', title: 'Journal d’audit', text: 'Les actions réalisées dans les espaces connectés sont consignées dans un journal d’audit (qui, quand, quoi) pour assurer la traçabilité.' },
]
</script>

<template>
  <div>
    <SitePageHero title="Politique de confidentialité" :intro="body ?? 'Ce prototype enregistre vos données de démonstration dans votre navigateur et, si la base est connectée, dans la base du prototype.'" crumb="Confidentialité" />

    <section class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SiteNotice kind="demo" />
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <article v-for="s in sections" :key="s.title" class="card flex gap-4 p-5">
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${s.icon}`" class="size-5" aria-hidden="true" /></span>
          <div><h2 class="font-display text-lg font-semibold">{{ s.title }}</h2><p class="mt-1.5 text-[15px] leading-relaxed text-muted">{{ s.text }}</p></div>
        </article>
      </div>
      <p class="mt-8 text-sm text-muted">Contact pour toute question : {{ settings.company.email || 'via la page Contact' }}. Texte de démonstration : une politique définitive devra être rédigée et validée juridiquement avant toute activité réelle.</p>
    </section>
  </div>
</template>
