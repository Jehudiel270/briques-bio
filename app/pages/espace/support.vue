<script setup lang="ts">
import { fdate, fdatetime } from '#shared/utils/format'
import { CLAIM_KIND_LABEL, STATUS } from '#shared/utils/labels'
import type { Claim } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Support et réclamations')
const db = useDb()
const auth = useAuth()
const act = useAction()
const L = useLookups()

const rows = computed(() => [...db.all('claims')].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('claims', openId.value))
const reply = ref('')

const newOpen = ref(false)
const orders = computed(() => db.all('orders'))
const fields = computed<FieldDef[]>(() => [
  { key: 'kind', label: 'Nature', type: 'select', required: true, options: Object.entries(CLAIM_KIND_LABEL).filter(([k]) => k !== 'collection').map(([value, label]) => ({ value, label })) },
  { key: 'orderId', label: 'Commande concernée', type: 'select', options: [{ value: '', label: 'Aucune' }, ...orders.value.map((o) => ({ value: o.id, label: o.ref }))] },
  { key: 'subject', label: 'Objet', type: 'text', required: true, span: 2 },
  { key: 'body', label: 'Description', type: 'textarea', required: true, span: 2, rows: 4 },
])
function create(v: Record<string, any>) {
  const u = auth.user.value!
  const now = db.now()
  db.create('claims', {
    ref: db.nextRef('claims', 'SUP'), userId: u.id, companyId: u.companyId, orderId: v.orderId || undefined, kind: v.kind, subject: v.subject,
    priority: 'normal', status: 'open', thread: [{ id: `msg_${Date.now()}`, userId: u.id, userName: u.name, at: now, body: v.body }], createdAt: now, updatedAt: now, demo: true,
  } as any, { summary: `Réclamation créée · ${v.subject}` })
  db.notify({ roles: ['sales'], title: 'Nouvelle réclamation', body: String(v.subject), level: 'warning', href: '/ops/commercial/commandes' })
}
async function send() {
  const c = sel.value
  const u = auth.user.value
  if (!c || !u || !reply.value.trim()) return
  const body = reply.value.trim()
  const ok = await act(() => db.update('claims', c.id, { thread: [...c.thread, { id: `msg_${Date.now()}`, userId: u.id, userName: u.name, at: db.now(), body }], updatedAt: db.now() } as any, { summary: `Réponse sur ${c.ref}` }), 'Message envoyé.')
  if (ok) reply.value = ''
}
const columns = [
  { key: 'ref', label: 'Référence', sortable: true },
  { key: 'subject', label: 'Objet' },
  { key: 'kind', label: 'Nature', hide: 'md' as const, value: (c: Claim) => CLAIM_KIND_LABEL[c.kind] },
  { key: 'updatedAt', label: 'Mise à jour', sortable: true, hide: 'sm' as const, value: (c: Claim) => fdate(c.updatedAt), sortValue: (c: Claim) => c.updatedAt },
  { key: 'status', label: 'Statut', value: (c: Claim) => STATUS.claim[c.status].label },
]
</script>

<template>
  <div>
    <UiPageHeader title="Support et réclamations" description="Un problème de qualité, de livraison ou de facturation ? Suivez ici chaque échange." icon="life-buoy">
      <template #actions><UiButton v-if="auth.can('claims.create')" icon="plus" @click="newOpen = true">Nouvelle réclamation</UiButton></template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" @row-click="(c: Claim) => { openId = c.id; reply = '' }">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="claim" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="life-buoy" title="Aucune réclamation" hint="Tout est en ordre. Signalez un problème si besoin."><UiButton icon="plus" @click="newOpen = true">Nouvelle réclamation</UiButton></UiEmpty></template>
    </UiDataTable>

    <UiSheet v-model:open="open" :title="sel?.ref ?? 'Réclamation'" side="right" width="30rem">
      <div v-if="sel" class="flex flex-col gap-5">
        <div><h3 class="font-display text-lg font-semibold">{{ sel.subject }}</h3><div class="mt-2 flex flex-wrap items-center gap-2"><UiStatusBadge kind="claim" :value="sel.status" /><UiBadge tone="neutral">{{ CLAIM_KIND_LABEL[sel.kind] }}</UiBadge><UiBadge v-if="sel.orderId" tone="info" icon="package">{{ L.orderRef(sel.orderId) }}</UiBadge></div></div>
        <ul class="space-y-3">
          <li v-for="m in sel.thread" :key="m.id" class="rounded-lg p-3" :class="m.userId === auth.user.value?.id ? 'bg-primary/8' : 'bg-surface-2'">
            <p class="text-[13px] text-muted"><span class="font-medium text-ink">{{ m.userName }}</span> · {{ fdatetime(m.at) }}</p>
            <p class="mt-1 whitespace-pre-line text-sm">{{ m.body }}</p>
          </li>
        </ul>
        <form v-if="['open', 'in_review'].includes(sel.status)" class="flex flex-col gap-2" @submit.prevent="send">
          <UiTextarea v-model="reply" :rows="3" placeholder="Votre message…" aria-label="Votre message" />
          <div><UiButton type="submit" size="sm" icon="send" :disabled="!reply.trim()">Envoyer</UiButton></div>
        </form>
      </div>
    </UiSheet>
    <UiFormDialog v-model:open="newOpen" title="Nouvelle réclamation" :fields="fields" submit-label="Envoyer la réclamation" @submit="create" />
  </div>
</template>
