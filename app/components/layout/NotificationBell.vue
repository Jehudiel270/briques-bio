<script setup lang="ts">
import type { Notification } from '#shared/types/domain'
/** Cloche de notifications (tiroir). Les notifications visibles viennent de `db.all('notifications')` (filtrées par rôle/utilisateur). */
const db = useDb()
const auth = useAuth()
const router = useRouter()
const open = ref(false)

const mine = computed(() => {
  const uid = auth.user.value?.id
  const role = auth.role.value
  return db
    .all('notifications')
    .filter((n) => (n.userId ? n.userId === uid : n.roles?.length ? n.roles.includes(role) : true))
    .sort((a, b) => b.at.localeCompare(a.at))
})
const unread = computed(() => mine.value.filter((n) => !n.read).length)
const tone = { info: 'text-info bg-info/10', success: 'text-success bg-success/10', warning: 'text-warning bg-warning/12', danger: 'text-danger bg-danger/10' } as const
const icon = { info: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'octagon-alert' } as const

function markRead(n: Notification) {
  if (!n.read) { try { db.update('notifications', n.id, { read: true }, { silent: true }) } catch { /* lecture seule : ignorer */ } }
}
function go(n: Notification) {
  markRead(n)
  if (n.href) { open.value = false; router.push(n.href) }
}
function markAll() { mine.value.forEach(markRead) }
</script>

<template>
  <div class="relative">
    <UiButton variant="ghost" icon-only icon="bell" :aria-label="unread ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'" @click="open = true" />
    <span v-if="unread" class="tnum pointer-events-none absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-ink">{{ unread > 9 ? '9+' : unread }}</span>
    <UiSheet v-model:open="open" title="Notifications" :description="unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'">
      <UiEmpty v-if="!mine.length" icon="bell-off" title="Aucune notification" hint="Les événements qui vous concernent apparaîtront ici." compact />
      <ul v-else class="-mx-2 flex flex-col">
        <li v-for="n in mine" :key="n.id">
          <button type="button" class="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-2/70" @click="go(n)">
            <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" :class="tone[n.level]"><Icon :name="`lucide:${icon[n.level]}`" class="size-4" aria-hidden="true" /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-start justify-between gap-2">
                <span class="text-sm" :class="n.read ? 'text-ink' : 'font-semibold text-ink'">{{ n.title }}</span>
                <span v-if="!n.read" class="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Non lue" />
              </span>
              <span v-if="n.body" class="mt-0.5 block text-[13px] text-muted">{{ n.body }}</span>
              <span class="mt-1 block text-xs text-muted">{{ relTime(n.at) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <template v-if="unread" #footer><UiButton variant="outline" icon="check-check" block @click="markAll">Tout marquer comme lu</UiButton></template>
    </UiSheet>
  </div>
</template>
