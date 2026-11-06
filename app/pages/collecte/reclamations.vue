<script setup lang="ts">
import { fdate, fdatetime } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Réclamations')
const db = useDb()
const auth = useAuth()
const act = useAction()

const rows = computed(() => [...db.all('claims')].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const collections = computed(() => db.all('collections'))
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('claims', openId.value))
const reply = ref('')
const newOpen = ref(false)
const fields = computed<FieldDef[]>(() => [
  { key: 'collectionId', label: 'Collecte concernée', type: 'select', options: [{ value: '', label: 'Aucune en particulier' }, ...collections.value.map((c) => ({ value: c.id, label: c.ref }))] },
  { key: 'subject', label: 'Objet', type: 'text', required: true, placeholder: 'Ex. écart entre le poids relevé et le poids accepté', span: 2 },
  { key: 'body', label: 'Description', type: 'textarea', required: true, rows: 4, span: 2 },
])
function create(v: Record<string, any>) {
  const u = auth.user.value!
  const now = db.now()
  db.create('claims', {
    ref: db.nextRef('claims', 'SUP'), userId: u.id, collectionId: v.collectionId || undefined, kind: 'collection', subject: v.subject, priority: 'normal', status: 'open',
    thread: [{ id: `msg_${Date.now()}`, userId: u.id, userName: u.name, at: now, body: v.body }], createdAt: now, updatedAt: now, demo: true,
  } as any, { summary: `Réclamation collecteur · ${v.subject}` })
  db.notify({ roles: ['procurement'], title: 'Réclamation d’un collecteur', body: String(v.subject), level: 'warning', href: '/ops/appro/fournisseurs' })
}
async function send() {
  const c = sel.value
  const u = auth.user.value
  if (!c || !u || !reply.value.trim()) return
  const body = reply.value.trim()
  const ok = await act(() => db.update('claims', c.id, { thread: [...c.thread, { id: `msg_${Date.now()}`, userId: u.id, userName: u.name, at: db.now(), body }], updatedAt: db.now() } as any, { summary: `Réponse sur ${c.ref}` }), 'Message envoyé.')
  if (ok) reply.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Réclamations" description="Un désaccord sur une pesée, un refus ou un retard ?" icon="message-circle-warning">
      <template #actions><UiButton icon="plus" @click="newOpen = true">Nouvelle</UiButton></template>
    </UiPageHeader>
    <UiEmpty v-if="!rows.length" icon="message-circle-warning" title="Aucune réclamation" hint="Tout est en ordre. Signalez un problème si besoin."><UiButton icon="plus" @click="newOpen = true">Nouvelle réclamation</UiButton></UiEmpty>
    <ul v-else class="flex flex-col gap-3">
      <li v-for="c in rows" :key="c.id">
        <button type="button" class="card block min-h-16 w-full p-4 text-left transition-colors hover:border-primary/50" @click="openId = c.id; reply = ''">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-display font-semibold">{{ c.ref }}</p><p class="truncate text-sm">{{ c.subject }}</p></div><UiStatusBadge kind="claim" :value="c.status" size="sm" /></div>
          <p class="mt-1 text-[13px] text-muted">Mise à jour le {{ fdate(c.updatedAt) }} · {{ c.thread.length }} message(s)</p>
        </button>
      </li>
    </ul>

    <UiSheet v-model:open="open" :title="sel?.ref ?? 'Réclamation'" side="bottom">
      <div v-if="sel" class="flex flex-col gap-4">
        <div><h3 class="font-display text-lg font-semibold">{{ sel.subject }}</h3><div class="mt-2"><UiStatusBadge kind="claim" :value="sel.status" /></div></div>
        <ul class="space-y-3"><li v-for="m in sel.thread" :key="m.id" class="rounded-lg p-3" :class="m.userId === auth.user.value?.id ? 'bg-primary/8' : 'bg-surface-2'"><p class="text-[13px] text-muted"><span class="font-medium text-ink">{{ m.userName }}</span> · {{ fdatetime(m.at) }}</p><p class="mt-1 whitespace-pre-line text-sm">{{ m.body }}</p></li></ul>
        <form v-if="['open', 'in_review'].includes(sel.status)" class="flex flex-col gap-2" @submit.prevent="send"><UiTextarea v-model="reply" :rows="3" placeholder="Votre message…" aria-label="Votre message" touch /><UiButton type="submit" icon="send" block :disabled="!reply.trim()">Envoyer</UiButton></form>
        <p class="text-[12px] text-muted">Statut : {{ STATUS.claim[sel.status].label }}</p>
      </div>
    </UiSheet>
    <UiFormDialog v-model:open="newOpen" title="Nouvelle réclamation" :fields="fields" submit-label="Envoyer la réclamation" @submit="create" />
  </div>
</template>
