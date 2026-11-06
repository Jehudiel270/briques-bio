<script setup lang="ts">
import { fcfa, fdate, kg } from '#shared/utils/format'

usePageTitle('Rémunérations')
const db = useDb()
const settings = useSettings()
const enabled = computed(() => settings.value.features.collectorPayouts)
const rows = computed(() => db.all('receipts').filter((r) => r.payout).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const pending = computed(() => rows.value.filter((r) => r.payout!.status === 'pending').reduce((a, r) => a + r.payout!.amount, 0))
const paid = computed(() => rows.value.filter((r) => r.payout!.status === 'paid_simulated').reduce((a, r) => a + r.payout!.amount, 0))
const accepted = (r: { lines: { acceptedKg: number }[] }) => r.lines.reduce((a, l) => a + l.acceptedKg, 0)
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Rémunérations" description="Calculées sur les quantités acceptées à la pesée. Les versements sont simulés." icon="wallet" />
    <UiAlert v-if="!enabled" tone="neutral" icon="toggle-left" title="Rémunération désactivée">Le modèle d’achat au kilo n’est pas activé pour le moment.</UiAlert>
    <template v-else>
      <div class="grid grid-cols-2 gap-3">
        <UiStat label="À recevoir (simulé)" :value="fcfa(pending)" icon="clock" tone="warning" demo />
        <UiStat label="Versé (simulé)" :value="fcfa(paid)" icon="circle-check" tone="success" demo />
      </div>
      <UiEmpty v-if="!rows.length" icon="wallet" title="Aucune rémunération" hint="Elle apparaît après la pesée et l’acceptation d’un arrivage." />
      <ul v-else class="flex flex-col gap-3">
        <li v-for="r in rows" :key="r.id" class="card p-4">
          <div class="flex items-start justify-between gap-3"><div><p class="font-display font-semibold">{{ r.ref }}</p><p class="text-[13px] text-muted">{{ fdate(r.receivedAt) }} · {{ kg(accepted(r)) }} acceptés</p></div><div class="text-right"><p class="tnum font-display text-lg font-semibold">{{ fcfa(r.payout!.amount) }}</p><UiBadge :tone="r.payout!.status === 'paid_simulated' ? 'success' : 'warning'" size="sm">{{ r.payout!.status === 'paid_simulated' ? 'Versée (simulé)' : 'En attente' }}</UiBadge></div></div>
          <p v-if="r.payout!.ref" class="mt-2 text-[12px] text-muted">Référence simulée {{ r.payout!.ref }}</p>
        </li>
      </ul>
    </template>
    <SiteNotice kind="simulated" dense />
  </div>
</template>
