<script setup lang="ts">
import { COLLECTOR_NAV, DRIVER_NAV, isActive, visibleGroups } from '~/utils/nav'
import { splitTabs } from '~/utils/shell'

/** Coque mobile d'abord (collecteurs et chauffeurs) : barre d'onglets basse, cibles ≥ 44 px. */
const route = useRoute()
const auth = useAuth()
const online = useOnline()
const moreOpen = ref(false)
const nav = computed(() => (route.path.startsWith('/terrain') ? DRIVER_NAV : COLLECTOR_NAV))
const items = computed(() => visibleGroups(nav.value, auth.role.value).flatMap((g) => g.items))
const split = computed(() => splitTabs(items.value, 5))
const moreActive = computed(() => split.value.more.some((i) => isActive(i, route.path)))
const title = computed(() => (route.path.startsWith('/terrain') ? 'Terrain' : 'Collecte'))
watch(() => route.fullPath, () => { moreOpen.value = false })
</script>

<template>
  <div class="touch mx-auto flex min-h-dvh max-w-2xl flex-col bg-bg text-ink">
    <header class="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur no-print">
      <div class="hazard h-0.5" aria-hidden="true" />
      <div class="flex h-14 items-center gap-2 px-3">
        <LayoutBrandMark icon-only :to="homeFor(auth.role.value)" />
        <div class="min-w-0 leading-tight">
          <p class="truncate font-display text-[15px] font-semibold">{{ title }}</p>
          <p class="truncate text-xs text-muted">{{ auth.user.value?.name ?? 'Non connecté' }}</p>
        </div>
        <span class="ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium" :class="online ? 'border-success/30 bg-success/10 text-success' : 'border-warning/40 bg-warning/12 text-warning'" role="status">
          <Icon :name="online ? 'lucide:wifi' : 'lucide:wifi-off'" class="size-3.5" aria-hidden="true" />{{ online ? 'En ligne' : 'Hors ligne' }}
        </span>
        <LayoutThemeToggle />
        <LayoutNotificationBell />
      </div>
    </header>

    <main id="contenu" class="flex-1 px-4 pb-28 pt-5"><slot /></main>

    <nav class="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl border-t border-line bg-surface/97 pb-[env(safe-area-inset-bottom)] backdrop-blur no-print" aria-label="Navigation">
      <NuxtLink
        v-for="i in split.tabs"
        :key="i.to"
        :to="i.to"
        class="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors"
        :class="isActive(i, route.path) ? 'text-primary' : 'text-muted active:text-ink'"
        :aria-current="isActive(i, route.path) ? 'page' : undefined"
      >
        <Icon :name="`lucide:${i.icon}`" class="size-6" aria-hidden="true" />
        <span class="max-w-full truncate">{{ i.label }}</span>
      </NuxtLink>
      <button v-if="split.more.length" type="button" class="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium" :class="moreActive ? 'text-primary' : 'text-muted'" @click="moreOpen = true">
        <Icon name="lucide:ellipsis" class="size-6" aria-hidden="true" /><span>Plus</span>
      </button>
    </nav>

    <UiSheet v-model:open="moreOpen" title="Plus" side="bottom">
      <nav class="flex flex-col gap-1" aria-label="Autres pages">
        <NuxtLink v-for="i in split.more" :key="i.to" :to="i.to" class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium hover:bg-surface-2" :class="isActive(i, route.path) && 'bg-surface-2'">
          <Icon :name="`lucide:${i.icon}`" class="size-5 text-primary" aria-hidden="true" />{{ i.label }}
        </NuxtLink>
        <div class="mt-2 border-t border-line pt-3"><LayoutDemoRoleSwitcher /></div>
        <div class="mt-1 flex justify-end"><LayoutAccountMenu /></div>
      </nav>
    </UiSheet>
  </div>
</template>
