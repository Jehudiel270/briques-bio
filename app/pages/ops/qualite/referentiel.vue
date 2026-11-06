<script setup lang="ts">
import type { QcTemplate } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Référentiel de tests')
const db = useDb()
const L = useLookups()
const productOptions = computed(() => [{ value: '', label: 'Tous les produits' }, ...db.all('products').map((p) => ({ value: p.id, label: `${p.ref} · ${p.name}` }))])
const fields = computed<FieldDef[]>(() => [
  { key: 'code', label: 'Code', type: 'text', required: true },
  { key: 'order', label: 'Ordre d’affichage', type: 'number', required: true, min: 1 },
  { key: 'name', label: 'Test', type: 'text', required: true, span: 2 },
  { key: 'productId', label: 'Produit concerné', type: 'select', options: productOptions.value, span: 2 },
  { key: 'method', label: 'Méthode interne (description)', type: 'textarea', required: true, span: 2, rows: 2 },
  { key: 'kind', label: 'Type de critère', type: 'select', required: true, options: [{ value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }, { value: 'range', label: 'Plage' }, { value: 'pass_fail', label: 'Conforme / non conforme' }] },
  { key: 'unit', label: 'Unité', type: 'text' },
  { key: 'min', label: 'Seuil minimum', type: 'number', step: 0.1, showIf: (a) => ['min', 'range'].includes(a.kind) },
  { key: 'max', label: 'Seuil maximum', type: 'number', step: 0.1, showIf: (a) => ['max', 'range'].includes(a.kind) },
  { key: 'required', label: 'Test obligatoire pour libérer un lot', type: 'switch', span: 2 },
])
const critText = (t: QcTemplate) => ({ min: `≥ ${t.criterion.min ?? '—'}`, max: `≤ ${t.criterion.max ?? '—'}`, range: `${t.criterion.min ?? '—'} – ${t.criterion.max ?? '—'}`, pass_fail: 'Conforme' })[t.criterion.kind]
const columns = [
  { key: 'order', label: '#', sortable: true, width: '3rem' },
  { key: 'name', label: 'Test', sortable: true },
  { key: 'product', label: 'Produit', hide: 'md' as const, value: (t: QcTemplate) => (t.productId ? L.productName(t.productId) : 'Tous') },
  { key: 'criterion', label: 'Critère (démo)', value: (t: QcTemplate) => `${critText(t)}${t.unit ? ` ${t.unit}` : ''}` },
  { key: 'required', label: 'Obligatoire', hide: 'sm' as const, value: (t: QcTemplate) => (t.required ? 'Oui' : 'Non') },
  { key: 'method', label: 'Méthode', hide: 'lg' as const },
]
const toValues = (t: QcTemplate) => ({ ...t, productId: t.productId ?? '', kind: t.criterion.kind, min: t.criterion.min ?? null, max: t.criterion.max ?? null })
const fromValues = (v: Record<string, any>) => ({
  code: v.code, name: v.name, method: v.method, unit: v.unit || '', productId: v.productId || undefined, order: Number(v.order), required: !!v.required, demoValues: true as const,
  criterion: { kind: v.kind, ...(['min', 'range'].includes(v.kind) && v.min != null && v.min !== '' ? { min: Number(v.min) } : {}), ...(['max', 'range'].includes(v.kind) && v.max != null && v.max !== '' ? { max: Number(v.max) } : {}) },
})
</script>

<template>
  <div>
    <WsCrud collection="qcTemplates" title="Référentiel de tests" description="Tests demandés lors d’un contrôle qualité, avec leurs seuils internes de démonstration." icon="list-checks" :columns="columns" :fields="fields" noun="test" create-label="Nouveau test" :defaults="{ kind: 'min', required: true, order: 10 }" :to-values="toValues" :from-values="fromValues" export-name="referentiel-tests" :initial-sort="{ key: 'order', dir: 'asc' }" dialog-size="lg" />
    <SiteNotice class="mt-4" kind="technical" />
    <UiAlert class="mt-3" tone="warning" icon="octagon-alert" title="Seuils de démonstration">Ces seuils ne sont ni normatifs ni certifiés : ils doivent être remplacés par les exigences validées avant toute commercialisation.</UiAlert>
  </div>
</template>
