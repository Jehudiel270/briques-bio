<script setup lang="ts">
import { CLIENT_NAV, isActive, visibleGroups } from '~/utils/nav'
import { NOTICES } from '#shared/utils/labels'

const route = useRoute()
const auth = useAuth()
const cart = useCart()
const menuOpen = ref(false)
const groups = computed(() => visibleGroups(CLIENT_NAV, auth.role.value))
const flat = computed(() => groups.value.flatMap((g) => g.items))
watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="min-h-dvh bg-bg text-ink">
    <a href="#contenu" class="sr-only z-[300] rounded-md bg-accent px-3 py-2 font-medium text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Aller au contenu</a>
    <header class="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur no-print">
      <div class="hazard h-0.5" aria-hidden="true" />
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <UiButton class="lg:hidden" variant="ghost" icon-only icon="menu" aria-label="Ouvrir le menu" @click="menuOpen = true" />
        <LayoutBrandMark />
        <UiBadge class="max-sm:hidden" tone="accent" size="sm" icon="flask-conical">Démo</UiBadge>
        <div class="ml-auto flex items-center gap-1">
          <UiButton to="/catalogue" variant="ghost" size="sm" icon="store" class="max-md:hidden">Vitrine</UiButton>
          <UiButton to="/devis" variant="outline" size="sm" icon="file-plus-2" class="max-md:hidden">Nouveau devis</UiButton>
          <NuxtLink to="/panier" class="relative grid size-9 place-items-center rounded-md hover:bg-surface-2" aria-label="Ma liste de produits">
            <Icon name="lucide:shopping-basket" class="size-5" aria-hidden="true" />
            <span v-if="cart.count.value" class="tnum absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-ink">{{ cart.count.value }}</span>
          </NuxtLink>
          <LayoutThemeToggle />
          <LayoutDemoRoleSwitcher />
          <LayoutNotificationBell />
          <LayoutAccountMenu />
        </div>
      </div>
      <nav class="scroll-x mx-auto hidden max-w-7xl gap-1 px-4 sm:px-6 lg:flex" aria-label="Espace client">
        <NuxtLink
          v-for="i in flat"
          :key="i.to"
          :to="i.to"
          class="relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          :class="isActive(i, route.path) && 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'"
        ><Icon :name="`lucide:${i.icon}`" class="size-4" aria-hidden="true" />{{ i.label }}</NuxtLink>
      </nav>
    </header>

    <UiSheet v-model:open="menuOpen" title="Mon espace" side="left" width="19rem">
      <nav class="flex flex-col gap-4" aria-label="Menu de l’espace client">
        <div v-for="(g, gi) in groups" :key="gi">
          <p v-if="g.title" class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ g.title }}</p>
          <NuxtLink v-for="i in g.items" :key="i.to" :to="i.to" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-surface-2" :class="isActive(i, route.path) ? 'bg-surface-2 text-ink' : 'text-ink/85'">
            <Icon :name="`lucide:${i.icon}`" class="size-4.5 text-primary" aria-hidden="true" />{{ i.label }}
          </NuxtLink>
        </div>
      </nav>
    </UiSheet>

    <main id="contenu" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><slot /></main>
    <footer class="mx-auto max-w-7xl px-4 pb-8 text-[12px] text-muted sm:px-6 no-print">{{ NOTICES.demoData }} {{ NOTICES.simulatedPayment }}</footer>
  </div>
</template>
