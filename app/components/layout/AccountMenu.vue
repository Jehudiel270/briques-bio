<script setup lang="ts">
import type { DropdownItem } from '~/components/ui/Dropdown.vue'
/** Menu du compte : identité, accès à l'espace, apparence (admin), déconnexion. Visiteur → boutons Connexion / Inscription. */
const auth = useAuth()
const router = useRouter()
const confirm = useConfirm()

const items = computed<DropdownItem[]>(() => {
  const list: DropdownItem[] = [{ label: 'Mon espace', icon: 'layout-dashboard', to: homeFor(auth.role.value) }]
  if (auth.can('theme.manage')) list.push({ label: 'Apparence et thèmes', icon: 'palette', to: '/admin/apparence' })
  list.push({ divider: true }, {
    label: 'Se déconnecter',
    icon: 'log-out',
    danger: true,
    onSelect: async () => {
      if (await confirm({ title: 'Se déconnecter ?', message: 'Votre session sera fermée sur cet appareil.', confirmLabel: 'Se déconnecter' })) {
        await auth.logout()
        router.push('/')
      }
    },
  })
  return list
})
</script>

<template>
  <UiDropdown v-if="auth.isLoggedIn.value && auth.user.value" :items="items">
    <template #header>
      <div class="border-b border-line px-2.5 pb-2.5 pt-2">
        <p class="truncate text-sm font-semibold text-ink">{{ auth.user.value.name }}</p>
        <p class="truncate text-[13px] text-muted">{{ auth.user.value.email }}</p>
        <UiBadge class="mt-1.5" size="sm">{{ roleLabel(auth.role.value) }}</UiBadge>
      </div>
    </template>
    <button type="button" class="flex items-center gap-2 rounded-full p-0.5 pr-2 outline-none hover:bg-surface-2" aria-label="Menu du compte">
      <UiAvatar :name="auth.user.value.name" size="sm" />
      <Icon name="lucide:chevron-down" class="hidden size-3.5 text-muted sm:block" aria-hidden="true" />
    </button>
  </UiDropdown>
  <div v-else class="flex items-center gap-1.5">
    <UiButton variant="ghost" size="sm" to="/connexion">Connexion</UiButton>
    <UiButton variant="primary" size="sm" to="/inscription" class="max-sm:hidden">Créer un compte</UiButton>
  </div>
</template>
