<script setup lang="ts">
import { fcfa } from '#shared/utils/format'
import type { Carrier } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Transporteurs')
const settings = useSettings()
const zoneOptions = computed(() => settings.value.zones.map((z) => ({ value: z.id, label: z.name })))
const zoneNames = (c: Carrier) => c.zones.map((id) => settings.value.zones.find((z) => z.id === id)?.name ?? id).join(', ') || '—'
const fields = computed<FieldDef[]>(() => [
  { key: 'name', label: 'Transporteur', type: 'text', required: true, span: 2 },
  { key: 'contactName', label: 'Contact', type: 'text' },
  { key: 'phone', label: 'Téléphone', type: 'tel', required: true },
  { key: 'vehicle', label: 'Véhicule', type: 'text', required: true },
  { key: 'plate', label: 'Immatriculation', type: 'text' },
  { key: 'zones', label: 'Zones desservies', type: 'multiselect', options: zoneOptions.value, span: 2 },
  { key: 'flatFee', label: 'Forfait (FCFA)', type: 'currency', min: 0 },
  { key: 'perKmFee', label: 'Tarif au km (FCFA)', type: 'currency', min: 0 },
  { key: 'status', label: 'Statut', type: 'select', required: true, options: [{ value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Inactif' }] },
])
const columns = [
  { key: 'name', label: 'Transporteur', sortable: true },
  { key: 'vehicle', label: 'Véhicule', hide: 'sm' as const, value: (c: Carrier) => `${c.vehicle}${c.plate ? ` · ${c.plate}` : ''}` },
  { key: 'phone', label: 'Téléphone', hide: 'md' as const },
  { key: 'zones', label: 'Zones', hide: 'lg' as const, value: zoneNames },
  { key: 'flatFee', label: 'Forfait', align: 'right' as const, hide: 'md' as const, value: (c: Carrier) => (c.flatFee != null ? fcfa(c.flatFee) : '—') },
  { key: 'status', label: 'Statut', value: (c: Carrier) => (c.status === 'active' ? 'Actif' : 'Inactif') },
]
const filters = [{ key: 'status', label: 'Statut', options: [{ value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Inactif' }], accessor: (c: Carrier) => c.status }]
const fromValues = (v: Record<string, any>) => ({
  name: v.name, contactName: v.contactName || undefined, phone: v.phone, vehicle: v.vehicle, plate: v.plate || undefined,
  zones: v.zones ?? [], flatFee: v.flatFee ?? undefined, perKmFee: v.perKmFee ?? undefined, status: v.status, demo: true,
})
</script>

<template>
  <div>
    <WsCrud collection="carriers" title="Transporteurs" description="Prestataires de livraison : véhicule, zones desservies et tarifs." icon="truck" :columns="columns" :fields="fields" :filters="filters" noun="transporteur" create-label="Nouveau transporteur" :defaults="{ status: 'active', zones: [] }" :from-values="fromValues" export-name="transporteurs" dialog-size="lg">
      <template #cell-status="{ row }"><UiBadge :tone="row.status === 'active' ? 'success' : 'neutral'" size="sm" :dot="true">{{ row.status === 'active' ? 'Actif' : 'Inactif' }}</UiBadge></template>
    </WsCrud>
    <SiteNotice class="mt-4" kind="demo" dense />
  </div>
</template>
