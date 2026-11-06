<script setup lang="ts">
import { fcfa, fdate, kg } from '#shared/utils/format'

usePageTitle('Accueil collecteur')
const db = useDb()
const auth = useAuth()
const settings = useSettings()

const supplier = computed(() => db.peek('suppliers', auth.user.value?.supplierId))
const cols = computed(() => db.all('collections'))
const active = computed(() => cols.value.filter((c) => ['submitted', 'under_review', 'planned', 'en_route', 'collected', 'weighed'].includes(c.status)))
const upcoming = computed(() => cols.value.filter((c) => c.status === 'planned' && c.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)).slice(0, 3))
const receipts = computed(() => db.all('receipts'))
const acceptedKg = computed(() => receipts.value.reduce((a, r) => a + r.lines.reduce((s, l) => s + l.acceptedKg, 0), 0))
const pendingPay = computed(() => receipts.value.filter((r) => r.payout?.status === 'pending').reduce((a, r) => a + (r.payout?.amount ?? 0), 0))
const payoutsOn = computed(() => settings.value.features.collectorPayouts && supplier.value?.paymentModel === 'per_kg')
const unread = computed(() => db.all('notifications').filter((n) => n.userId === auth.user.value?.id && !n.read).length)
</script>

<template>
  <div class="flex flex-col gap-5">
    <UiPageHeader :title="`Bonjour ${auth.user.value?.name.split(' ')[0] ?? ''}`" :description="supplier?.name" icon="recycle" />

    <UiAlert v-if="supplier && supplier.status !== 'approved'" tone="warning" icon="hourglass" :title="supplier.status === 'pending' ? 'Profil en attente de validation' : 'Profil suspendu'">
      {{ supplier.status === 'pending' ? 'Vous pourrez déclarer des collectes dès que l’équipe approvisionnement aura validé votre profil.' : 'Contactez l’équipe approvisionnement pour en savoir plus.' }}
    </UiAlert>

    <UiButton size="lg" block icon="circle-plus" to="/collecte/demandes/nouvelle" :disabled="supplier?.status !== 'approved'">Nouvelle demande d’enlèvement</UiButton>

    <div class="grid grid-cols-2 gap-3">
      <UiStat label="En cours" :value="active.length" icon="loader" tone="info" to="/collecte/demandes" />
      <UiStat label="Acceptés (total)" :value="kg(acceptedKg)" icon="scale" tone="success" to="/collecte/justificatifs" demo />
      <UiStat v-if="payoutsOn" label="À recevoir (simulé)" :value="fcfa(pendingPay)" icon="wallet" tone="warning" to="/collecte/paiements" demo class="col-span-2" />
    </div>

    <UiCard title="Prochains enlèvements" icon="calendar-check">
      <UiEmpty v-if="!upcoming.length" compact icon="calendar" title="Aucun enlèvement planifié" hint="Déposez une demande : l’équipe vous propose un créneau." />
      <ul v-else class="divide-y divide-line">
        <li v-for="c in upcoming" :key="c.id">
          <NuxtLink :to="`/collecte/demandes/${c.id}`" class="flex min-h-14 items-center gap-3 py-2.5">
            <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/25"><Icon name="lucide:truck" class="size-5" aria-hidden="true" /></span>
            <div class="min-w-0 flex-1"><p class="font-medium">{{ c.ref }} · {{ kg(c.estimatedTotalKg) }}</p><p class="truncate text-[13px] text-muted">{{ fdate(c.scheduledAt) }} · {{ c.pickupPoint.label }}</p></div>
            <Icon name="lucide:chevron-right" class="size-4 text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </UiCard>

    <div class="grid grid-cols-2 gap-3">
      <UiButton variant="outline" block icon="history" to="/collecte/historique">Historique</UiButton>
      <UiButton variant="outline" block icon="message-circle-warning" to="/collecte/reclamations">Réclamations</UiButton>
    </div>
    <p v-if="unread" class="text-center text-[13px] text-muted">{{ unread }} notification(s) non lue(s) dans la cloche en haut de l’écran.</p>
  </div>
</template>
