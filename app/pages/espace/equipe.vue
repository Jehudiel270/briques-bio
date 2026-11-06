<script setup lang="ts">
import type { CompanyContact } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

usePageTitle('Équipe')
const db = useDb()
const auth = useAuth()
const confirm = useConfirm()
const toast = useToast()

const company = computed(() => db.peek('companies', auth.user.value?.companyId))
const canManage = computed(() => auth.can('company.team.manage'))
const contacts = computed(() => company.value?.contacts ?? [])
const members = computed(() => db.all('users').filter((u) => u.companyId === company.value?.id))

const addOpen = ref(false)
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom et prénom', type: 'text', required: true },
  { key: 'function', label: 'Fonction', type: 'text' },
  { key: 'email', label: 'Adresse e-mail', type: 'email', required: true },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'authorized', label: 'Autorisé à demander des devis et commander', type: 'switch', span: 2 },
]
const save = (list: CompanyContact[], summary: string) => db.update('companies', company.value!.id, { contacts: list } as any, { summary })
function add(v: Record<string, any>) {
  save([...contacts.value, { id: `ct_${Date.now()}`, name: v.name, email: v.email, phone: v.phone, function: v.function, authorized: !!v.authorized }], `Contact ajouté · ${v.name}`)
}
function toggle(c: CompanyContact) {
  try { save(contacts.value.map((x) => (x.id === c.id ? { ...x, authorized: !x.authorized } : x)), `Autorisation modifiée · ${c.name}`) } catch (e: any) { toast.error(e.message) }
}
async function remove(c: CompanyContact) {
  if (!(await confirm({ title: `Retirer ${c.name} ?`, message: 'Cette personne ne figurera plus parmi les contacts de l’entreprise.', confirmLabel: 'Retirer', tone: 'danger' }))) return
  try { save(contacts.value.filter((x) => x.id !== c.id), `Contact retiré · ${c.name}`) } catch (e: any) { toast.error(e.message) }
}
const ROLE: Record<string, string> = { owner: 'Responsable', buyer: 'Acheteur', accountant: 'Comptable', viewer: 'Lecteur' }
</script>

<template>
  <div>
    <UiPageHeader title="Équipe" description="Les personnes de votre entreprise et leurs droits d’achat." icon="users">
      <template #actions><UiButton v-if="canManage && company" icon="user-plus" @click="addOpen = true">Ajouter un contact</UiButton></template>
    </UiPageHeader>
    <UiEmpty v-if="!company" icon="users" title="Aucune entreprise rattachée" />
    <div v-else class="grid gap-5 lg:grid-cols-2">
      <UiCard title="Comptes utilisateurs" icon="user-round-check" padding="none">
        <ul class="divide-y divide-line">
          <li v-for="u in members" :key="u.id" class="flex items-center gap-3 px-4 py-3 sm:px-5">
            <UiAvatar :name="u.name" /><div class="min-w-0 flex-1"><p class="truncate font-medium">{{ u.name }}</p><p class="truncate text-[13px] text-muted">{{ u.email }}</p></div>
            <UiBadge tone="neutral" size="sm">{{ u.companyRole ? ROLE[u.companyRole] : 'Membre' }}</UiBadge>
          </li>
        </ul>
      </UiCard>
      <UiCard title="Contacts de l’entreprise" icon="contact" padding="none">
        <UiEmpty v-if="!contacts.length" compact icon="contact" title="Aucun contact" />
        <ul v-else class="divide-y divide-line">
          <li v-for="c in contacts" :key="c.id" class="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ c.name }}<span v-if="c.function" class="font-normal text-muted"> · {{ c.function }}</span></p><p class="truncate text-[13px] text-muted">{{ c.email }}</p></div>
            <UiSwitch v-if="canManage" :model-value="c.authorized" :aria-label="`Autoriser ${c.name} à commander`" @update:model-value="toggle(c)" />
            <UiBadge v-else :tone="c.authorized ? 'success' : 'neutral'" size="sm">{{ c.authorized ? 'Autorisé' : 'Lecture' }}</UiBadge>
            <UiButton v-if="canManage" size="sm" variant="ghost" icon="trash-2" :aria-label="`Retirer ${c.name}`" @click="remove(c)" />
          </li>
        </ul>
      </UiCard>
    </div>
    <UiFormDialog v-model:open="addOpen" title="Ajouter un contact" :fields="fields" :initial="{ authorized: true }" submit-label="Ajouter" @submit="add" />
  </div>
</template>
