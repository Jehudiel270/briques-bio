<script setup lang="ts">
import { POLYMER_LABEL } from '#shared/utils/labels'
import { fcfa } from '#shared/utils/format'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Devenir collecteur')
const settings = useSettings()
const root = ref<HTMLElement | null>(null)
useReveal(root)

const polymers = computed(() => settings.value.polymers.map((p) => ({ ...p, label: POLYMER_LABEL[p.code] ?? p.code })))
const payouts = computed(() => settings.value.features.collectorPayouts)
const zones = computed(() => settings.value.zones.filter((z) => z.active).map((z) => ({ value: z.name, label: z.name })))

const fields = computed<FieldDef[]>(() => [
  { key: 'structure', label: 'Structure (coopérative, association, ou indépendant)', type: 'text', span: 2 },
  { key: 'zone', label: 'Zone de collecte', type: 'select', options: zones.value.length ? zones.value : [{ value: 'Autre', label: 'Autre' }] },
  { key: 'volume', label: 'Volume estimé par mois (kg)', type: 'number', min: 0 },
  { key: 'polymers', label: 'Plastiques collectés', type: 'multiselect', span: 2, options: polymers.value.filter((p) => p.accepted).map((p) => ({ value: p.code, label: p.label })) },
  { key: 'vehicle', label: 'Moyen de transport', type: 'select', options: [{ value: 'Aucun (dépôt à l’atelier)', label: 'Aucun (dépôt à l’atelier)' }, { value: 'Tricycle ou vélo cargo', label: 'Tricycle ou vélo cargo' }, { value: 'Camionnette', label: 'Camionnette' }] },
  { key: 'message', label: 'Message', type: 'textarea', span: 2, rows: 3 },
])

const steps = [
  { icon: 'user-plus', title: 'Demande', text: 'Vous envoyez ce formulaire ou créez un compte collecteur.' },
  { icon: 'badge-check', title: 'Validation', text: 'L’équipe approvisionnement valide votre profil avant les premières collectes.' },
  { icon: 'calendar-plus', title: 'Demande d’enlèvement', text: 'Vous annoncez vos quantités, une date et un lieu depuis votre espace.' },
  { icon: 'scale', title: 'Pesée à la réception', text: 'La quantité acceptée est pesée et rattachée à votre compte.' },
  { icon: 'wallet', title: 'Paiement simulé', text: 'Dans le prototype, la rémunération est simulée ; aucun versement réel n’a lieu.' },
]
</script>

<template>
  <div ref="root">
    <SitePageHero title="Devenir collecteur" intro="Vous collectez ou triez des plastiques ? Rejoignez la filière : demandes d’enlèvement, pesée contrôlée et justificatifs consultables." crumb="Collecteur">
      <template #actions>
        <UiButton icon="user-plus" to="/inscription?role=collector">Créer un compte collecteur</UiButton>
        <UiButton variant="outline" icon="log-in" to="/connexion">Se connecter</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Votre parcours, de la demande à la pesée" />
      <ol class="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5" data-reveal data-reveal-group>
        <li v-for="(s, i) in steps" :key="s.title" class="bg-surface p-5">
          <div class="flex items-center justify-between"><span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${s.icon}`" class="size-5" aria-hidden="true" /></span><span class="tnum font-display text-sm text-muted">0{{ i + 1 }}</span></div>
          <h3 class="mt-4 font-display font-semibold">{{ s.title }}</h3>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SiteSectionHead title="Plastiques acceptés" intro="Les critères sont configurables par l’équipe approvisionnement. Un arrivage hors critères est rejeté ou mis en quarantaine à la réception." />
        <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal data-reveal-group>
          <article v-for="p in polymers" :key="p.code" class="card p-4" :class="!p.accepted && 'opacity-80'">
            <div class="flex items-center justify-between"><h3 class="font-display text-xl font-semibold">{{ p.label }}</h3><UiBadge :tone="p.accepted ? 'success' : 'danger'">{{ p.accepted ? 'Accepté' : 'Refusé' }}</UiBadge></div>
            <p class="mt-2 text-sm text-muted">{{ p.criteria }}</p>
            <p v-if="p.accepted" class="mt-3 text-sm">Contamination max. <strong class="tnum">{{ p.maxContaminationPct }} %</strong></p>
            <p v-if="p.accepted && payouts" class="mt-1 text-sm">Barème simulé <strong class="tnum">{{ fcfa(p.pricePerKg) }}</strong>/kg <UiDemoBadge label="Simulé" /></p>
          </article>
        </div>
        <div class="mt-6 max-w-3xl"><SiteNotice kind="simulated" /></div>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <SiteSectionHead title="Envoyer ma demande" intro="Nous vous recontactons pour valider votre profil et vos premiers volumes." />
        <ul class="mt-6 space-y-3 text-[15px]">
          <li class="flex gap-3"><Icon name="lucide:smartphone" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>Un espace pensé pour le téléphone : demandes, historique et justificatifs.</span></li>
          <li class="flex gap-3"><Icon name="lucide:file-check-2" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>Chaque pesée donne lieu à un justificatif consultable.</span></li>
          <li class="flex gap-3"><Icon name="lucide:message-circle-warning" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>En cas de désaccord sur une pesée, vous pouvez déposer une réclamation.</span></li>
        </ul>
      </div>
      <div class="card p-5 sm:p-6">
        <SiteLeadForm interest="collector" company-key="structure" :fields="fields" submit-label="Envoyer ma demande" success-title="Demande reçue" success-text="Merci. L’équipe approvisionnement étudie votre profil et vous contacte pour la suite." />
      </div>
    </section>
  </div>
</template>
