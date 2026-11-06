<script setup lang="ts">
import { ROLE_ICON, DEMO_ROLE_GROUPS } from '~/utils/role-ui'
import { hasErrors, safeRedirect, validateLogin } from '~/utils/validate-auth'

usePageTitle('Connexion')
const route = useRoute()
const auth = useAuth()
const act = useAction()
const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string | undefined>>({})
const formError = ref('')
const busy = ref(false)
const showPw = ref(false)

const target = (role?: string) => safeRedirect(route.query.redirect) ?? homeFor((role ?? auth.role.value) as any)

watchEffect(() => {
  if (auth.isLoggedIn.value) navigateTo(target())
})

async function submit() {
  formError.value = ''
  errors.value = validateLogin(form)
  if (hasErrors(errors.value)) return
  busy.value = true
  try {
    const u = await auth.loginWithPassword(form.email, form.password)
    await navigateTo(target(u.role))
  } catch (e: any) {
    formError.value = e?.message ?? 'Connexion impossible : vérifiez vos identifiants puis réessayez.'
  } finally {
    busy.value = false
  }
}

async function enterDemo(userId: string) {
  const ok = await act(async () => {
    const u = await auth.loginDemo(userId)
    await navigateTo(target(u.role))
  })
  return ok
}

const accounts = computed(() => auth.demoAccounts.value)
const byRole = (r: string) => accounts.value.find((a) => a.role === r)
</script>

<template>
  <div class="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:py-16">
    <section aria-labelledby="titre-connexion">
      <h1 id="titre-connexion" class="text-3xl font-semibold">Se connecter</h1>
      <p class="mt-2 text-muted">Accédez à votre espace client, au portail collecteur ou aux outils de l’équipe.</p>
      <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
        <UiAlert v-if="formError" tone="danger" title="Connexion impossible">{{ formError }}</UiAlert>
        <UiField label="Adresse e-mail" :error="errors.email" required>
          <template #default="{ id }"><UiInput :id="id" v-model="form.email" type="email" icon="mail" autocomplete="email" placeholder="nom@entreprise.bj" :error="errors.email" /></template>
        </UiField>
        <UiField label="Mot de passe" :error="errors.password" required>
          <template #default="{ id }">
            <div class="relative">
              <UiInput :id="id" v-model="form.password" :type="showPw ? 'text' : 'password'" icon="lock" autocomplete="current-password" :error="errors.password" @enter="submit" />
              <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" :aria-label="showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'" @click="showPw = !showPw">
                <Icon :name="showPw ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
              </button>
            </div>
          </template>
        </UiField>
        <UiButton type="submit" variant="primary" size="lg" block :loading="busy" icon="log-in">Se connecter</UiButton>
      </form>
      <p class="mt-6 text-sm text-muted">Pas encore de compte ? <NuxtLink class="font-medium text-primary underline underline-offset-4" to="/inscription">Créer un compte</NuxtLink></p>
      <UiAlert v-if="!auth.realAuth" tone="info" class="mt-6" dense>
        L’authentification Neon Auth n’est pas configurée dans cet environnement : seuls les comptes de démonstration sont disponibles.
      </UiAlert>
    </section>

    <section v-if="auth.demoMode" aria-labelledby="titre-demo" class="card p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="titre-demo" class="text-xl font-semibold">Comptes de démonstration</h2>
          <p class="mt-1 text-sm text-muted">Explorez chaque espace avec des données fictives. Mot de passe commun : <code class="rounded bg-surface-2 px-1.5 py-0.5 text-ink">demo1234</code></p>
        </div>
        <UiDemoBadge />
      </div>
      <div class="mt-5 space-y-5">
        <div v-for="g in DEMO_ROLE_GROUPS" :key="g.title">
          <h3 class="mb-2 text-[13px] font-semibold text-muted">{{ g.title }}</h3>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="r in g.roles" :key="r">
              <button v-if="byRole(r)" type="button" class="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-surface-2" @click="enterDemo(byRole(r)!.id)">
                <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon :name="`lucide:${ROLE_ICON[r]}`" class="size-[18px]" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ roleLabel(r) }}</span>
                  <span class="block truncate text-xs text-muted">{{ byRole(r)!.email }}</span>
                </span>
                <Icon name="lucide:arrow-right" class="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
