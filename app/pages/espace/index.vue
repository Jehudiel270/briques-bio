<script setup lang="ts">
import { fcfa, fdate, relTime } from '#shared/utils/format'

usePageTitle('Tableau de bord')
const db = useDb()
const auth = useAuth()
const L = useLookups()

const first = computed(() => auth.user.value?.name.split(' ')[0] ?? '')
const quotes = computed(() => db.all('quotes'))
const orders = computed(() => db.all('orders'))
const deliveries = computed(() => db.all('deliveries'))
const invoices = computed(() => db.all('invoices'))

const toPay = computed(() => orders.value.filter((o) => o.status === 'pending_payment' || o.paymentStatus === 'deposit_paid'))
const openQuotes = computed(() => quotes.value.filter((q) => ['requested', 'in_review', 'sent'].includes(q.status)))
const inProgress = computed(() => orders.value.filter((o) => ['confirmed', 'in_preparation', 'ready_to_ship', 'shipped'].includes(o.status)))
const balanceDue = computed(() => toPay.value.reduce((a, o) => a + Math.max(0, o.total - o.amountPaid), 0))
const recentOrders = computed(() => [...orders.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5))
const nextDeliveries = computed(() => deliveries.value.filter((d) => ['planned', 'in_transit'].includes(d.status)).slice(0, 4))
const sentQuotes = computed(() => quotes.value.filter((q) => q.status === 'sent'))
const notifications = computed(() => db.all('notifications').filter((n) => n.userId === auth.user.value?.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4))
</script>

<template>
  <div>
    <UiPageHeader :title="`Bonjour ${first}`" description="Vos devis, commandes et livraisons en un coup d’œil." icon="layout-dashboard">
      <template #actions>
        <UiButton icon="file-plus-2" to="/devis">Demander un devis</UiButton>
        <UiButton variant="outline" icon="layout-grid" to="/espace/catalogue">Parcourir le catalogue</UiButton>
      </template>
    </UiPageHeader>

    <UiAlert v-if="sentQuotes.length" tone="accent" icon="send" :title="`${sentQuotes.length} devis à examiner`" class="mb-5">
      <NuxtLink v-for="q in sentQuotes" :key="q.id" :to="`/espace/devis/${q.id}`" class="mr-3 font-medium underline underline-offset-2">{{ q.ref }}</NuxtLink>
    </UiAlert>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiStat label="Devis en cours" :value="openQuotes.length" icon="file-text" tone="info" to="/espace/devis" />
      <UiStat label="Commandes en cours" :value="inProgress.length" icon="package" tone="accent" to="/espace/commandes" />
      <UiStat label="À régler (simulé)" :value="fcfa(balanceDue)" icon="wallet" tone="warning" :hint="`${toPay.length} commande(s)`" to="/espace/paiements" demo />
      <UiStat label="Livraisons planifiées" :value="nextDeliveries.length" icon="truck" tone="success" to="/espace/livraisons" />
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <UiCard title="Dernières commandes" icon="package">
        <template #actions><UiButton size="sm" variant="ghost" iconRight="arrow-right" to="/espace/commandes">Tout voir</UiButton></template>
        <UiEmpty v-if="!recentOrders.length" compact icon="package-open" title="Aucune commande pour l’instant" hint="Demandez un devis ou commandez un produit autorisé à la vente.">
          <UiButton icon="layout-grid" to="/catalogue">Voir le catalogue</UiButton>
        </UiEmpty>
        <ul v-else class="divide-y divide-line">
          <li v-for="o in recentOrders" :key="o.id">
            <NuxtLink :to="`/espace/commandes/${o.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:px-2 sm:rounded-md">
              <span class="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-muted"><Icon name="lucide:package" class="size-4" aria-hidden="true" /></span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ o.ref }} <span class="font-normal text-muted">· {{ o.lines.length }} ligne(s)</span></p>
                <p class="text-[13px] text-muted">{{ fdate(o.createdAt) }}</p>
              </div>
              <div class="flex flex-col items-end gap-1"><span class="tnum font-medium">{{ fcfa(o.total) }}</span><UiStatusBadge kind="order" :value="o.status" size="sm" /></div>
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <div class="flex flex-col gap-5">
        <UiCard title="Prochaines livraisons" icon="truck">
          <UiEmpty v-if="!nextDeliveries.length" compact icon="truck" title="Aucune livraison planifiée" />
          <ul v-else class="space-y-3">
            <li v-for="d in nextDeliveries" :key="d.id" class="flex items-start justify-between gap-3">
              <div><p class="font-medium">{{ d.ref }}</p><p class="text-[13px] text-muted">{{ L.orderRef(d.orderId) }} · {{ d.plannedDate ? fdate(d.plannedDate) : 'date à confirmer' }}</p></div>
              <UiStatusBadge kind="delivery" :value="d.status" size="sm" />
            </li>
          </ul>
        </UiCard>
        <UiCard title="Notifications" icon="bell">
          <UiEmpty v-if="!notifications.length" compact icon="bell-off" title="Rien de nouveau" />
          <ul v-else class="space-y-3">
            <li v-for="n in notifications" :key="n.id">
              <NuxtLink :to="n.href ?? '/espace'" class="block hover:underline"><p class="text-sm font-medium">{{ n.title }}</p><p class="text-[13px] text-muted">{{ n.body }} · {{ relTime(n.at) }}</p></NuxtLink>
            </li>
          </ul>
        </UiCard>
      </div>
    </div>

    <p v-if="invoices.length" class="mt-6 text-[13px] text-muted">{{ invoices.length }} facture(s) fictive(s) disponibles dans l’espace « Factures ».</p>
  </div>
</template>
