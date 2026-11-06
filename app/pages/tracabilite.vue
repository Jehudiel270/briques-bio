<script setup lang="ts">
usePageTitle('Traçabilité et qualité')
const db = useDb()
const intro = computed(() => db.all('contentBlocks').find((b) => b.key === 'traceability.intro')?.body)

const chain = [
  { icon: 'truck', title: 'Collecte', records: 'Demande, tournée, chauffeur, preuve d’enlèvement' },
  { icon: 'scale', title: 'Réception', records: 'Pesée, contamination, décision par polymère' },
  { icon: 'package', title: 'Lot de matière', records: 'Kg disponibles, réservés, consommés, emplacement' },
  { icon: 'factory', title: 'Ordre de fabrication', records: 'Matières réservées, opérateurs, événements, rebuts' },
  { icon: 'boxes', title: 'Lot de produits finis', records: 'Quantités produites, rebuts, matières d’origine' },
  { icon: 'microscope', title: 'Contrôle qualité', records: 'Mesures, décision, motif, technicien' },
  { icon: 'package-check', title: 'Libération', records: 'Seuls les lots libérés peuvent être réservés' },
  { icon: 'truck', title: 'Livraison', records: 'Expédition, preuve de réception, incidents' },
]

const rules = [
  { icon: 'shield-check', title: 'Pas de vente sans libération', text: 'Une commande ne réserve que des lots libérés par la qualité. Un lot en attente, rejeté ou en quarantaine reste invisible pour la vente.' },
  { icon: 'split', title: 'Rejeter, c’est tracé', text: 'Une matière rejetée ou un lot mis en quarantaine garde son motif, son auteur et sa date. Rien n’est effacé.' },
  { icon: 'file-check-2', title: 'Preuve de livraison obligatoire', text: 'Une livraison n’est clôturée qu’avec le nom de la personne qui réceptionne ; une photo peut s’y ajouter.' },
  { icon: 'scroll-text', title: 'Journal d’audit', text: 'Chaque création, modification ou changement de statut est journalisé avec son auteur.' },
]

const example = [
  { label: 'Lot de produits finis', value: 'LOT-2026-0000 (exemple)', mono: true },
  { label: 'Produit', value: 'Pavé Hexa 20 (exemple)' },
  { label: 'Ordre de fabrication', value: 'OF-2026-0000', mono: true },
  { label: 'Matières d’origine', value: 'MP-2026-0000 · PEHD · 320 kg', mono: true },
  { label: 'Contrôle', value: 'QC-2026-0000 · mesures dimensionnelles et d’aspect', mono: true },
  { label: 'Décision', value: 'Libéré par le technicien qualité' },
  { label: 'Livraison', value: 'LIV-2026-0000 · preuve de réception signée', mono: true },
]
</script>

<template>
  <div>
    <SitePageHero title="Traçabilité et qualité" :intro="intro ?? 'Du lot de matière au lot de produits livrés : chaque maillon est consultable.'" crumb="Traçabilité">
      <template #actions>
        <UiButton icon="layout-grid" to="/catalogue">Voir les produits</UiButton>
        <UiButton variant="outline" icon="circle-help" to="/faq">Questions fréquentes</UiButton>
      </template>
    </SitePageHero>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Une chaîne, huit maillons" intro="Chaque lot porte une référence qui renvoie à son amont (d’où vient la matière) et à son aval (qui l’a reçu)." />
      <ol class="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(c, i) in chain" :key="c.title" class="card relative flex flex-col gap-3 p-4">
          <div class="flex items-center justify-between">
            <span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon :name="`lucide:${c.icon}`" class="size-5" aria-hidden="true" /></span>
            <span class="tnum font-display text-2xl font-semibold text-line">{{ String(i + 1).padStart(2, '0') }}</span>
          </div>
          <h3 class="font-display text-[17px] font-semibold">{{ c.title }}</h3>
          <p class="text-sm leading-relaxed text-muted">{{ c.records }}</p>
        </li>
      </ol>
    </section>

    <section class="border-t border-line bg-surface-2/40">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SiteSectionHead title="Quatre règles qui ne se contournent pas" />
          <ul class="mt-8 flex flex-col gap-5">
            <li v-for="r in rules" :key="r.title" class="flex gap-4">
              <span class="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-primary"><Icon :name="`lucide:${r.icon}`" class="size-5" aria-hidden="true" /></span>
              <div><h3 class="font-display text-[17px] font-semibold">{{ r.title }}</h3><p class="mt-1 leading-relaxed text-muted">{{ r.text }}</p></div>
            </li>
          </ul>
          <div class="mt-8 flex flex-wrap items-center gap-2" aria-label="Statuts d’un lot de produits finis">
            <UiStatusBadge v-for="s in (['pending_qc', 'in_qc', 'released', 'quarantine', 'rejected'] as const)" :key="s" kind="lotQc" :value="s" size="sm" />
          </div>
        </div>
        <div>
          <UiCard title="Exemple de fiche de traçabilité" icon="qr-code" description="Exemple fictif : les références sont à zéro.">
            <template #actions><UiDemoBadge /></template>
            <UiKeyValue :items="example" />
            <div class="mt-4"><SiteNotice kind="document" dense /></div>
          </UiCard>
          <p class="mt-4 text-sm text-muted">Les clients professionnels retrouvent les vraies fiches des lots qui leur sont livrés dans leur espace, rubrique « Suivi des lots ».</p>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SiteSectionHead title="Ce que le contrôle qualité vérifie" intro="Les critères sont définis par produit et saisis par le technicien qualité. Dans ce prototype, les seuils sont des valeurs de démonstration, pas des exigences normatives." />
      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <UiCard title="Aspect et dimensions" icon="ruler"><p class="text-sm leading-relaxed text-muted">Mesure des dimensions nominales, planéité, défauts visibles, uniformité de couleur sur un échantillon du lot.</p></UiCard>
        <UiCard title="Masse et densité" icon="weight"><p class="text-sm leading-relaxed text-muted">Pesée d’un échantillon et comparaison à la masse unitaire attendue ; un écart déclenche une décision motivée.</p></UiCard>
        <UiCard title="Essais complémentaires" icon="flask-conical"><p class="text-sm leading-relaxed text-muted">Essais de résistance, d’absorption ou de glissance : réalisés lorsqu’ils sont requis, avec rapport rattaché au lot.</p></UiCard>
      </div>
      <div class="mt-6"><SiteNotice kind="technical" /></div>
    </section>
  </div>
</template>
