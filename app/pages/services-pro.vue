<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'

usePageTitle('Services pour professionnels')
const root = ref<HTMLElement | null>(null)
useReveal(root)

const services = [
  { icon: 'calendar-range', title: 'Livraison planifiée par tranches', text: 'Calendrier de livraison adapté à l’avancement du chantier, avec lot et justificatifs à chaque tranche.' },
  { icon: 'ruler', title: 'Aide au métré et au calepinage', text: 'Estimation des quantités et du calepinage (pavés, dalles, bordures) pour limiter les chutes. Estimation indicative, à valider sur plan.' },
  { icon: 'file-stack', title: 'Dossier documentaire du lot', text: 'Fiche produit, statut de validation et références de lot rassemblés pour votre dossier de chantier.' },
  { icon: 'recycle', title: 'Collecte chez les entreprises', text: 'Enlèvement de plastiques triés produits par votre activité, selon les critères d’acceptation.' },
  { icon: 'headset', title: 'Compte entreprise et équipe', text: 'Plusieurs utilisateurs (acheteur, comptable, lecteur) avec droits distincts et historique des commandes.' },
  { icon: 'clipboard-list', title: 'Suivi de commande dédié', text: 'Un interlocuteur commercial et un suivi du statut de la préparation à la livraison.' },
]
const limits = [
  'Aucun usage porteur ou de sécurité n’est proposé.',
  'Aucune prestation de pose n’est incluse dans ce prototype.',
  'Les délais et tarifs sont indicatifs et confirmés dans chaque devis.',
]
const fields: FieldDef[] = [
  { key: 'company', label: 'Entreprise ou organisme', type: 'text', required: true, span: 2 },
  { key: 'service', label: 'Service qui vous intéresse', type: 'select', required: true, options: services.map((s) => ({ value: s.title, label: s.title })) },
  { key: 'project', label: 'Type de projet', type: 'select', options: [{ value: 'Résidentiel', label: 'Résidentiel' }, { value: 'Aménagement public', label: 'Aménagement public' }, { value: 'Hôtellerie et tourisme', label: 'Hôtellerie et tourisme' }, { value: 'Autre', label: 'Autre' }] },
  { key: 'message', label: 'Votre besoin', type: 'textarea', span: 2, rows: 4 },
]
</script>

<template>
  <div ref="root">
    <SitePageHero title="Services pour professionnels" intro="Entreprises, promoteurs, collectivités : un accompagnement organisé autour de vos chantiers, du métré à la livraison documentée." crumb="Services pro">
      <template #actions>
        <UiButton icon="file-text" to="/devis">Demander un devis</UiButton>
        <UiButton variant="outline" icon="user-plus" to="/inscription?role=pro">Créer un compte pro</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-reveal data-reveal-group>
        <article v-for="s in services" :key="s.title" class="card p-5">
          <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${s.icon}`" class="size-5" aria-hidden="true" /></span>
          <h2 class="mt-4 font-display text-lg font-semibold">{{ s.title }}</h2>
          <p class="mt-1.5 text-[15px] leading-relaxed text-muted">{{ s.text }}</p>
        </article>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SiteSectionHead title="Limites à connaître" intro="Nous préférons annoncer ce qui n’est pas couvert plutôt que de le découvrir sur chantier." />
          <ul class="mt-6 space-y-3">
            <li v-for="l in limits" :key="l" class="flex gap-3 text-[15px]"><Icon name="lucide:info" class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" /><span>{{ l }}</span></li>
          </ul>
          <div class="mt-6"><SiteNotice kind="technical" /></div>
        </div>
        <div class="card p-5 sm:p-6">
          <h2 class="mb-4 text-xl font-semibold">Parlons de votre projet</h2>
          <SiteLeadForm interest="pro_services" company-key="company" :fields="fields" submit-label="Envoyer ma demande" success-title="Demande reçue" success-text="Merci. Un conseiller commercial vous recontacte pour cadrer votre projet." />
        </div>
      </div>
    </section>
  </div>
</template>
