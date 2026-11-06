<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'

usePageTitle('Mon profil')
const db = useDb()
const auth = useAuth()
const confirm = useConfirm()
const L = useLookups()

const u = computed(() => auth.user.value)
const carrier = computed(() => db.peek('carriers', u.value?.carrierId))
const editOpen = ref(false)
const fields: FieldDef[] = [
  { key: 'name', label: 'Nom et prénom', type: 'text', required: true, span: 2 },
  { key: 'phone', label: 'Téléphone', type: 'tel', required: true, span: 2 },
]
const save = (v: Record<string, any>) => db.update('users', u.value!.id, { name: v.name, phone: v.phone } as any, { summary: 'Profil chauffeur mis à jour' })
async function logout() { if (await confirm({ title: 'Se déconnecter ?', message: 'Vous pourrez vous reconnecter à tout moment.', confirmLabel: 'Se déconnecter' })) await auth.logout() }
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Mon profil" icon="user-round"><template #actions><UiButton variant="outline" icon="pencil" @click="editOpen = true">Modifier</UiButton></template></UiPageHeader>
    <UiCard>
      <div class="flex items-center gap-3"><UiAvatar :name="u?.name ?? ''" /><div class="min-w-0"><p class="truncate font-display font-semibold">{{ u?.name }}</p><p class="truncate text-[13px] text-muted">{{ u?.email }}</p></div></div>
      <UiKeyValue class="mt-4" :items="[
        { label: 'Téléphone', value: u?.phone },
        { label: 'Transporteur', value: carrier ? L.carrierName(carrier.id) : '—' },
        { label: 'Véhicule', value: carrier ? `${carrier.vehicle}${carrier.plate ? ' · ' + carrier.plate : ''}` : '—' },
      ]" />
    </UiCard>
    <UiButton variant="outline" size="lg" block icon="log-out" @click="logout">Se déconnecter</UiButton>
    <UiFormDialog v-model:open="editOpen" title="Modifier mon profil" :fields="fields" :initial="{ name: u?.name, phone: u?.phone }" @submit="save" />
  </div>
</template>
