<script setup lang="ts">
import { DEMO_ROLE_GROUPS, ROLE_ICON } from '~/utils/role-ui'
import type { RoleKey } from '#shared/types/domain'
/**
 * Sélecteur de rôle de DÉMONSTRATION : visible uniquement en mode démo (`runtimeConfig.public.demoMode`).
 * Permet de parcourir l'application avec chaque rôle sans se reconnecter. Désactiver le mode démo le retire entièrement.
 */
const auth = useAuth()
const router = useRouter()
const open = ref(false)
const toast = useToast()
const busy = ref<string | null>(null)

async function pick(role: RoleKey) {
  busy.value = role
  try {
    await auth.switchDemoRole(role)
    open.value = false
    await router.push(homeFor(role))
    toast.info(`Vous parcourez maintenant EcoBloc comme « ${roleLabel(role)} ».`, { title: 'Rôle de démonstration' })
  } catch (e: any) {
    toast.error(e?.message ?? 'Changement de rôle impossible.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div v-if="auth.demoMode">
    <button
      type="button"
      class="inline-flex h-9 items-center gap-2 rounded-md border border-accent/60 bg-accent/18 px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-accent/30"
      aria-label="Changer de rôle de démonstration"
      @click="open = true"
    >
      <Icon name="lucide:users-round" class="size-4" aria-hidden="true" />
      <span class="hidden sm:inline">{{ roleLabel(auth.role.value) }}</span>
      <span class="rounded-sm bg-accent px-1 text-[10px] font-bold uppercase text-accent-ink">Démo</span>
    </button>
    <UiSheet v-model:open="open" title="Rôle de démonstration" description="Parcourez l’application avec n’importe quel rôle. Cette fonction n’existe qu’en mode démo.">
      <div class="flex flex-col gap-5">
        <section v-for="g in DEMO_ROLE_GROUPS" :key="g.title">
          <h3 class="mb-2 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted" style="font-stretch: 100%">{{ g.title }}</h3>
          <ul class="flex flex-col gap-1.5">
            <li v-for="r in g.roles" :key="r">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors"
                :class="auth.role.value === r ? 'border-primary bg-primary/5' : 'border-line hover:border-muted/70 hover:bg-surface-2/50'"
                :disabled="busy !== null"
                @click="pick(r)"
              >
                <span class="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-primary"><Icon :name="busy === r ? 'lucide:loader-circle' : `lucide:${ROLE_ICON[r]}`" class="size-4.5" :class="busy === r && 'animate-spin'" aria-hidden="true" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-ink">{{ roleLabel(r) }}</span>
                  <span class="block truncate text-[13px] text-muted">{{ ROLES[r].description }}</span>
                </span>
                <Icon v-if="auth.role.value === r" name="lucide:check" class="size-4 text-primary" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </UiSheet>
  </div>
</template>
