<script setup lang="ts">
import { fdate, fdatetime } from '#shared/utils/format'
import { PERMISSIONS } from '#shared/utils/permissions'
import { ROLE_KEYS, ROLES, roleLabel } from '#shared/utils/roles'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const act = useAction()
const L = useLookups()
const u = computed(() => db.get('users', id.value))
usePageTitle(u.value ? u.value.name : 'Utilisateur')

const allPerms = [...new Set(Object.values(PERMISSIONS).flat())].filter((p) => p !== '*').sort() as string[]
const base = computed(() => (u.value ? PERMISSIONS[u.value.role] : []))
const isAdmin = computed(() => base.value.includes('*'))
const audit = computed(() => db.all('auditLog').filter((e) => e.userId === id.value).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12))
const open = ref(false)
const fields = computed<FieldDef[]>(() => [
  { key: 'name', label: 'Nom complet', type: 'text', required: true, span: 2 },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'role', label: 'Rôle', type: 'select', required: true, options: ROLE_KEYS.filter((r) => r !== 'visitor').map((value) => ({ value, label: ROLES[value].label })) },
  { key: 'extraPermissions', label: 'Permissions supplémentaires', type: 'multiselect', options: allPerms.filter((p) => !base.value.includes(p as any)).map((value) => ({ value, label: value })), span: 2, hint: 'À accorder avec parcimonie : elles s’ajoutent à celles du rôle.' },
])
const save = (v: Record<string, any>) => db.update('users', id.value, { name: v.name, phone: v.phone || undefined, role: v.role, extraPermissions: v.extraPermissions ?? [] } as any, { summary: `Utilisateur modifié · ${u.value?.email}` })
const toggle = () => act(() => db.update('users', id.value, { active: !u.value!.active } as any, { summary: `${u.value!.active ? 'Désactivation' : 'Réactivation'} · ${u.value!.email}` }), u.value?.active ? 'Compte désactivé.' : 'Compte réactivé.')
const approve = () => act(() => db.update('users', id.value, { pendingApproval: false, active: true } as any, { summary: `Compte validé · ${u.value!.email}` }), 'Compte validé.')
</script>

<template>
  <div>
    <UiEmpty v-if="!u" icon="user-x" title="Utilisateur introuvable"><UiButton icon="arrow-left" to="/admin/utilisateurs">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="u.name" back="/admin/utilisateurs" icon="user-round" :description="`${u.email} · ${roleLabel(u.role)}`">
        <template #meta><UiBadge :tone="u.pendingApproval ? 'warning' : u.active ? 'success' : 'neutral'" dot>{{ u.pendingApproval ? 'À valider' : u.active ? 'Actif' : 'Désactivé' }}</UiBadge><UiDemoBadge v-if="u.demo" /></template>
        <template #actions>
          <UiButton v-if="u.pendingApproval" icon="check" @click="approve">Valider le compte</UiButton>
          <UiButton variant="outline" icon="pencil" @click="open = true">Modifier</UiButton>
          <UiButton variant="outline" :icon="u.active ? 'user-x' : 'user-check'" @click="toggle">{{ u.active ? 'Désactiver' : 'Réactiver' }}</UiButton>
        </template>
      </UiPageHeader>
      <div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Permissions effectives" icon="key-round">
            <p v-if="isAdmin" class="text-sm">Accès complet à la plateforme (rôle administrateur).</p>
            <div v-else class="flex flex-wrap gap-2"><UiBadge v-for="p in base" :key="p" size="sm">{{ p }}</UiBadge><UiBadge v-for="p in u.extraPermissions ?? []" :key="`x-${p}`" tone="warning" size="sm" icon="plus">{{ p }}</UiBadge><span v-if="!base.length && !(u.extraPermissions ?? []).length" class="text-sm text-muted">Aucune permission particulière.</span></div>
            <p class="mt-3 text-[13px] text-muted">Les badges orange sont des permissions ajoutées individuellement. Voir la matrice complète dans <NuxtLink to="/admin/acces" class="underline">Accès &amp; permissions</NuxtLink>.</p>
          </UiCard>
          <UiCard title="Activité récente" icon="history">
            <UiEmpty v-if="!audit.length" compact icon="history" title="Aucune activité" />
            <UiTimeline v-else :items="audit.map((e) => ({ at: e.at, title: e.summary, body: e.entity }))" />
          </UiCard>
        </div>
        <aside class="flex flex-col gap-5">
          <UiCard title="Profil" icon="id-card"><UiKeyValue :items="[{ label: 'Rôle', value: roleLabel(u.role) }, { label: 'Téléphone', value: u.phone ?? '—' }, { label: 'Entreprise', value: u.companyId ? L.companyName(u.companyId) : '—' }, { label: 'Collecteur', value: u.supplierId ? L.supplierName(u.supplierId) : '—' }, { label: 'Créé le', value: fdate(u.createdAt) }, { label: 'Dernière connexion', value: u.lastLoginAt ? fdatetime(u.lastLoginAt) : '—' }]" /></UiCard>
          <UiButton v-if="u.companyId" variant="outline" icon="building-2" :to="`/admin/clients/${u.companyId}`">Voir l’entreprise</UiButton>
        </aside>
      </div>
      <UiFormDialog v-model:open="open" title="Modifier l’utilisateur" :fields="fields" :initial="{ name: u.name, phone: u.phone ?? '', role: u.role, extraPermissions: u.extraPermissions ?? [] }" submit-label="Enregistrer" @submit="save" />
    </template>
  </div>
</template>
