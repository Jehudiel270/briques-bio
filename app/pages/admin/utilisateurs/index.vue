<script setup lang="ts">
import { fdate } from '#shared/utils/format'
import { ROLE_KEYS, ROLES, roleLabel } from '#shared/utils/roles'
import type { User } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Utilisateurs et rôles')
const db = useDb()
const act = useAction()
const L = useLookups()
const roleOptions = ROLE_KEYS.filter((r) => r !== 'visitor').map((value) => ({ value, label: `${ROLES[value].letter} · ${ROLES[value].label}` }))
const rows = computed(() => [...db.all('users')].sort((a, b) => Number(!!b.pendingApproval) - Number(!!a.pendingApproval) || a.name.localeCompare(b.name)))
const pending = computed(() => rows.value.filter((u) => u.pendingApproval))
const state = (u: User) => (u.pendingApproval ? 'À valider' : u.active ? 'Actif' : 'Désactivé')

const fields: FieldDef[] = [
  { key: 'name', label: 'Nom complet', type: 'text', required: true, span: 2 },
  { key: 'email', label: 'E-mail', type: 'email', required: true },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'role', label: 'Rôle', type: 'select', required: true, options: roleOptions, span: 2 },
  { key: 'active', label: 'Compte actif', type: 'switch', span: 2 },
]
const columns = [
  { key: 'name', label: 'Utilisateur', sortable: true },
  { key: 'role', label: 'Rôle', sortable: true, value: (u: User) => roleLabel(u.role) },
  { key: 'org', label: 'Organisation', hide: 'md' as const, value: (u: User) => (u.companyId ? L.companyName(u.companyId) : u.supplierId ? L.supplierName(u.supplierId) : '—') },
  { key: 'lastLoginAt', label: 'Dernière connexion', hide: 'lg' as const, sortable: true, value: (u: User) => (u.lastLoginAt ? fdate(u.lastLoginAt) : '—'), sortValue: (u: User) => u.lastLoginAt ?? '' },
  { key: 'state', label: 'État', value: state },
]
const filters = [
  { key: 'role', label: 'Rôle', options: roleOptions, accessor: (u: User) => u.role },
  { key: 'state', label: 'État', options: ['À valider', 'Actif', 'Désactivé'].map((value) => ({ value, label: value })), accessor: state },
]
const open = ref(false)
const create = (v: Record<string, any>) => db.create('users', { name: v.name, email: String(v.email).toLowerCase(), phone: v.phone || undefined, role: v.role, active: !!v.active, createdAt: db.now(), demo: true } as any, { summary: `Utilisateur invité · ${v.email}` })
const approve = (u: User) => act(() => db.update('users', u.id, { pendingApproval: false, active: true } as any, { summary: `Compte validé · ${u.email}` }), `Compte de ${u.name} validé.`)
const toggle = (u: User) => act(() => db.update('users', u.id, { active: !u.active } as any, { summary: `${u.active ? 'Désactivation' : 'Réactivation'} · ${u.email}` }), u.active ? 'Compte désactivé.' : 'Compte réactivé.')
</script>

<template>
  <div>
    <UiPageHeader title="Utilisateurs et rôles" description="Comptes, rôles, validation des inscriptions et activation." icon="users">
      <template #actions><UiButton icon="user-plus" @click="open = true">Inviter un utilisateur</UiButton></template>
    </UiPageHeader>
    <UiAlert v-if="pending.length" tone="warning" icon="user-check" :title="`${pending.length} compte(s) en attente de validation`" class="mb-4">
      <ul class="mt-1 flex flex-col gap-2"><li v-for="u in pending" :key="u.id" class="flex flex-wrap items-center gap-2"><span class="font-medium">{{ u.name }}</span><span class="text-muted">· {{ roleLabel(u.role) }} · {{ u.email }}</span><UiButton size="sm" icon="check" @click="approve(u)">Valider</UiButton></li></ul>
    </UiAlert>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" export-name="utilisateurs" dense @row-click="(u: User) => navigateTo(`/admin/utilisateurs/${u.id}`)">
      <template #cell-name="{ row }"><div class="min-w-0"><p class="font-medium">{{ row.name }}</p><p class="truncate text-[13px] text-muted">{{ row.email }}</p></div></template>
      <template #cell-state="{ row }"><UiBadge :tone="row.pendingApproval ? 'warning' : row.active ? 'success' : 'neutral'" size="sm" dot>{{ state(row) }}</UiBadge></template>
      <template #actions="{ row }"><UiButton size="sm" variant="ghost" :icon="row.active ? 'user-x' : 'user-check'" @click.stop="toggle(row)">{{ row.active ? 'Désactiver' : 'Réactiver' }}</UiButton></template>
      <template #empty><UiEmpty icon="users" title="Aucun utilisateur" /></template>
    </UiDataTable>
    <UiFormDialog v-model:open="open" title="Inviter un utilisateur" description="Crée la fiche utilisateur. La connexion se fait ensuite via l’authentification Neon (ou le compte de démonstration)." :fields="fields" :initial="{ role: 'client', active: true }" submit-label="Créer le compte" @submit="create" />
  </div>
</template>
