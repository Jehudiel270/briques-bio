<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'

usePageTitle('Contact')
const settings = useSettings()

const fields: FieldDef[] = [
  { key: 'subject', label: 'Sujet', type: 'select', required: true, span: 2, options: [
    { value: 'Information produit', label: 'Information produit' },
    { value: 'Suivi de devis ou de commande', label: 'Suivi de devis ou de commande' },
    { value: 'Collecte de plastiques', label: 'Collecte de plastiques' },
    { value: 'Partenariat', label: 'Partenariat' },
    { value: 'Autre', label: 'Autre' },
  ] },
  { key: 'message', label: 'Votre message', type: 'textarea', required: true, span: 2, rows: 5, min: 10 },
]

const channels = computed(() => [
  { icon: 'mail', label: 'E-mail', value: settings.value.company.email },
  { icon: 'phone', label: 'Téléphone', value: settings.value.company.phone },
  { icon: 'map-pin', label: 'Adresse', value: [settings.value.company.address, settings.value.company.city, settings.value.company.country].filter(Boolean).join(', ') },
].filter((c) => c.value))
</script>

<template>
  <div>
    <SitePageHero title="Contact" intro="Une question sur un produit, un devis ou la collecte ? Écrivez-nous, nous répondons par e-mail ou par téléphone." crumb="Contact" />

    <section class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
      <div class="card p-5 sm:p-6">
        <h2 class="mb-4 text-xl font-semibold">Envoyer un message</h2>
        <SiteLeadForm interest="contact" :fields="fields" submit-label="Envoyer le message" />
      </div>
      <aside class="space-y-4">
        <div class="card p-5">
          <h2 class="font-display text-lg font-semibold">Coordonnées</h2>
          <ul class="mt-4 space-y-4">
            <li v-for="c in channels" :key="c.label" class="flex gap-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon :name="`lucide:${c.icon}`" class="size-4" aria-hidden="true" /></span>
              <div class="min-w-0"><p class="text-[13px] text-muted">{{ c.label }}</p><p class="break-words font-medium">{{ c.value }}</p></div>
            </li>
          </ul>
          <div class="mt-4"><UiDemoBadge label="Coordonnées fictives" /></div>
        </div>
        <div class="card p-5">
          <h2 class="font-display text-lg font-semibold">Vous êtes déjà client ?</h2>
          <p class="mt-1.5 text-[15px] text-muted">Pour une commande, un devis ou une livraison, la messagerie de votre espace conserve l’historique de l’échange.</p>
          <UiButton class="mt-4" variant="outline" icon="log-in" to="/connexion">Ouvrir mon espace</UiButton>
        </div>
        <SiteNotice kind="leadTime" />
      </aside>
    </section>
  </div>
</template>
