<script setup lang="ts">
import { PUBLIC_FOOTER, PUBLIC_MORE, PUBLIC_NAV, isActive } from '~/utils/nav'
import { NOTICES } from '#shared/utils/labels'

const route = useRoute()
const auth = useAuth()
const cart = useCart()
const brand = useBrand()
const settings = useSettings()
const menuOpen = ref(false)
const scrolled = ref(false)

if (import.meta.client) {
  useEventListener('scroll', () => { scrolled.value = window.scrollY > 8 }, { passive: true })
}
watch(() => route.fullPath, () => { menuOpen.value = false })

const moreItems = computed(() => PUBLIC_MORE.map((i) => ({ label: i.label, icon: i.icon, to: i.to })))
const year = new Date().getFullYear()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-bg text-ink">
    <a href="#contenu" class="sr-only z-[300] rounded-md bg-accent px-3 py-2 font-medium text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Aller au contenu</a>

    <!-- Bandeau de démonstration -->
    <div class="relative z-40 border-b border-line bg-surface-2/70 text-[12px] text-muted no-print">
      <div class="hazard h-1" aria-hidden="true" />
      <p class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
        <Icon name="lucide:flask-conical" class="size-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span class="truncate"><strong class="font-semibold text-ink">Maquette de démonstration.</strong> {{ settings.demoBanner || NOTICES.demoData }}</span>
      </p>
    </div>

    <!-- En-tête -->
    <header class="sticky top-0 z-30 border-b transition-[background-color,border-color] duration-200 no-print" :class="scrolled ? 'border-line bg-bg/92 backdrop-blur' : 'border-transparent bg-bg'">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <UiButton class="lg:hidden" variant="ghost" icon-only icon="menu" aria-label="Ouvrir le menu" @click="menuOpen = true" />
        <LayoutBrandMark />
        <nav class="ml-6 hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
          <NuxtLink
            v-for="i in PUBLIC_NAV"
            :key="i.to"
            :to="i.to"
            class="relative rounded-md px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-surface-2 hover:text-ink"
            :class="isActive(i, route.path) && 'text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'"
          >{{ i.label }}</NuxtLink>
          <UiDropdown :items="moreItems" align="start">
            <button type="button" class="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-surface-2 hover:text-ink">
              Plus<Icon name="lucide:chevron-down" class="size-3.5" aria-hidden="true" />
            </button>
          </UiDropdown>
        </nav>
        <div class="ml-auto flex items-center gap-1">
          <UiButton to="/devis" variant="primary" size="sm" icon="file-text" class="mr-1 max-md:hidden">Demander un devis</UiButton>
          <NuxtLink to="/panier" class="relative grid size-9 place-items-center rounded-md hover:bg-surface-2" :aria-label="`Ma liste de produits${cart.count.value ? ` : ${cart.count.value} ligne${cart.count.value > 1 ? 's' : ''}` : ''}`">
            <Icon name="lucide:shopping-basket" class="size-5" aria-hidden="true" />
            <span v-if="cart.count.value" class="tnum absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-ink">{{ cart.count.value }}</span>
          </NuxtLink>
          <LayoutThemeToggle />
          <LayoutDemoRoleSwitcher class="max-sm:hidden" />
          <LayoutNotificationBell v-if="auth.isLoggedIn.value" />
          <LayoutAccountMenu />
        </div>
      </div>
    </header>

    <!-- Menu mobile -->
    <UiSheet v-model:open="menuOpen" :title="brand.name" side="left" width="20rem">
      <nav class="flex flex-col gap-0.5" aria-label="Menu mobile">
        <NuxtLink v-for="i in [...PUBLIC_NAV, ...PUBLIC_MORE]" :key="i.to" :to="i.to" class="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors hover:bg-surface-2" :class="isActive(i, route.path) ? 'bg-surface-2 text-ink' : 'text-ink/85'">
          <Icon :name="`lucide:${i.icon}`" class="size-4.5 text-primary" aria-hidden="true" />{{ i.label }}
        </NuxtLink>
      </nav>
      <div class="mt-5 grid gap-2 border-t border-line pt-5">
        <UiButton to="/devis" variant="primary" icon="file-text" block>Demander un devis</UiButton>
        <LayoutDemoRoleSwitcher />
      </div>
    </UiSheet>

    <main id="contenu" class="flex-1"><slot /></main>

    <!-- Pied de page -->
    <footer class="mt-24 border-t border-line bg-surface no-print">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div class="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div class="max-w-sm">
            <LayoutBrandMark size="lg" />
            <p class="mt-4 text-sm text-muted">{{ brand.tagline }}</p>
            <address class="mt-5 space-y-1.5 text-sm not-italic text-muted">
              <p class="flex items-start gap-2"><Icon name="lucide:map-pin" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />{{ settings.company.address }}, {{ settings.company.city }} ({{ settings.company.country }})</p>
              <p class="flex items-center gap-2"><Icon name="lucide:mail" class="size-4 shrink-0" aria-hidden="true" />{{ settings.company.email }}</p>
              <p class="flex items-center gap-2"><Icon name="lucide:phone" class="size-4 shrink-0" aria-hidden="true" /><span class="tnum">{{ settings.company.phone }}</span></p>
            </address>
          </div>
          <nav class="grid grid-cols-2 gap-8 sm:grid-cols-4" aria-label="Pied de page">
            <div v-for="g in PUBLIC_FOOTER" :key="g.title">
              <h2 class="font-sans text-[13px] font-semibold text-ink" style="font-stretch: 100%">{{ g.title }}</h2>
              <ul class="mt-3 space-y-2">
                <li v-for="i in g.items" :key="i.to"><NuxtLink :to="i.to" class="text-sm text-muted transition-colors hover:text-ink">{{ i.label }}</NuxtLink></li>
              </ul>
            </div>
          </nav>
        </div>
        <div class="mt-12 rounded-lg border border-line bg-surface-2/50 p-4 text-[13px] text-muted">
          <p class="flex items-start gap-2.5"><Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /><span>{{ NOTICES.demoData }} {{ NOTICES.technicalUnconfirmed }} {{ NOTICES.notStructural }}</span></p>
        </div>
        <div class="mt-6 flex flex-col justify-between gap-2 text-[13px] text-muted sm:flex-row">
          <p>© {{ year }} {{ brand.name }} — prototype de démonstration</p>
          <p class="flex gap-4"><NuxtLink to="/confidentialite" class="hover:text-ink">Confidentialité</NuxtLink><NuxtLink to="/conditions" class="hover:text-ink">Conditions</NuxtLink></p>
        </div>
      </div>
    </footer>
  </div>
</template>
