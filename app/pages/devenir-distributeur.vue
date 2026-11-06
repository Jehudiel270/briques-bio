<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'

usePageTitle('Devenir distributeur')
const settings = useSettings()
const root = ref<HTMLElement | null>(null)
useReveal(root)

const zones = computed(() => settings.value.zones.filter((z) => z.active).map((z) => ({ value: z.name, label: z.name })))
const fields = computed<FieldDef[]>(() => [
  { key: 'company', label: 'Entreprise', type: 'text', required: true, span: 2 },
  { key: 'activity', label: 'Activité actuelle', type: 'select', required: true, options: [
    { value: 'Quincaillerie ou négoce de matériaux', label: 'Quincaillerie ou négoce de matériaux' },
    { value: 'Entreprise de travaux ou paysagiste', label: 'Entreprise de travaux ou paysagiste' },
    { value: 'Promoteur ou lotisseur', label: 'Promoteur ou lotisseur' },
    { value: 'Autre', label: 'Autre' },
  ] },
  { key: 'zone', label: 'Zone couverte', type: 'select', options: zones.value.length ? zones.value : [{ value: 'Autre', label: 'Autre' }] },
  { key: 'volume', label: 'Volume visé par trimestre (pièces)', type: 'number', min: 0 },
  { key: 'storage', label: 'Capacité de stockage', type: 'select', options: [{ value: 'Aucune', label: 'Aucune' }, { value: 'Moins de 20 m²', label: 'Moins de 20 m²' }, { value: 'Plus de 20 m²', label: 'Plus de 20 m²' }] },
  { key: 'message', label: 'Message', type: 'textarea', span: 2, rows: 3 },
])

const benefits = [
  { icon: 'receipt', title: 'Tarifs distributeur', text: 'Grille de prix dédiée, définie avec l’équipe commerciale selon vos volumes.' },
  { icon: 'package-search', title: 'Lots documentés', text: 'Chaque livraison est liée à un lot libéré par le contrôle qualité.' },
  { icon: 'wallet-cards', title: 'Portefeuille client', text: 'Suivez vos clients, commandes et livraisons depuis votre espace.' },
  { icon: 'file-stack', title: 'Documents produit', text: 'Fiches produit et statut de validation à jour, à transmettre à vos clients.' },
]
const rules = [
  'Respecter les usages non structurels indiqués sur chaque fiche produit.',
  'Ne revendiquer ni certification ni performance que la fiche produit ne mentionne pas.',
  'Conserver les références de lot en cas de réclamation.',
]
</script>

<template>
  <div ref="root">
    <SitePageHero title="Devenir distributeur" intro="Revendez les produits dans votre zone avec des lots documentés, des tarifs dédiés et un portefeuille client en ligne." crumb="Distributeur">
      <template #actions>
        <UiButton icon="handshake" to="#demande">Envoyer une demande</UiButton>
        <UiButton variant="outline" icon="layout-grid" to="/catalogue">Voir le catalogue</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Ce que vous trouvez dans l’espace distributeur" />
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
        <article v-for="b in benefits" :key="b.title" class="card p-5">
          <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${b.icon}`" class="size-5" aria-hidden="true" /></span>
          <h3 class="mt-4 font-display text-lg font-semibold">{{ b.title }}</h3>
          <p class="mt-1.5 text-[15px] leading-relaxed text-muted">{{ b.text }}</p>
        </article>
      </div>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div id="demande">
          <SiteSectionHead title="Engagements attendus" intro="Pour protéger les utilisateurs finaux, les mêmes règles de prudence s’appliquent à tout le réseau." />
          <ul class="mt-6 space-y-3">
            <li v-for="r in rules" :key="r" class="flex gap-3 text-[15px]"><Icon name="lucide:circle-check" class="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /><span>{{ r }}</span></li>
          </ul>
          <div class="mt-6"><SiteNotice kind="structural" /></div>
        </div>
        <div class="card p-5 sm:p-6">
          <h2 class="mb-4 text-xl font-semibold">Demande de partenariat</h2>
          <SiteLeadForm interest="distributor" source="distributor_request" company-key="company" :fields="fields" submit-label="Envoyer ma demande" success-title="Demande reçue" success-text="Merci. L’équipe commerciale vous contacte pour définir les conditions (tarifs, volumes, zones)." />
        </div>
      </div>
    </section>
  </div>
</template>
