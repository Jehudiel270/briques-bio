<script setup lang="ts">
import { daysUntil, fdate } from '#shared/utils/format'
import type { Interaction } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Relances')
const db = useDb()
const auth = useAuth()
const act = useAction()
const L = useLookups()

const tab = ref('todo')
const all = computed(() => db.all('interactions').filter((i) => i.kind === 'reminder' || i.dueAt))
const todo = computed(() => all.value.filter((i) => !i.done).sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')))
const done = computed(() => all.value.filter((i) => i.done).sort((a, b) => b.at.localeCompare(a.at)))
const shown = computed(() => (tab.value === 'todo' ? todo.value : done.value))
const tabs = computed(() => [{ value: 'todo', label: 'À faire', count: todo.value.length }, { value: 'done', label: 'Faites', count: done.value.length }])
const late = (i: Interaction) => !i.done && i.dueAt != null && (daysUntil(i.dueAt) ?? 0) < 0

const subjectLabel = (i: Interaction) => {
  if (i.subjectType === 'company') return L.companyName(i.subjectId)
  if (i.subjectType === 'quote') return L.quoteRef(i.subjectId)
  if (i.subjectType === 'prospect') return db.peek('prospects', i.subjectId)?.name ?? '—'
  return L.userName(i.subjectId)
}
const subjectLink = (i: Interaction) => ({ company: `/ops/commercial/clients/${i.subjectId}`, quote: `/ops/commercial/devis/${i.subjectId}`, prospect: '/ops/commercial/prospects', user: '' } as Record<string, string>)[i.subjectType]

const toggle = (i: Interaction) => act(() => db.update('interactions', i.id, { done: !i.done } as any, { summary: i.done ? 'Relance rouverte' : 'Relance faite' }), i.done ? 'Relance rouverte.' : 'Relance marquée comme faite.')

const open = ref(false)
const companies = computed(() => db.all('companies').map((c) => ({ value: c.id, label: c.name })))
const fields = computed<FieldDef[]>(() => [
  { key: 'subjectId', label: 'Entreprise concernée', type: 'select', required: true, options: companies.value },
  { key: 'summary', label: 'À faire', type: 'textarea', required: true, span: 2, rows: 3 },
  { key: 'dueAt', label: 'Échéance', type: 'date', required: true },
])
const create = (v: Record<string, any>) => db.create('interactions', { kind: 'reminder', subjectType: 'company', subjectId: v.subjectId, userId: auth.user.value?.id, at: db.now(), summary: v.summary, dueAt: new Date(`${v.dueAt}T09:00:00`).toISOString(), done: false } as any, { summary: 'Relance créée' })
</script>

<template>
  <div>
    <UiPageHeader title="Relances" description="Rappels de suivi des clients, prospects et devis en attente de réponse." icon="bell-ring">
      <template #actions><UiButton icon="plus" @click="open = true">Nouvelle relance</UiButton></template>
    </UiPageHeader>
    <UiTabs v-model="tab" :items="tabs" aria-label="Filtrer les relances" class="mb-4" />
    <UiEmpty v-if="!shown.length" icon="bell-off" :title="tab === 'todo' ? 'Aucune relance à faire' : 'Aucune relance traitée'" />
    <ul v-else class="card divide-y divide-line">
      <li v-for="i in shown" :key="i.id" class="flex items-start gap-3 p-4">
        <UiCheckbox :model-value="!!i.done" :aria-label="`Marquer comme ${i.done ? 'à faire' : 'faite'} : ${i.summary}`" @update:model-value="toggle(i)" />
        <div class="min-w-0 flex-1 text-sm">
          <p :class="i.done && 'text-muted line-through'">{{ i.summary }}</p>
          <p class="mt-0.5 text-[13px] text-muted"><NuxtLink v-if="subjectLink(i)" :to="subjectLink(i)" class="hover:underline">{{ subjectLabel(i) }}</NuxtLink><template v-else>{{ subjectLabel(i) }}</template><template v-if="i.dueAt"> · échéance {{ fdate(i.dueAt) }}</template></p>
        </div>
        <UiBadge v-if="late(i)" tone="danger" size="sm" icon="alarm-clock">En retard</UiBadge>
      </li>
    </ul>
    <UiFormDialog v-model:open="open" title="Nouvelle relance" :fields="fields" submit-label="Créer la relance" @submit="create" />
  </div>
</template>
