<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import type { CaseStudy, ContentBlock, FaqItem } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Pages publiques et FAQ')
const db = useDb()
const tab = ref('faqs')
const tabs = computed(() => [{ value: 'faqs', label: 'FAQ', count: db.all('faqs').length }, { value: 'cases', label: 'Études de cas (fictives)', count: db.all('caseStudies').length }, { value: 'blocks', label: 'Textes des pages', count: db.all('contentBlocks').length }])
const pub = (v: boolean) => (v ? 'Publiée' : 'Brouillon')

const faqFields: FieldDef[] = [
  { key: 'category', label: 'Rubrique', type: 'text', required: true },
  { key: 'order', label: 'Ordre', type: 'number', required: true, min: 1 },
  { key: 'question', label: 'Question', type: 'text', required: true, span: 2 },
  { key: 'answer', label: 'Réponse', type: 'textarea', required: true, span: 2, rows: 5 },
  { key: 'published', label: 'Publiée', type: 'switch', span: 2 },
]
const faqCols = [{ key: 'order', label: '#', sortable: true, width: '3rem' }, { key: 'question', label: 'Question', sortable: true }, { key: 'category', label: 'Rubrique', hide: 'sm' as const }, { key: 'published', label: 'Statut', value: (f: FaqItem) => pub(f.published) }]

const caseFields: FieldDef[] = [
  { key: 'title', label: 'Titre', type: 'text', required: true, span: 2 },
  { key: 'sector', label: 'Secteur', type: 'text', required: true },
  { key: 'published', label: 'Publiée', type: 'switch' },
  { key: 'summary', label: 'Résumé', type: 'textarea', required: true, span: 2, rows: 2 },
  { key: 'challenge', label: 'Enjeu', type: 'textarea', required: true, span: 2, rows: 3 },
  { key: 'approach', label: 'Approche', type: 'textarea', required: true, span: 2, rows: 3 },
  { key: 'outcome', label: 'Résultat (qualitatif, sans chiffre non démontré)', type: 'textarea', required: true, span: 2, rows: 3 },
]
const caseCols = [{ key: 'title', label: 'Étude de cas', sortable: true }, { key: 'sector', label: 'Secteur', hide: 'sm' as const }, { key: 'published', label: 'Statut', value: (c: CaseStudy) => pub(c.published) }]

const blockFields: FieldDef[] = [
  { key: 'key', label: 'Clé (emplacement)', type: 'text', required: true, hint: 'Ex. home.hero, about.story, legal.terms' },
  { key: 'published', label: 'Publié', type: 'switch' },
  { key: 'title', label: 'Titre', type: 'text', required: true, span: 2 },
  { key: 'body', label: 'Texte', type: 'textarea', required: true, span: 2, rows: 8 },
]
const blockCols = [{ key: 'key', label: 'Emplacement', sortable: true }, { key: 'title', label: 'Titre' }, { key: 'updatedAt', label: 'Mis à jour', hide: 'md' as const, value: (b: ContentBlock) => fdate(b.updatedAt) }, { key: 'published', label: 'Statut', value: (b: ContentBlock) => pub(b.published) }]
const blockFrom = (v: Record<string, any>) => ({ key: v.key, title: v.title, body: v.body, published: !!v.published, updatedAt: new Date().toISOString() })
const caseFrom = (v: Record<string, any>) => ({ title: v.title, sector: v.sector, summary: v.summary, challenge: v.challenge, approach: v.approach, outcome: v.outcome, published: !!v.published, fictional: true as const })
</script>

<template>
  <div>
    <UiPageHeader title="Pages publiques et FAQ" description="Questions fréquentes, études de cas et textes éditoriaux affichés sur le site public." icon="newspaper" />
    <UiAlert tone="warning" icon="flask-conical" class="mb-4" dense>Les études de cas de cette maquette sont <strong>fictives</strong> : elles sont toujours signalées comme telles sur le site.</UiAlert>
    <UiTabs v-model="tab" :items="tabs" aria-label="Type de contenu" class="mb-4" />
    <WsCrud v-if="tab === 'faqs'" embedded collection="faqs" :columns="faqCols" :fields="faqFields" noun="question" create-label="Nouvelle question" :defaults="{ published: true, order: 10 }" export-name="faq" :initial-sort="{ key: 'order', dir: 'asc' }" dialog-size="lg" :label="(r: FaqItem) => r.question" />
    <WsCrud v-else-if="tab === 'cases'" embedded collection="caseStudies" :columns="caseCols" :fields="caseFields" noun="étude de cas" create-label="Nouvelle étude" :defaults="{ published: false }" :from-values="caseFrom" export-name="etudes-de-cas" dialog-size="lg" :label="(r: CaseStudy) => r.title" />
    <WsCrud v-else embedded collection="contentBlocks" :columns="blockCols" :fields="blockFields" noun="texte" create-label="Nouveau texte" :defaults="{ published: true }" :from-values="blockFrom" export-name="textes" dialog-size="lg" :label="(r: ContentBlock) => r.title" />
  </div>
</template>
