<script setup lang="ts">
import { ADMIN_NAV, OPS_NAV, isActive, opsZoneOf, visibleGroups } from '~/utils/nav'
import { buildBreadcrumbs, consoleSearchEntries, flattenNav } from '~/utils/shell'
import { lsGet, lsSet } from '~/utils/storage'
import { NOTICES } from '#shared/utils/labels'

/** Console dense (/ops/* et /admin) : barre latérale groupée et repliable, fil d'Ariane, recherche Ctrl+K. */
const route = useRoute()
const auth = useAuth()
const brand = useBrand()
const title = useState<string>('ecobloc:page-title', () => '')

const isAdminZone = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))
const zoneKey = computed(() => opsZoneOf(route.path))
const zone = computed(() => (zoneKey.value ? OPS_NAV[zoneKey.value] : null))
const groups = computed(() => visibleGroups(isAdminZone.value ? ADMIN_NAV : (zone.value?.groups ?? []), auth.role.value))
const zoneTitle = computed(() => (isAdminZone.value ? 'Administration' : (zone.value?.title ?? 'Console')))
const zoneIcon = computed(() => (isAdminZone.value ? 'shield-check' : (zone.value?.icon ?? 'layout-dashboard')))
const homePath = computed(() => (isAdminZone.value ? '/admin' : zone.value ? `/ops/${zoneKey.value}` : homeFor(auth.role.value)))

// zones accessibles par le rôle (bascule rapide entre modules, surtout pour l'admin)
const otherZones = computed(() => {
  const role = auth.role.value
  const list = Object.entries(OPS_NAV).filter(([, z]) => z.roles.includes(role)).map(([key, z]) => ({ label: z.title, icon: z.icon, to: `/ops/${key}` }))
  if (role === 'admin') list.unshift({ label: 'Administration', icon: 'shield-check', to: '/admin' })
  return list
})

const collapsed = ref(false)
const mobileOpen = ref(false)
onMounted(() => { collapsed.value = lsGet('ecobloc:sidebar') === '1' })
watch(collapsed, (v) => lsSet('ecobloc:sidebar', v ? '1' : '0'))
watch(() => route.fullPath, () => { mobileOpen.value = false })

const crumbs = computed(() =>
  buildBreadcrumbs({ path: route.path, items: flattenNav(groups.value), root: { label: zoneTitle.value, to: homePath.value }, pageTitle: title.value || undefined }),
)

// recherche globale
const searchOpen = ref(false)
const query = ref('')
const entries = computed(() => consoleSearchEntries(auth.role.value))
const results = computed(() => {
  const q = norm(query.value.trim())
  return (q ? entries.value.filter((e) => norm(`${e.label} ${e.section}`).includes(q)) : entries.value).slice(0, 30)
})
const router = useRouter()
function go(to: string) { searchOpen.value = false; query.value = ''; router.push(to) }
if (import.meta.client) {
  useEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchOpen.value = true }
  })
}
</script>

<template>
  <div class="flex min-h-dvh bg-bg text-ink">
    <a href="#contenu" class="sr-only z-[300] rounded-md bg-accent px-3 py-2 font-medium text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Aller au contenu</a>

    <!-- Barre latérale (≥ lg) -->
    <aside class="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex no-print" :class="collapsed ? 'w-[4.25rem]' : 'w-64'">
      <div class="flex h-14 items-center border-b border-line px-3" :class="collapsed && 'justify-center'">
        <LayoutBrandMark :icon-only="collapsed" :to="homePath" size="sm" />
      </div>
      <div v-if="!collapsed" class="px-3 pb-1 pt-3">
        <UiDropdown :items="otherZones.map((z) => ({ label: z.label, icon: z.icon, to: z.to }))" align="start" width="15rem">
          <button type="button" class="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2 text-left hover:bg-surface-2">
            <span class="grid size-7 place-items-center rounded-md bg-primary text-primary-ink"><Icon :name="`lucide:${zoneIcon}`" class="size-4" aria-hidden="true" /></span>
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ zoneTitle }}</span>
            <Icon v-if="otherZones.length > 1" name="lucide:chevrons-up-down" class="size-4 text-muted" aria-hidden="true" />
          </button>
        </UiDropdown>
      </div>
      <nav class="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Navigation de la console">
        <div v-for="(g, gi) in groups" :key="gi">
          <p v-if="g.title && !collapsed" class="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ g.title }}</p>
          <div v-else-if="g.title && gi > 0" class="mx-3 mb-2 h-px bg-line" />
          <NuxtLink
            v-for="i in g.items"
            :key="i.to"
            :to="i.to"
            :title="collapsed ? i.label : undefined"
            class="group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors"
            :class="[isActive(i, route.path) ? 'bg-primary/10 text-primary' : 'text-ink/80 hover:bg-surface-2 hover:text-ink', collapsed && 'justify-center']"
            :aria-current="isActive(i, route.path) ? 'page' : undefined"
          >
            <Icon :name="`lucide:${i.icon}`" class="size-[18px] shrink-0" aria-hidden="true" />
            <span v-if="!collapsed" class="truncate">{{ i.label }}</span>
            <span v-else class="sr-only">{{ i.label }}</span>
          </NuxtLink>
        </div>
      </nav>
      <div class="border-t border-line p-2">
        <UiButton variant="ghost" size="sm" block :icon="collapsed ? 'panel-left-open' : 'panel-left-close'" :aria-label="collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'" @click="collapsed = !collapsed">
          <span v-if="!collapsed">Replier</span>
        </UiButton>
      </div>
    </aside>

    <!-- Menu mobile -->
    <UiSheet v-model:open="mobileOpen" :title="zoneTitle" side="left" width="19rem">
      <nav class="flex flex-col gap-4" aria-label="Menu de la console">
        <div v-for="(g, gi) in groups" :key="gi">
          <p v-if="g.title" class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ g.title }}</p>
          <NuxtLink v-for="i in g.items" :key="i.to" :to="i.to" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-surface-2" :class="isActive(i, route.path) ? 'bg-primary/10 text-primary' : 'text-ink/85'">
            <Icon :name="`lucide:${i.icon}`" class="size-4.5" aria-hidden="true" />{{ i.label }}
          </NuxtLink>
        </div>
        <div v-if="otherZones.length > 1">
          <p class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Changer de module</p>
          <NuxtLink v-for="z in otherZones" :key="z.to" :to="z.to" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] hover:bg-surface-2"><Icon :name="`lucide:${z.icon}`" class="size-4.5 text-muted" aria-hidden="true" />{{ z.label }}</NuxtLink>
        </div>
      </nav>
    </UiSheet>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/92 px-3 backdrop-blur sm:px-5 no-print">
        <UiButton class="lg:hidden" variant="ghost" icon-only icon="menu" aria-label="Ouvrir le menu" @click="mobileOpen = true" />
        <nav class="min-w-0 flex-1" aria-label="Fil d’Ariane">
          <ol class="flex items-center gap-1.5 text-[13px] text-muted">
            <template v-for="(c, i) in crumbs" :key="i">
              <li v-if="i > 0" aria-hidden="true"><Icon name="lucide:chevron-right" class="size-3.5" /></li>
              <li class="min-w-0 truncate" :class="i === crumbs.length - 1 && 'font-medium text-ink'" :aria-current="i === crumbs.length - 1 ? 'page' : undefined">
                <NuxtLink v-if="c.to" :to="c.to" class="hover:text-ink">{{ c.label }}</NuxtLink>
                <span v-else>{{ c.label }}</span>
              </li>
            </template>
          </ol>
        </nav>
        <button type="button" class="hidden h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] text-muted hover:border-muted/60 md:inline-flex" @click="searchOpen = true">
          <Icon name="lucide:search" class="size-4" aria-hidden="true" />Aller à…<kbd class="ml-3 rounded border border-line px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>
        <UiButton class="md:hidden" variant="ghost" icon-only icon="search" aria-label="Rechercher une page" @click="searchOpen = true" />
        <LayoutThemeToggle />
        <LayoutDemoRoleSwitcher />
        <LayoutNotificationBell />
        <LayoutAccountMenu />
      </header>
      <main id="contenu" class="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-7"><slot /></main>
      <footer class="px-3 pb-6 text-[12px] text-muted sm:px-6 no-print">{{ brand.name }} · {{ NOTICES.demoData }}</footer>
    </div>

    <!-- Recherche globale -->
    <UiDialog v-model:open="searchOpen" title="Aller à une page" description="Tapez pour filtrer les pages de la console accessibles avec votre rôle." size="md">
      <UiSearch v-model="query" placeholder="Ex. lots, commandes, utilisateurs…" @enter="results[0] && go(results[0].to)" />
      <ul class="mt-3 flex max-h-80 flex-col overflow-y-auto" role="listbox" aria-label="Résultats">
        <li v-for="r in results" :key="r.to" role="option">
          <button type="button" class="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2" @click="go(r.to)">
            <Icon :name="`lucide:${r.icon}`" class="size-4 text-primary" aria-hidden="true" /><span class="flex-1">{{ r.label }}</span><span class="text-xs text-muted">{{ r.section }}</span>
          </button>
        </li>
        <li v-if="!results.length" class="px-2.5 py-6 text-center text-sm text-muted">Aucune page ne correspond.</li>
      </ul>
    </UiDialog>
  </div>
</template>
