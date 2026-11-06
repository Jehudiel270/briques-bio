<script setup lang="ts">
import { fdate, fdatetime } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Claim } from '#shared/types/domain'

usePageTitle('Réclamations')
const db = useDb()
const auth = useAuth()
const act = useAction()
const L = useLookups()
const KIND = { quality: 'Qualité', delivery: 'Livraison', billing: 'Facturation', collection: 'Collecte', payment: 'Paiement', other: 'Autre' } as const
const PRIORITY = { low: 'Basse', normal: 'Normale', high: 'Haute' } as const
const rows = computed(() => [...db.all('claims')].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const columns = [
  { key: 'ref', label: 'Réclamation', sortable: true },
  { key: 'subject', label: 'Objet' },
  { key: 'kind', label: 'Type', hide: 'md' as const, value: (c: Claim) => KIND[c.kind] },
  { key: 'author', label: 'Auteur', hide: 'lg' as const, value: (c: Claim) => (c.companyId ? L.companyName(c.companyId) : L.userName(c.userId)) },
  { key: 'priority', label: 'Priorité', hide: 'sm' as const, value: (c: Claim) => PRIORITY[c.priority] },
  { key: 'updatedAt', label: 'Mise à jour', hide: 'md' as const, sortable: true, value: (c: Claim) => fdate(c.updatedAt), sortValue: (c: Claim) => c.updatedAt },
  { key: 'status', label: 'Statut', value: (c: Claim) => STATUS.claim[c.status].label },
]
const filters = [
  { key: 'status', label: 'Statut', options: Object.entries(STATUS.claim).map(([value, m]) => ({ value, label: m.label })), accessor: (c: Claim) => c.status },
  { key: 'kind', label: 'Type', options: Object.entries(KIND).map(([value, label]) => ({ value, label })), accessor: (c: Claim) => c.kind },
  { key: 'priority', label: 'Priorité', options: Object.entries(PRIORITY).map(([value, label]) => ({ value, label })), accessor: (c: Claim) => c.priority },
]
const staff = computed(() => db.all('users').filter((u) => u.active && ['sales', 'procurement', 'logistics', 'quality', 'admin'].includes(u.role)).map((u) => ({ value: u.id, label: u.name })))

const selectedId = ref<string | null>(null)
const c = computed(() => (selectedId.value ? db.peek('claims', selectedId.value) : undefined))
const open = computed({ get: () => !!c.value, set: (v) => { if (!v) selectedId.value = null } })
const reply = ref('')
const patch = (data: Partial<Claim>, summary: string, ok: string) => act(() => db.update('claims', selectedId.value!, { ...data, updatedAt: db.now() } as any, { summary: `${c.value?.ref} · ${summary}` }), ok)
async function send() {
  const body = reply.value.trim()
  if (!body || !c.value) return
  const msg = { id: `msg_${Date.now().toString(36)}`, userId: auth.user.value?.id, userName: auth.user.value?.name ?? 'Équipe EcoBloc', at: db.now(), body }
  const ok = await patch({ thread: [...c.value.thread, msg], status: c.value.status === 'open' ? 'in_review' : c.value.status }, 'réponse envoyée', 'Réponse envoyée.')
  if (ok) reply.value = ''
}
</script>

<template>
  <div>
    <UiPageHeader title="Réclamations" description="Demandes de support des clients et collecteurs : suivi, affectation et réponses." icon="life-buoy" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" dense export-name="reclamations" :initial-sort="{ key: 'updatedAt', dir: 'desc' }" @row-click="(r: Claim) => (selectedId = r.id)">
      <template #cell-status="{ row }"><UiStatusBadge kind="claim" :value="row.status" size="sm" /></template>
      <template #cell-priority="{ row }"><UiBadge :tone="row.priority === 'high' ? 'danger' : row.priority === 'low' ? 'neutral' : 'info'" size="sm" dot>{{ PRIORITY[row.priority as 'low'] }}</UiBadge></template>
      <template #empty><UiEmpty icon="life-buoy" title="Aucune réclamation" hint="Les demandes de support apparaissent ici." /></template>
    </UiDataTable>

    <UiSheet v-model:open="open" :title="c ? `${c.ref} · ${c.subject}` : 'Réclamation'" side="right" width="34rem">
      <template v-if="c">
        <div class="flex flex-wrap items-center gap-2"><UiStatusBadge kind="claim" :value="c.status" /><UiBadge size="sm">{{ KIND[c.kind] }}</UiBadge><UiDemoBadge v-if="c.demo" /></div>
        <p class="mt-2 text-[13px] text-muted">Par {{ c.companyId ? L.companyName(c.companyId) : L.userName(c.userId) }} · ouverte le {{ fdate(c.createdAt) }}{{ c.orderId ? ` · commande ${L.orderRef(c.orderId)}` : '' }}</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <UiField label="Statut" #default="{ id }"><UiSelect :id="id" :model-value="c.status" :options="Object.entries(STATUS.claim).map(([value, m]) => ({ value, label: m.label }))" @update:model-value="(v: any) => patch({ status: v }, `statut → ${v}`, 'Statut mis à jour.')" /></UiField>
          <UiField label="Priorité" #default="{ id }"><UiSelect :id="id" :model-value="c.priority" :options="Object.entries(PRIORITY).map(([value, label]) => ({ value, label }))" @update:model-value="(v: any) => patch({ priority: v }, `priorité → ${v}`, 'Priorité mise à jour.')" /></UiField>
          <UiField label="Responsable" #default="{ id }"><UiSelect :id="id" :model-value="c.assignedTo ?? ''" :options="[{ value: '', label: 'Non affecté' }, ...staff]" @update:model-value="(v: any) => patch({ assignedTo: v || undefined }, 'affectation', 'Affectation mise à jour.')" /></UiField>
        </div>
        <h3 class="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">Échanges</h3>
        <ul class="flex flex-col gap-3">
          <li v-for="m in c.thread" :key="m.id" class="rounded-lg border border-line p-3 text-sm" :class="m.userId === c.userId ? 'bg-surface' : 'bg-surface-2'"><p class="mb-1 flex items-baseline justify-between gap-2 text-[13px]"><strong>{{ m.userName }}</strong><span class="text-muted">{{ fdatetime(m.at) }}</span></p><p class="whitespace-pre-line">{{ m.body }}</p></li>
        </ul>
        <form class="mt-4 flex flex-col gap-2" @submit.prevent="send">
          <UiTextarea v-model="reply" :rows="3" placeholder="Votre réponse…" aria-label="Votre réponse" />
          <div class="flex justify-end"><UiButton type="submit" icon="send" :disabled="!reply.trim()">Envoyer la réponse</UiButton></div>
        </form>
      </template>
    </UiSheet>
  </div>
</template>
