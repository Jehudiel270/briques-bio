<script setup lang="ts">
import { fmonth, kg, num } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { EnvRecord } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Données mensuelles')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()
const rows = computed(() => [...db.all('envRecords')].sort((a, b) => b.period.localeCompare(a.period) || a.polymer.localeCompare(b.polymer)))
const pending = computed(() => rows.value.filter((r) => !r.validated))
const may = computed(() => auth.can('env.manage'))
const aggOpen = ref(false)
const fields: FieldDef[] = [{ key: 'period', label: 'Mois à agréger', type: 'text', required: true, placeholder: 'AAAA-MM', hint: 'Format AAAA-MM, par exemple 2026-10.', span: 2, validate: (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v)) ? undefined : 'Format attendu : AAAA-MM') }]
const aggregate = (v: Record<string, any>) => svc.env.aggregate(String(v.period))
const validate = (r: EnvRecord) => act(() => svc.env.validateRecord(r.id), 'Données validées.')
const validateAll = async () => { for (const r of pending.value) { const ok = await act(() => svc.env.validateRecord(r.id)); if (!ok) return } }
const columns = [
  { key: 'period', label: 'Période', sortable: true, value: (r: EnvRecord) => fmonth(r.period), sortValue: (r: EnvRecord) => r.period },
  { key: 'polymer', label: 'Plastique', sortable: true, value: (r: EnvRecord) => POLYMER_LABEL[r.polymer] },
  { key: 'receivedKg', label: 'Reçu', align: 'right' as const, value: (r: EnvRecord) => kg(r.receivedKg) },
  { key: 'acceptedKg', label: 'Accepté', align: 'right' as const, hide: 'sm' as const, value: (r: EnvRecord) => kg(r.acceptedKg) },
  { key: 'rejectedKg', label: 'Rejeté', align: 'right' as const, hide: 'md' as const, value: (r: EnvRecord) => kg(r.rejectedKg) },
  { key: 'usedInProductionKg', label: 'En production', align: 'right' as const, hide: 'md' as const, value: (r: EnvRecord) => kg(r.usedInProductionKg) },
  { key: 'finishedUnits', label: 'Pièces', align: 'right' as const, hide: 'lg' as const, value: (r: EnvRecord) => num(r.finishedUnits) },
  { key: 'lossKg', label: 'Pertes', align: 'right' as const, hide: 'lg' as const, value: (r: EnvRecord) => kg(r.lossKg) },
  { key: 'validated', label: 'Validation', value: (r: EnvRecord) => (r.validated ? 'Validée' : 'À valider') },
]
const filters = [
  { key: 'validated', label: 'Validation', options: [{ value: 'yes', label: 'Validées' }, { value: 'no', label: 'À valider' }], accessor: (r: EnvRecord) => (r.validated ? 'yes' : 'no') },
  { key: 'period', label: 'Période', options: [...new Set(rows.value.map((r) => r.period))].map((value) => ({ value, label: fmonth(value) })), accessor: (r: EnvRecord) => r.period },
]
</script>

<template>
  <div>
    <UiPageHeader title="Données mensuelles" description="Agrégation des pesées, lots de matière et lots produits par mois et par plastique." icon="table-2">
      <template #actions>
        <UiButton v-if="may && pending.length" variant="outline" icon="check-check" @click="validateAll">Tout valider ({{ pending.length }})</UiButton>
        <UiButton v-if="may" icon="refresh-cw" @click="aggOpen = true">Agréger un mois</UiButton>
      </template>
    </UiPageHeader>
    <UiDataTable :rows="rows" :columns="columns" :filters="filters" dense export-name="donnees-environnement" :initial-sort="{ key: 'period', dir: 'desc' }">
      <template #cell-validated="{ row }"><UiBadge :tone="row.validated ? 'success' : 'warning'" size="sm" :icon="row.validated ? 'badge-check' : 'clock'">{{ row.validated ? `Validée${row.validatedBy ? ` · ${L.userName(row.validatedBy)}` : ''}` : 'À valider' }}</UiBadge></template>
      <template v-if="may" #actions="{ row }"><UiButton v-if="!row.validated" size="sm" variant="outline" icon="check" @click.stop="validate(row)">Valider</UiButton></template>
      <template #empty><UiEmpty icon="table-2" title="Aucune donnée mensuelle" hint="Agrégez un mois pour calculer les quantités à partir des opérations."><UiButton v-if="may" icon="refresh-cw" @click="aggOpen = true">Agréger un mois</UiButton></UiEmpty></template>
    </UiDataTable>
    <SiteNotice class="mt-4" kind="demo" dense />
    <UiFormDialog v-model:open="aggOpen" title="Agréger un mois" description="Recalcule les quantités à partir des réceptions, lots et pertes du mois. Une validation existante est conservée si les chiffres ne changent pas." :fields="fields" :initial="{ period: new Date().toISOString().slice(0, 7) }" submit-label="Calculer" @submit="aggregate" />
  </div>
</template>
