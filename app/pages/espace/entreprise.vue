<script setup lang="ts">
import { fcfa, fmtAddress } from '#shared/utils/format'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Profil entreprise')
const db = useDb()
const auth = useAuth()

const company = computed(() => db.peek('companies', auth.user.value?.companyId))
const grid = computed(() => db.all('priceGrids').find((g) => g.id === company.value?.priceGridId))
const editOpen = ref(false)
const fields: FieldDef[] = [
  { key: 'name', label: 'Raison sociale', type: 'text', required: true, span: 2 },
  { key: 'taxId', label: 'Identifiant fiscal', type: 'text' },
  { key: 'billingEmail', label: 'E-mail de facturation', type: 'email', required: true },
  { key: 'line', label: 'Adresse', type: 'text', required: true },
  { key: 'city', label: 'Ville', type: 'text', required: true },
]
const initial = computed(() => ({ name: company.value?.name, taxId: company.value?.taxId, billingEmail: company.value?.billingEmail, line: company.value?.address.line, city: company.value?.address.city }))
function save(v: Record<string, any>) {
  db.update('companies', company.value!.id, { name: v.name, taxId: v.taxId, billingEmail: v.billingEmail, address: { ...company.value!.address, line: v.line, city: v.city } } as any, { summary: `Profil entreprise mis à jour · ${v.name}` })
}
</script>

<template>
  <div>
    <UiEmpty v-if="!company" icon="building-2" title="Aucune entreprise rattachée" hint="Votre compte n’est pas lié à une entreprise. Contactez l’équipe commerciale." />
    <template v-else>
      <UiPageHeader :title="company.name" description="Informations utilisées pour les devis, les factures et les livraisons." icon="building-2">
        <template #meta><UiStatusBadge kind="company" :value="company.status" /><UiDemoBadge /></template>
        <template #actions><UiButton variant="outline" icon="pencil" @click="editOpen = true">Modifier</UiButton></template>
      </UiPageHeader>
      <div class="grid gap-5 lg:grid-cols-2">
        <UiCard title="Identité" icon="id-card">
          <UiKeyValue :items="[
            { label: 'Raison sociale', value: company.name },
            { label: 'Type', value: company.kind === 'distributor' ? 'Distributeur' : 'Client professionnel' },
            { label: 'Identifiant fiscal', value: company.taxId },
            { label: 'Adresse', value: fmtAddress(company.address) },
            { label: 'E-mail de facturation', value: company.billingEmail },
          ]" />
        </UiCard>
        <UiCard title="Conditions commerciales" icon="handshake">
          <UiKeyValue :items="[
            { label: 'Délai de paiement', value: `${company.paymentTermsDays} jours` },
            { label: 'Plafond de crédit', value: company.creditLimit != null ? fcfa(company.creditLimit) : '—' },
            { label: 'Grille tarifaire', value: grid?.name ?? 'Tarif public' },
            { label: 'Contacts autorisés', value: `${company.contacts.filter((c) => c.authorized).length} sur ${company.contacts.length}` },
          ]" />
          <p class="mt-3 text-[13px] text-muted">Les conditions commerciales sont fixées par l’équipe commerciale : écrivez-lui pour les faire évoluer.</p>
        </UiCard>
      </div>
      <UiFormDialog v-model:open="editOpen" title="Modifier le profil entreprise" :fields="fields" :initial="initial" @submit="save" />
    </template>
  </div>
</template>
