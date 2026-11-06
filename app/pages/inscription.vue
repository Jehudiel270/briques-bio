<script setup lang="ts">
import { SELF_SIGNUP_ROLES } from '#shared/utils/roles'
import type { RoleKey } from '#shared/types/domain'
import { ROLE_ICON, needsApproval } from '~/utils/role-ui'
import { hasErrors, safeRedirect, validateSignUp, type SignUpValues } from '~/utils/validate-auth'

usePageTitle('Créer un compte')
const route = useRoute()
const auth = useAuth()
const wantedRole = String(route.query.role ?? '')
const form = reactive<SignUpValues>({ name: '', email: '', password: '', confirm: '', role: (SELF_SIGNUP_ROLES as readonly string[]).includes(wantedRole) ? (wantedRole as RoleKey) : 'client', terms: false })
const errors = ref<Record<string, string | undefined>>({})
const formError = ref('')
const done = ref<null | { pending: boolean; simulated: boolean }>(null)
const busy = ref(false)

const ROLE_COPY: Record<string, string> = {
  client: 'Je commande pour un projet personnel (allée, jardin, terrasse).',
  pro: 'Je représente une entreprise, un chantier ou une collectivité.',
  collector: 'Je collecte ou je livre des déchets plastiques triés.',
  distributor: 'Je revends des produits à mes propres clients.',
}

async function submit() {
  formError.value = ''
  errors.value = validateSignUp(form)
  if (hasErrors(errors.value)) return
  busy.value = true
  try {
    const res = await auth.signUp({ name: form.name, email: form.email, password: form.password, role: form.role as any })
    done.value = { pending: res.pending, simulated: res.simulated }
    if (!res.pending) await navigateTo(safeRedirect(route.query.redirect) ?? homeFor(auth.role.value))
  } catch (e: any) {
    formError.value = e?.message ?? 'Inscription impossible : vérifiez les champs puis réessayez.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
    <template v-if="done?.pending">
      <UiEmpty icon="hourglass" title="Demande reçue : compte en attente de validation" hint="L’administration vérifie votre profil avant d’activer l’accès. Vous serez prévenu dès que c’est fait.">
        <UiButton variant="primary" to="/">Retour à l’accueil</UiButton>
      </UiEmpty>
    </template>
    <template v-else>
      <h1 class="text-3xl font-semibold">Créer un compte</h1>
      <p class="mt-2 text-muted">Choisissez le type de compte, puis renseignez vos informations.</p>
      <form class="mt-8 space-y-6" novalidate @submit.prevent="submit">
        <UiAlert v-if="formError" tone="danger" title="Inscription impossible">{{ formError }}</UiAlert>
        <fieldset>
          <legend class="mb-2 text-sm font-medium">Type de compte</legend>
          <div class="grid gap-2 sm:grid-cols-2" role="radiogroup">
            <label v-for="r in SELF_SIGNUP_ROLES" :key="r" class="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors" :class="form.role === r ? 'border-primary bg-primary/6' : 'border-line hover:bg-surface-2'">
              <input v-model="form.role" type="radio" name="role" :value="r" class="sr-only">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon :name="`lucide:${ROLE_ICON[r]}`" class="size-[18px]" /></span>
              <span class="min-w-0">
                <span class="flex items-center gap-2 text-sm font-medium">{{ roleLabel(r) }} <UiBadge v-if="needsApproval(r)" tone="warning" size="sm">Validation requise</UiBadge></span>
                <span class="mt-0.5 block text-xs text-muted">{{ ROLE_COPY[r] }}</span>
              </span>
            </label>
          </div>
          <p v-if="errors.role" class="mt-1 text-sm text-danger">{{ errors.role }}</p>
          <UiAlert v-if="needsApproval(form.role as any)" tone="info" class="mt-3" dense>Les comptes collecteur et distributeur sont validés par l’administration avant activation.</UiAlert>
        </fieldset>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Nom complet" :error="errors.name" required class="sm:col-span-2"><template #default="{ id }"><UiInput :id="id" v-model="form.name" icon="user-round" autocomplete="name" :error="errors.name" /></template></UiField>
          <UiField label="Adresse e-mail" :error="errors.email" required class="sm:col-span-2"><template #default="{ id }"><UiInput :id="id" v-model="form.email" type="email" icon="mail" autocomplete="email" :error="errors.email" /></template></UiField>
          <UiField label="Mot de passe" hint="8 caractères minimum, avec une lettre et un chiffre." :error="errors.password" required><template #default="{ id }"><UiInput :id="id" v-model="form.password" type="password" icon="lock" autocomplete="new-password" :error="errors.password" /></template></UiField>
          <UiField label="Confirmation" :error="errors.confirm" required><template #default="{ id }"><UiInput :id="id" v-model="form.confirm" type="password" icon="lock-keyhole" autocomplete="new-password" :error="errors.confirm" /></template></UiField>
        </div>
        <div>
          <UiCheckbox v-model="form.terms"><span>J’accepte les <NuxtLink class="text-primary underline underline-offset-4" to="/conditions" target="_blank">conditions générales</NuxtLink> et la <NuxtLink class="text-primary underline underline-offset-4" to="/confidentialite" target="_blank">politique de confidentialité</NuxtLink>.</span></UiCheckbox>
          <p v-if="errors.terms" class="mt-1 text-sm text-danger">{{ errors.terms }}</p>
        </div>
        <UiButton type="submit" variant="primary" size="lg" :loading="busy" icon="user-plus">Créer mon compte</UiButton>
        <p class="text-sm text-muted">Déjà inscrit ? <NuxtLink class="font-medium text-primary underline underline-offset-4" to="/connexion">Se connecter</NuxtLink></p>
      </form>
    </template>
  </div>
</template>
