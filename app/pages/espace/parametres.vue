<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'

usePageTitle('Paramètres')
const db = useDb()
const auth = useAuth()
const theme = useTheme()
const confirm = useConfirm()

const u = computed(() => auth.user.value)
const editOpen = ref(false)
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom et prénom', type: 'text', required: true, span: 2 },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'line', label: 'Adresse de livraison par défaut', type: 'text' },
  { key: 'city', label: 'Ville', type: 'text' },
]
const initial = computed(() => ({ name: u.value?.name, phone: u.value?.phone, line: u.value?.address?.line, city: u.value?.address?.city }))
function save(v: Record<string, any>) {
  db.update('users', u.value!.id, { name: v.name, phone: v.phone, address: v.line || v.city ? { ...u.value!.address, line: v.line ?? '', city: v.city ?? '', country: 'Bénin' } : u.value!.address } as any, { summary: 'Profil mis à jour' })
}
const modes = [{ value: 'light', label: 'Clair', icon: 'sun' }, { value: 'dark', label: 'Sombre', icon: 'moon' }, { value: 'system', label: 'Automatique', icon: 'monitor' }]
async function logout() {
  if (await confirm({ title: 'Se déconnecter ?', message: 'Votre liste de produits est conservée dans ce navigateur.', confirmLabel: 'Se déconnecter' })) await auth.logout()
}
</script>

<template>
  <div>
    <UiPageHeader title="Paramètres" description="Votre profil et l’apparence de l’interface." icon="settings" />
    <div class="grid gap-5 lg:grid-cols-2">
      <UiCard title="Profil" icon="user-round">
        <template #actions><UiButton size="sm" variant="outline" icon="pencil" @click="editOpen = true">Modifier</UiButton></template>
        <UiKeyValue :items="[{ label: 'Nom', value: u?.name }, { label: 'E-mail', value: u?.email }, { label: 'Téléphone', value: u?.phone }, { label: 'Adresse', value: u?.address ? `${u.address.line}, ${u.address.city}` : '—' }]" />
      </UiCard>
      <UiCard title="Apparence" icon="palette" description="Votre choix est mémorisé dans ce navigateur.">
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          <button v-for="m in modes" :key="m.value" type="button" role="radio" :aria-checked="theme.mode.value === m.value" class="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors" :class="theme.mode.value === m.value ? 'border-primary bg-primary/8' : 'border-line hover:bg-surface-2'" @click="theme.setMode(m.value as any)">
            <Icon :name="`lucide:${m.icon}`" class="size-5" aria-hidden="true" />{{ m.label }}
          </button>
        </div>
      </UiCard>
      <UiCard title="Mes données" icon="database">
        <p class="text-sm text-muted">Ce prototype enregistre vos données de démonstration dans votre navigateur ou dans la base du prototype. N’y saisissez pas de données réelles sensibles.</p>
        <NuxtLink to="/confidentialite" class="mt-3 inline-block text-sm font-medium text-primary hover:underline">Lire la politique de confidentialité</NuxtLink>
      </UiCard>
      <UiCard title="Session" icon="log-out">
        <p class="text-sm text-muted">Connecté en tant que {{ u?.email }}.</p>
        <UiButton class="mt-3" variant="outline" icon="log-out" @click="logout">Se déconnecter</UiButton>
      </UiCard>
    </div>
    <UiFormDialog v-model:open="editOpen" title="Modifier mon profil" :fields="fields" :initial="initial" @submit="save" />
  </div>
</template>
