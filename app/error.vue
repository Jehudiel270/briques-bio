<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const auth = useAuth()
usePageTitle('Page introuvable')
const code = computed(() => props.error.statusCode ?? 500)
const copy = computed(() => {
  if (code.value === 404) return { icon: 'map-pin-off', title: 'Cette page n’existe pas', text: 'L’adresse est peut-être incorrecte, ou la page a été déplacée.' }
  if (code.value === 403) return { icon: 'shield-x', title: 'Accès non autorisé', text: 'Votre rôle n’a pas accès à cette page.' }
  return { icon: 'triangle-alert', title: 'Une erreur est survenue', text: 'Rechargez la page ; si le problème persiste, revenez à l’accueil.' }
})
const home = computed(() => (auth.isLoggedIn.value ? homeFor(auth.role.value) : '/'))
const back = () => clearError({ redirect: home.value })
</script>

<template>
  <NuxtLayout name="public">
    <section class="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-start justify-center gap-5 px-4 py-20 sm:px-6">
      <div class="paver-bg flex size-16 items-center justify-center rounded-xl border border-line">
        <Icon :name="`lucide:${copy.icon}`" class="size-7 text-primary" aria-hidden="true" />
      </div>
      <p class="font-display text-sm text-muted tnum">Erreur {{ code }}</p>
      <h1 class="text-4xl font-semibold">{{ copy.title }}</h1>
      <p class="text-muted">{{ copy.text }}</p>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="primary" icon="house" @click="back">{{ auth.isLoggedIn.value ? 'Retour à mon espace' : 'Retour à l’accueil' }}</UiButton>
        <UiButton variant="outline" icon="layout-grid" to="/catalogue" @click="clearError()">Voir le catalogue</UiButton>
      </div>
    </section>
  </NuxtLayout>
</template>
