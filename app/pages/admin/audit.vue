<script setup lang="ts">
import { fdatetime } from '#shared/utils/format'
import { roleLabel } from '#shared/utils/roles'
import type { AuditEntry } from '#shared/types/domain'

usePageTitle('Journal d’audit')
const db = useDb()
const rows = computed(() => [...db.all('auditLog')].sort((a, b) => b.at.localeCompare(a.at)))
const ACTION: Record<AuditEntry['action'], { label: string; tone: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }> = {
  create: { label: 'Création', tone: 'success' }, update: { label: 'Modification', tone: 'info' }, delete: { label: 'Suppression', tone: 'danger' },
  status: { label: 'Changement de statut', tone: 'warning' }, login: { label: 'Connexion', tone: 'neutral' }, logout: { label: 'Déconnexion', tone: 'neutral' },
  export: { label: 'Export', tone: 'info' }, permission: { label: 'Permission', tone: 'warning' }, reset: { label: 'Réinitialisation', tone: 'danger' },
}
const columns = [
  { key: 'at', label: 'Date', sortable: true, value: (e: AuditEntry) => fdatetime(e.at), sortValue: (e: AuditEntry) => e.at },
  { key: 'user', label: 'Utilisateur', value: (e: AuditEntry) => e.userName },
  { key: 'role', label: 'Rôle', hide: 'lg' as const, value: (e: AuditEntry) => roleLabel(e.role) },
  { key: 'action', label: 'Action', value: (e: AuditEntry) => ACTION[e.action]?.label ?? e.action },
  { key: 'entity', label: 'Objet', hide: 'md' as const },
  { key: 'summary', label: 'Détail', hide: 'sm' as const },
]
const uniq = (f: (e: AuditEntry) => string) => [...new Set(rows.value.map(f))].sort().map((value) => ({ value, label: value }))
const filters = computed(() => [
  { key: 'action', label: 'Action', options: Object.entries(ACTION).map(([value, m]) => ({ value, label: m.label })), accessor: (e: AuditEntry) => e.action },
  { key: 'entity', label: 'Objet', options: uniq((e) => e.entity), accessor: (e: AuditEntry) => e.entity },
  { key: 'user', label: 'Utilisateur', options: uniq((e) => e.userName), accessor: (e: AuditEntry) => e.userName },
])
const selected = ref<AuditEntry | null>(null)
const open = computed({ get: () => !!selected.value, set: (v) => { if (!v) selected.value = null } })
const pretty = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v, null, 2))
</script>

<template>
  <div>
    <UiPageHeader title="Journal d’audit" description="Trace de chaque création, modification, suppression, connexion et export, avec l’état avant et après." icon="scroll-text" />
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" dense export-name="journal-audit" :initial-sort="{ key: 'at', dir: 'desc' }" :page-size="25" @row-click="(e: AuditEntry) => (selected = e)">
      <template #cell-action="{ row }"><UiBadge :tone="ACTION[row.action as AuditEntry['action']]?.tone ?? 'neutral'" size="sm" dot>{{ ACTION[row.action as AuditEntry['action']]?.label ?? row.action }}</UiBadge></template>
      <template #empty><UiEmpty icon="scroll-text" title="Journal vide" hint="Les actions des utilisateurs apparaissent ici." /></template>
    </UiDataTable>
    <UiSheet v-model:open="open" title="Détail de l’événement" side="right" width="36rem">
      <template v-if="selected">
        <UiKeyValue :items="[{ label: 'Date', value: fdatetime(selected.at) }, { label: 'Utilisateur', value: `${selected.userName} (${roleLabel(selected.role)})` }, { label: 'Action', value: ACTION[selected.action]?.label ?? selected.action }, { label: 'Objet', value: `${selected.entity}${selected.entityId ? ` · ${selected.entityId}` : ''}` }, { label: 'Résumé', value: selected.summary }]" />
        <h3 class="mb-1 mt-5 text-[13px] font-semibold uppercase tracking-wide text-muted">Avant</h3>
        <pre class="scroll-x max-h-72 rounded-md bg-surface-2 p-3 text-[12px] leading-relaxed">{{ pretty(selected.before) }}</pre>
        <h3 class="mb-1 mt-4 text-[13px] font-semibold uppercase tracking-wide text-muted">Après</h3>
        <pre class="scroll-x max-h-72 rounded-md bg-surface-2 p-3 text-[12px] leading-relaxed">{{ pretty(selected.after) }}</pre>
      </template>
    </UiSheet>
  </div>
</template>
