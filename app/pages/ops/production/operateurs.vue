<script setup lang="ts">
import type { Operator } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Opérateurs')
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom', type: 'text', required: true, span: 2 },
  { key: 'station', label: 'Poste', type: 'text', required: true },
  { key: 'shift', label: 'Équipe', type: 'select', required: true, options: [{ value: 'matin', label: 'Matin' }, { value: 'après-midi', label: 'Après-midi' }, { value: 'nuit', label: 'Nuit' }] },
  { key: 'active', label: 'Actif', type: 'switch' },
]
const columns = [
  { key: 'name', label: 'Opérateur', sortable: true },
  { key: 'station', label: 'Poste', sortable: true },
  { key: 'shift', label: 'Équipe', hide: 'sm' as const },
  { key: 'active', label: 'Statut', value: (o: Operator) => (o.active ? 'Actif' : 'Inactif') },
]
const filters = [{ key: 'active', label: 'Statut', options: [{ value: 'yes', label: 'Actifs' }, { value: 'no', label: 'Inactifs' }], accessor: (o: Operator) => (o.active ? 'yes' : 'no') }]
</script>

<template>
  <WsCrud collection="operators" title="Opérateurs" description="Équipe de production : postes et équipes de travail." icon="users" :columns="columns" :fields="fields" :filters="filters" noun="opérateur" create-label="Nouvel opérateur" :defaults="{ shift: 'matin', active: true }" export-name="operateurs">
    <template #cell-active="{ row }"><UiBadge :tone="row.active ? 'success' : 'neutral'" size="sm" dot>{{ row.active ? 'Actif' : 'Inactif' }}</UiBadge></template>
  </WsCrud>
</template>
