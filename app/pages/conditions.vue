<script setup lang="ts">
usePageTitle('Conditions générales')
const db = useDb()
const settings = useSettings()
const body = computed(() => db.all('contentBlocks').find((b) => b.key === 'legal.terms')?.body)

const articles = [
  { title: 'Objet', text: 'Ces conditions encadrent l’usage du prototype de démonstration. Elles ne constituent pas des conditions de vente réelles.' },
  { title: 'Prix', text: 'Les prix affichés sont indicatifs, exprimés en francs CFA (FCFA), et peuvent être modifiés sans préavis. Seul un devis envoyé par l’équipe commerciale décrit une offre, pour la durée de validité qu’il indique.' },
  { title: 'Commandes et paiements', text: 'Aucune vente réelle ne peut être conclue via ce prototype. Les paiements, acomptes, remboursements et factures sont simulés : aucune transaction n’est effectuée.' },
  { title: 'Livraison', text: 'Les délais sont indicatifs et à confirmer. La livraison est associée à un lot de produits libéré par le contrôle qualité ; une preuve de livraison peut être demandée.' },
  { title: 'Usage des produits', text: 'Les produits présentés sont non structurels. Il est interdit de les utiliser pour des éléments porteurs ou de sécurité. Le statut de validation de chaque produit (développement, test, résultats disponibles, autorisé) doit être consulté avant tout usage.' },
  { title: 'Garanties et responsabilité', text: 'Les données techniques et certifications doivent être confirmées avant toute commercialisation. Aucune garantie de performance n’est donnée par ce prototype.' },
  { title: 'Réclamations', text: 'Une réclamation peut être déposée depuis l’espace client ou via la page Contact, avec la référence de commande ou de lot concernée.' },
  { title: 'Comptes et sécurité', text: 'Chaque utilisateur est responsable de la confidentialité de ses identifiants. Les accès sont limités selon le rôle ; les actions sont consignées dans un journal d’audit.' },
]
</script>

<template>
  <div>
    <SitePageHero title="Conditions générales" :intro="body ?? 'Conditions de démonstration. Aucune vente réelle ne peut être conclue via ce prototype.'" crumb="Conditions" />

    <section class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SiteNotice kind="demo" />
      <ol class="mt-8 space-y-6">
        <li v-for="(a, i) in articles" :key="a.title" class="flex gap-4">
          <span class="tnum grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{{ i + 1 }}</span>
          <div><h2 class="font-display text-lg font-semibold">{{ a.title }}</h2><p class="mt-1 leading-relaxed text-muted">{{ a.text }}</p></div>
        </li>
      </ol>
      <p class="mt-10 text-sm text-muted">Éditeur du prototype : {{ settings.company.legalName }} (fictif). Texte de démonstration, à remplacer par des conditions validées juridiquement.</p>
    </section>
  </div>
</template>
