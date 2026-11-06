<script setup lang="ts">
import { fcfa, fdate, fdatetime, fmtAddress } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

/** Fiche entreprise : conditions commerciales, contacts, devis, commandes, interactions. */
const props = defineProps<{ id: string; back: string }>()
const db = useDb()
const auth = useAuth()
const L = useLookups()

const c = computed(() => db.get('companies', props.id))
usePageTitle(c.value ? c.value.name : 'Entreprise')
const orders = computed(() => db.all('orders').filter((o) => o.companyId === props.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const quotes = computed(() => db.all('quotes').filter((q) => q.companyId === props.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const interactions = computed(() => db.all('interactions').filter((i) => i.subjectType === 'company' && i.subjectId === props.id).sort((a, b) => b.at.localeCompare(a.at)))
const grid = computed(() => db.all('priceGrids').find((g) => g.id === c.value?.priceGridId))
const revenue = computed(() => orders.value.filter((o) => !['cancelled'].includes(o.status)).reduce((a, o) => a + o.amountPaid, 0))
const canEdit = computed(() => auth.can('crm.manage'))

const termsOpen = ref(false)
const noteOpen = ref(false)
const grids = computed(() => db.all('priceGrids').map((g) => ({ value: g.id, label: g.name })))
const termsFields = computed<FieldDef[]>(() => [
  { key: 'status', label: 'Statut du compte', type: 'select', required: true, options: Object.entries(STATUS.company).map(([value, m]) => ({ value, label: m.label })) },
  { key: 'priceGridId', label: 'Grille tarifaire', type: 'select', options: [{ value: '', label: 'Tarif public' }, ...grids.value] },
  { key: 'paymentTermsDays', label: 'Délai de paiement (jours)', type: 'number', min: 0, max: 120 },
  { key: 'creditLimit', label: 'Plafond de crédit (FCFA)', type: 'currency', min: 0 },
])
const noteFields: FieldDef[] = [
  { key: 'kind', label: 'Type', type: 'select', required: true, options: [{ value: 'call', label: 'Appel' }, { value: 'email', label: 'E-mail' }, { value: 'meeting', label: 'Rendez-vous' }, { value: 'note', label: 'Note' }, { value: 'reminder', label: 'Relance à faire' }] },
  { key: 'summary', label: 'Résumé', type: 'textarea', required: true, span: 2, rows: 3 },
  { key: 'dueAt', label: 'Échéance (relance)', type: 'date' },
]
const saveTerms = (v: Record<string, any>) => db.update('companies', props.id, { status: v.status, priceGridId: v.priceGridId || undefined, paymentTermsDays: Number(v.paymentTermsDays) || 0, creditLimit: v.creditLimit } as any, { summary: `Conditions commerciales · ${c.value?.name}` })
const addNote = (v: Record<string, any>) => db.create('interactions', { kind: v.kind, subjectType: 'company', subjectId: props.id, userId: auth.user.value?.id, at: db.now(), summary: v.summary, dueAt: v.dueAt ? new Date(`${v.dueAt}T09:00:00`).toISOString() : undefined, done: false } as any, { summary: `Interaction · ${c.value?.name}` })
const ICON: Record<string, string> = { call: 'phone', email: 'mail', meeting: 'users', note: 'sticky-note', reminder: 'bell-ring' }
</script>

<template>
  <div>
    <UiEmpty v-if="!c" icon="building-2" title="Entreprise introuvable"><UiButton icon="arrow-left" :to="back">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="c.name" :back="back" icon="building-2" :description="`${c.kind === 'distributor' ? 'Distributeur' : 'Client professionnel'} · ${fmtAddress(c.address)}`">
        <template #meta><UiStatusBadge kind="company" :value="c.status" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton variant="outline" icon="message-square-plus" @click="noteOpen = true">Ajouter une interaction</UiButton>
          <UiButton v-if="canEdit" icon="sliders-horizontal" @click="termsOpen = true">Conditions</UiButton>
        </template>
      </UiPageHeader>

      <div class="mb-5 grid gap-4 sm:grid-cols-3">
        <UiStat label="Commandes" :value="orders.length" icon="package" tone="info" />
        <UiStat label="Encaissé (simulé)" :value="fcfa(revenue)" icon="wallet" tone="success" demo />
        <UiStat label="Devis" :value="quotes.length" icon="file-text" tone="accent" />
      </div>

      <div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Commandes" icon="package" padding="none">
            <UiEmpty v-if="!orders.length" compact icon="package-open" title="Aucune commande" />
            <ul v-else class="divide-y divide-line"><li v-for="o in orders" :key="o.id"><NuxtLink :to="`/ops/commercial/commandes/${o.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 sm:px-5"><div class="min-w-0 flex-1"><p class="font-medium">{{ o.ref }}</p><p class="text-[13px] text-muted">{{ fdate(o.createdAt) }}</p></div><span class="tnum font-medium">{{ fcfa(o.total) }}</span><UiStatusBadge kind="order" :value="o.status" size="sm" /></NuxtLink></li></ul>
          </UiCard>
          <UiCard title="Devis" icon="file-text" padding="none">
            <UiEmpty v-if="!quotes.length" compact icon="file-text" title="Aucun devis" />
            <ul v-else class="divide-y divide-line"><li v-for="q in quotes" :key="q.id"><NuxtLink :to="`/ops/commercial/devis/${q.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 sm:px-5"><div class="min-w-0 flex-1"><p class="font-medium">{{ q.ref }}</p><p class="truncate text-[13px] text-muted">{{ q.lines.map((l) => l.label).join(', ') }}</p></div><UiStatusBadge kind="quote" :value="q.status" size="sm" /></NuxtLink></li></ul>
          </UiCard>
          <UiCard title="Interactions" icon="messages-square">
            <UiEmpty v-if="!interactions.length" compact icon="message-square" title="Aucune interaction enregistrée" />
            <ul v-else class="space-y-3"><li v-for="i in interactions" :key="i.id" class="flex gap-3"><span class="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted"><Icon :name="`lucide:${ICON[i.kind]}`" class="size-4" aria-hidden="true" /></span><div class="text-sm"><p>{{ i.summary }}</p><p class="text-[12px] text-muted">{{ L.userName(i.userId) }} · {{ fdatetime(i.at) }}<template v-if="i.dueAt"> · échéance {{ fdate(i.dueAt) }}</template></p></div></li></ul>
          </UiCard>
        </div>
        <aside class="flex flex-col gap-5">
          <UiCard title="Conditions commerciales" icon="handshake">
            <UiKeyValue :items="[{ label: 'Délai de paiement', value: `${c.paymentTermsDays} jours` }, { label: 'Plafond de crédit', value: c.creditLimit != null ? fcfa(c.creditLimit) : '—' }, { label: 'Grille tarifaire', value: grid?.name ?? 'Tarif public' }, { label: 'E-mail facturation', value: c.billingEmail }, { label: 'Identifiant fiscal', value: c.taxId }]" />
          </UiCard>
          <UiCard title="Contacts" icon="contact" padding="none">
            <ul class="divide-y divide-line"><li v-for="ct in c.contacts" :key="ct.id" class="px-4 py-3 text-sm sm:px-5"><p class="font-medium">{{ ct.name }}<span v-if="ct.function" class="font-normal text-muted"> · {{ ct.function }}</span></p><p class="text-[13px] text-muted">{{ ct.email }} · {{ ct.phone }}</p><UiBadge class="mt-1" :tone="ct.authorized ? 'success' : 'neutral'" size="sm">{{ ct.authorized ? 'Autorisé à commander' : 'Lecture seule' }}</UiBadge></li></ul>
            <UiEmpty v-if="!c.contacts.length" compact icon="contact" title="Aucun contact" />
          </UiCard>
        </aside>
      </div>

      <UiFormDialog v-model:open="termsOpen" title="Conditions commerciales" :fields="termsFields" :initial="{ status: c.status, priceGridId: c.priceGridId ?? '', paymentTermsDays: c.paymentTermsDays, creditLimit: c.creditLimit }" @submit="saveTerms" />
      <UiFormDialog v-model:open="noteOpen" title="Nouvelle interaction" :fields="noteFields" :initial="{ kind: 'note' }" @submit="addNote" />
    </template>
  </div>
</template>
