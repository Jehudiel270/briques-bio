<script setup lang="ts">
import { POLYMER_LABEL, SUPPLIER_KIND_LABEL } from '#shared/utils/labels'
const polyNames = (codes: readonly string[], sep = ', ') => codes.map((c) => POLYMER_LABEL[c] ?? c).join(sep)
import type { PolymerCode } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Mon profil')
const db = useDb()
const auth = useAuth()
const settings = useSettings()
const confirm = useConfirm()

const s = computed(() => db.peek('suppliers', auth.user.value?.supplierId))
const editOpen = ref(false)
const fields = computed<FieldDef[]>(() => [
  { key: 'name', label: 'Nom de la structure', type: 'text', required: true, span: 2 },
  { key: 'contactName', label: 'Personne à contacter', type: 'text', required: true },
  { key: 'phone', label: 'Téléphone', type: 'tel', required: true },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'line', label: 'Adresse', type: 'text', required: true },
  { key: 'city', label: 'Ville', type: 'text', required: true },
  { key: 'polymers', label: 'Plastiques habituellement collectés', type: 'multiselect', span: 2, options: settings.value.polymers.filter((p) => p.accepted).map((p) => ({ value: p.code, label: POLYMER_LABEL[p.code] ?? p.code })) },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 2, rows: 3 },
])
const initial = computed(() => ({ name: s.value?.name, contactName: s.value?.contactName, phone: s.value?.phone, email: s.value?.email, line: s.value?.address.line, city: s.value?.address.city, polymers: s.value?.polymers ?? [], notes: s.value?.notes }))
function save(v: Record<string, any>) {
  db.update('suppliers', s.value!.id, { name: v.name, contactName: v.contactName, phone: v.phone, email: v.email, address: { ...s.value!.address, line: v.line, city: v.city }, polymers: v.polymers as PolymerCode[], notes: v.notes } as any, { summary: 'Profil collecteur mis à jour' })
}
async function logout() { if (await confirm({ title: 'Se déconnecter ?', message: 'Vous pourrez vous reconnecter à tout moment.', confirmLabel: 'Se déconnecter' })) await auth.logout() }
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Mon profil" icon="user-round">
      <template #actions><UiButton v-if="s" variant="outline" icon="pencil" @click="editOpen = true">Modifier</UiButton></template>
    </UiPageHeader>
    <UiEmpty v-if="!s" icon="user-round-x" title="Aucun profil de collecte rattaché" hint="Votre compte n’est lié à aucun profil de collecte. Contactez l’équipe approvisionnement." />
    <template v-else>
      <UiCard>
        <div class="flex items-center gap-3"><UiAvatar :name="s.name" /><div class="min-w-0 flex-1"><p class="truncate font-display font-semibold">{{ s.name }}</p><p class="text-[13px] text-muted">{{ SUPPLIER_KIND_LABEL[s.kind] }}</p></div><UiStatusBadge kind="supplier" :value="s.status" size="sm" /></div>
        <UiKeyValue class="mt-4" :items="[
          { label: 'Contact', value: s.contactName }, { label: 'Téléphone', value: s.phone }, { label: 'E-mail', value: s.email },
          { label: 'Adresse', value: `${s.address.line}, ${s.address.city}` },
          { label: 'Plastiques', value: polyNames(s.polymers) || '—' },
          { label: 'Rémunération', value: s.paymentModel === 'per_kg' ? 'Au kilo accepté (simulée)' : 'Sans rémunération' },
        ]" />
      </UiCard>
    </template>
    <UiButton variant="outline" size="lg" block icon="log-out" @click="logout">Se déconnecter</UiButton>
    <UiFormDialog v-model:open="editOpen" title="Modifier mon profil" :fields="fields" :initial="initial" size="lg" @submit="save" />
  </div>
</template>
