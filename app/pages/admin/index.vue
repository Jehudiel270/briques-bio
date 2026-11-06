<script setup lang="ts">
import { fcfa, fdatetime, kg, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'

usePageTitle('Vue globale')
const db = useDb()
const { rawByPolymer, finishedByProduct } = useStockView()

const orders = computed(() => db.all('orders').filter((o) => o.status !== 'cancelled'))
const revenue = computed(() => orders.value.reduce((a, o) => a + o.total, 0))
const rawFree = computed(() => rawByPolymer.value.reduce((a, r) => a + r.free, 0))
const sellable = computed(() => finishedByProduct.value.reduce((a, r) => a + r.sellable, 0))
const openQuotes = computed(() => db.all('quotes').filter((q) => ['requested', 'in_review'].includes(q.status)).length)
const toShip = computed(() => db.all('orders').filter((o) => ['in_preparation', 'ready_to_ship'].includes(o.status)).length)
const qcQueue = computed(() => db.all('qcInspections').filter((q) => q.status !== 'completed').length)
const openClaims = computed(() => db.all('claims').filter((c) => ['open', 'in_review'].includes(c.status)).length)
const pendingUsers = computed(() => db.all('users').filter((u) => u.pendingApproval).length)
const toReview = computed(() => db.all('collections').filter((c) => ['submitted', 'under_review'].includes(c.status)).length)

const alerts = computed(() => [
  ...rawByPolymer.value.filter((r) => r.low).map((r) => ({ tone: 'warning' as const, icon: 'trending-down', text: `Stock bas : ${r.label}`, to: '/admin/stocks' })),
  ...finishedByProduct.value.filter((r) => r.low).slice(0, 3).map((r) => ({ tone: 'warning' as const, icon: 'package-minus', text: `Produit fini sous le seuil : ${r.product.name}`, to: '/admin/stocks' })),
  ...(pendingUsers.value ? [{ tone: 'info' as const, icon: 'user-check', text: `${pendingUsers.value} compte(s) à valider`, to: '/admin/utilisateurs' }] : []),
  ...(openClaims.value ? [{ tone: 'danger' as const, icon: 'life-buoy', text: `${openClaims.value} réclamation(s) ouverte(s)`, to: '/admin/reclamations' }] : []),
  ...(db.all('orders').some((o) => o.awaitingStock) ? [{ tone: 'warning' as const, icon: 'hourglass', text: 'Commandes en attente de lots libérés', to: '/admin/commandes' }] : []),
])
const toneCls = { warning: 'text-warning', info: 'text-info', danger: 'text-danger' } as const

const chain = computed(() => [
  { label: 'Collecte', icon: 'truck', value: `${toReview.value} à examiner`, to: '/admin/collectes' },
  { label: 'Matière', icon: 'recycle', value: kg(rawFree.value), to: '/admin/stocks' },
  { label: 'Production', icon: 'factory', value: `${db.all('workOrders').filter((w) => w.status === 'in_progress').length} en cours`, to: '/admin/production' },
  { label: 'Qualité', icon: 'microscope', value: `${qcQueue.value} contrôle(s)`, to: '/admin/qualite' },
  { label: 'Vente', icon: 'shopping-bag', value: `${openQuotes.value} devis`, to: '/admin/devis' },
  { label: 'Livraison', icon: 'package-check', value: `${toShip.value} à expédier`, to: '/admin/livraisons' },
])
const orderStatus = computed(() => Object.entries(STATUS.order).map(([k, m]) => ({ label: m.label, value: db.all('orders').filter((o) => o.status === k).length })).filter((d) => d.value))
const recent = computed(() => [...db.all('auditLog')].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8))
const shortcuts = [
  { label: 'Produits', icon: 'package', to: '/admin/produits' }, { label: 'Utilisateurs', icon: 'users', to: '/admin/utilisateurs' }, { label: 'Prix et grilles', icon: 'badge-percent', to: '/admin/tarifs' },
  { label: 'Apparence', icon: 'palette', to: '/admin/apparence' }, { label: 'Médias', icon: 'image', to: '/admin/medias' }, { label: 'Paramètres', icon: 'settings', to: '/admin/parametres' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Vue globale" description="Pilotage de la chaîne complète, de la collecte à la livraison." icon="layout-dashboard" />
    <SiteNotice kind="demo" class="mb-5" dense />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiStat label="Commandes enregistrées" :value="fcfa(revenue)" icon="shopping-bag" tone="info" :hint="`${orders.length} commande(s)`" to="/admin/commandes" demo />
      <UiStat label="Matière libre" :value="kg(rawFree)" icon="recycle" tone="success" to="/admin/stocks" />
      <UiStat label="Produits finis vendables" :value="num(sellable)" icon="package-check" tone="accent" to="/admin/lots" />
      <UiStat label="Réclamations ouvertes" :value="openClaims" icon="life-buoy" :tone="openClaims ? 'danger' : 'neutral'" to="/admin/reclamations" />
    </div>

    <UiCard class="mt-6" title="La chaîne en un coup d’œil" icon="workflow">
      <ol class="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <li v-for="(s, i) in chain" :key="s.label">
          <NuxtLink :to="s.to" class="group flex h-full flex-col gap-1 rounded-lg border border-line p-3 transition hover:border-primary/50 hover:bg-surface-2/60">
            <span class="flex items-center gap-2 text-[13px] text-muted"><span class="flex size-6 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink">{{ i + 1 }}</span>{{ s.label }}</span>
            <Icon :name="`lucide:${s.icon}`" class="size-5 text-primary" aria-hidden="true" />
            <span class="text-sm font-medium">{{ s.value }}</span>
          </NuxtLink>
        </li>
      </ol>
    </UiCard>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div class="flex flex-col gap-5">
        <UiCard title="Alertes" icon="bell-ring">
          <UiEmpty v-if="!alerts.length" compact icon="shield-check" title="Rien à signaler" hint="Stocks, comptes et réclamations sont sous contrôle." />
          <ul v-else class="divide-y divide-line">
            <li v-for="a in alerts" :key="a.text"><NuxtLink :to="a.to" class="flex items-center gap-3 py-3 text-sm hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2"><Icon :name="`lucide:${a.icon}`" class="size-5 shrink-0" :class="toneCls[a.tone]" aria-hidden="true" /><span class="flex-1">{{ a.text }}</span><Icon name="lucide:chevron-right" class="size-4 text-muted" aria-hidden="true" /></NuxtLink></li>
          </ul>
        </UiCard>
        <UiCard title="Activité récente" icon="scroll-text">
          <template #actions><UiButton size="sm" variant="ghost" iconRight="arrow-right" to="/admin/audit">Journal complet</UiButton></template>
          <UiEmpty v-if="!recent.length" compact icon="scroll-text" title="Aucune activité" />
          <UiTimeline v-else :items="recent.map((e) => ({ at: e.at, title: e.summary, by: e.userName }))" />
        </UiCard>
      </div>
      <div class="flex flex-col gap-5">
        <UiCard title="Commandes par statut" icon="chart-pie"><ChartDonut v-if="orderStatus.length" :data="orderStatus" :center="String(orders.length)" center-label="commandes" title="Commandes par statut" /><UiEmpty v-else compact icon="chart-pie" title="Pas de commandes" /></UiCard>
        <UiCard title="Raccourcis" icon="zap">
          <ul class="grid grid-cols-2 gap-2"><li v-for="s in shortcuts" :key="s.to"><NuxtLink :to="s.to" class="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-medium hover:bg-surface-2"><Icon :name="`lucide:${s.icon}`" class="size-4 text-primary" aria-hidden="true" />{{ s.label }}</NuxtLink></li></ul>
          <p class="mt-3 text-[12px] text-muted">Dernière mise à jour : {{ fdatetime(new Date()) }}</p>
        </UiCard>
      </div>
    </div>
  </div>
</template>
