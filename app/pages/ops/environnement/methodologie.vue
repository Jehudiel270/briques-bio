<script setup lang="ts">
import type { EnvIndicator } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Méthodologie')
const db = useDb()
const auth = useAuth()
const indicators = computed(() => db.all('envIndicators'))
const may = computed(() => auth.can('env.manage'))
const editing = ref<EnvIndicator | null>(null)
const open = ref(false)
const fields: FieldDef[] = [{ key: 'methodology', label: 'Méthodologie de calcul', type: 'textarea', required: true, rows: 7, span: 2, hint: 'Décrivez la source des données, la formule, la période et les limites.' }]
const edit = (i: EnvIndicator) => { editing.value = i; open.value = true }
const save = (v: Record<string, any>) => db.update('envIndicators', editing.value!.id, { methodology: String(v.methodology) } as any, { summary: `Méthodologie · ${editing.value!.label}` })
const principles = [
  { icon: 'ruler', title: 'On publie ce qu’on mesure', text: 'Kilos pesés à la réception, pièces produites, pertes enregistrées. Aucune valeur déduite sans méthode.' },
  { icon: 'ban', title: 'Pas de CO₂ automatique', text: 'Aucune économie de carbone n’est calculée ni affichée sans protocole validé et preuves à l’appui.' },
  { icon: 'shield-check', title: 'Validation avant publication', text: 'Chaque indicateur passe de brouillon à validé puis publié, avec méthodologie et documents de preuve.' },
  { icon: 'files', title: 'Preuves traçables', text: 'Les pesées, lots et rapports sont rattachés aux indicateurs pour pouvoir être audités.' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Méthodologie" description="Principes de mesure et méthode de chaque indicateur. Une méthodologie est obligatoire pour publier." icon="book-text" />
    <div class="grid gap-4 sm:grid-cols-2">
      <UiCard v-for="p in principles" :key="p.title" :title="p.title" :icon="p.icon"><p class="text-sm text-muted">{{ p.text }}</p></UiCard>
    </div>
    <h2 class="mb-3 mt-8 font-display text-lg font-semibold">Méthode par indicateur</h2>
    <UiEmpty v-if="!indicators.length" icon="book-text" title="Aucun indicateur défini" hint="Créez un indicateur dans « Validation & publication »." />
    <div v-else class="flex flex-col gap-4">
      <UiCard v-for="i in indicators" :key="i.id" :title="i.label" icon="calculator" :description="`${i.periodFrom} → ${i.periodTo} · clé ${i.key}`">
        <template #actions><UiStatusBadge kind="indicator" :value="i.status" size="sm" /></template>
        <p class="whitespace-pre-line text-sm" :class="!i.methodology && 'text-danger'">{{ i.methodology || 'Aucune méthodologie : l’indicateur ne peut pas être publié.' }}</p>
        <UiButton v-if="may && i.status !== 'published'" class="mt-3" size="sm" variant="outline" icon="pencil" @click="edit(i)">Modifier la méthode</UiButton>
        <p v-else-if="i.status === 'published'" class="mt-3 text-[13px] text-muted">Indicateur publié : dépubliez-le avant de modifier sa méthode.</p>
      </UiCard>
    </div>
    <UiFormDialog v-model:open="open" :title="`Méthode · ${editing?.label ?? ''}`" :fields="fields" :initial="{ methodology: editing?.methodology ?? '' }" size="lg" submit-label="Enregistrer" @submit="save" />
  </div>
</template>
