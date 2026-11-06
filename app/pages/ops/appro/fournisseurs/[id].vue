<script setup lang="ts">
import { fcfa, fdate, fmtAddress, kg } from '#shared/utils/format'
import { POLYMER_LABEL, STATUS, SUPPLIER_KIND_LABEL } from '#shared/utils/labels'
const polyNames = (codes: readonly string[], sep = ', ') => codes.map((c) => POLYMER_LABEL[c] ?? c).join(sep)

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const act = useAction()
const auth = useAuth()
const s = computed(() => db.get('suppliers', id.value))
usePageTitle(s.value ? s.value.name : 'Partenaire')

const collections = computed(() => db.all('collections').filter((c) => c.supplierId === id.value).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const receipts = computed(() => db.all('receipts').filter((r) => r.supplierId === id.value).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const lots = computed(() => db.all('rawLots').filter((l) => l.supplierId === id.value))
const totalWeighed = computed(() => receipts.value.reduce((a, r) => a + r.weighedKg, 0))
const totalAccepted = computed(() => receipts.value.reduce((a, r) => a + r.lines.reduce((x, l) => x + l.acceptedKg, 0), 0))
const acceptRate = computed(() => (totalWeighed.value ? Math.round((totalAccepted.value / totalWeighed.value) * 100) : null))
const pending = computed(() => receipts.value.filter((r) => r.payout?.status === 'pending').reduce((a, r) => a + (r.payout?.amount ?? 0), 0))
const paid = computed(() => receipts.value.filter((r) => r.payout?.status === 'paid_simulated').reduce((a, r) => a + (r.payout?.amount ?? 0), 0))
const canEdit = computed(() => auth.can('receipts.manage'))
const setStatus = (status: 'approved' | 'suspended') => act(() => db.update('suppliers', id.value, { status } as any, { summary: `Partenaire ${status === 'approved' ? 'agréé' : 'suspendu'} · ${s.value?.name}` }), status === 'approved' ? 'Partenaire agréé.' : 'Partenaire suspendu.')
</script>

<template>
  <div>
    <UiEmpty v-if="!s" icon="user-x" title="Partenaire introuvable"><UiButton icon="arrow-left" to="/ops/appro/fournisseurs">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="s.name" back="/ops/appro/fournisseurs" icon="handshake" :description="`${SUPPLIER_KIND_LABEL[s.kind]} · ${fmtAddress(s.address)}`">
        <template #meta><UiStatusBadge kind="supplier" :value="s.status" /><UiDemoBadge /></template>
        <template #actions>
          <UiButton v-if="canEdit && s.status !== 'approved'" icon="badge-check" @click="setStatus('approved')">Agréer</UiButton>
          <UiButton v-if="canEdit && s.status === 'approved'" variant="outline" icon="user-x" @click="setStatus('suspended')">Suspendre</UiButton>
        </template>
      </UiPageHeader>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStat label="Collectes" :value="collections.length" icon="truck" tone="info" />
        <UiStat label="Matière reçue" :value="kg(totalWeighed)" icon="scale" tone="success" />
        <UiStat label="Taux d’acceptation" :value="acceptRate != null ? `${acceptRate} %` : '—'" icon="percent" tone="accent" />
        <UiStat label="Rémunération en attente (simulée)" :value="fcfa(pending)" icon="wallet" tone="warning" demo />
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Collectes" icon="truck" padding="none">
            <UiEmpty v-if="!collections.length" compact icon="truck" title="Aucune collecte" class="m-4" />
            <ul v-else class="divide-y divide-line px-4 sm:px-5">
              <li v-for="c in collections" :key="c.id"><NuxtLink :to="`/ops/appro/demandes/${c.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60"><div class="min-w-0 flex-1"><p class="font-medium">{{ c.ref }}</p><p class="text-[13px] text-muted">{{ fdate(c.createdAt) }} · {{ kg(c.recordedKg ?? c.estimatedTotalKg) }}</p></div><UiStatusBadge kind="collection" :value="c.status" size="sm" /></NuxtLink></li>
            </ul>
          </UiCard>
          <UiCard title="Réceptions et rémunération simulée" icon="scale" padding="none">
            <UiEmpty v-if="!receipts.length" compact icon="scale" title="Aucune réception" class="m-4" />
            <ul v-else class="divide-y divide-line px-4 sm:px-5">
              <li v-for="r in receipts" :key="r.id"><NuxtLink :to="`/ops/appro/receptions/${r.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60"><div class="min-w-0 flex-1"><p class="font-medium">{{ r.ref }}</p><p class="text-[13px] text-muted">{{ fdate(r.receivedAt) }} · {{ kg(r.weighedKg) }} pesés</p></div><span v-if="r.payout" class="tnum text-sm">{{ fcfa(r.payout.amount) }}</span><UiBadge v-if="r.payout" :tone="r.payout.status === 'paid_simulated' ? 'success' : 'warning'" size="sm">{{ r.payout.status === 'paid_simulated' ? 'Payée (simulé)' : 'À payer' }}</UiBadge></NuxtLink></li>
            </ul>
          </UiCard>
        </div>
        <aside class="flex flex-col gap-5">
          <UiCard title="Profil" icon="id-card">
            <UiKeyValue :items="[{ label: 'Contact', value: s.contactName }, { label: 'Téléphone', value: s.phone }, { label: 'E-mail', value: s.email ?? '—' }, { label: 'Rémunération', value: s.paymentModel === 'per_kg' ? 'Au kilo (simulée)' : 'Aucune' }, { label: 'Plastiques', value: polyNames(s.polymers) || '—' }, { label: 'Depuis le', value: fdate(s.createdAt) }]" />
            <p v-if="s.notes" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ s.notes }}</p>
          </UiCard>
          <UiCard title="Lots de matière fournis" icon="boxes">
            <UiEmpty v-if="!lots.length" compact icon="boxes" title="Aucun lot" />
            <ul v-else class="space-y-2 text-sm"><li v-for="l in lots.slice(0, 8)" :key="l.id" class="flex items-center justify-between gap-2"><NuxtLink :to="`/ops/appro/lots-matiere/${l.id}`" class="font-medium hover:underline">{{ l.ref }}</NuxtLink><span class="text-muted">{{ POLYMER_LABEL[l.polymer] }} · {{ kg(l.kgInitial) }}</span><UiStatusBadge kind="rawLot" :value="l.status" size="sm" /></li></ul>
          </UiCard>
          <UiCard v-if="paid" title="Déjà versé (simulé)" icon="wallet"><p class="tnum font-display text-2xl font-semibold">{{ fcfa(paid) }}</p><p class="mt-1 text-[13px] text-muted">Aucun versement réel : démonstration uniquement.</p></UiCard>
        </aside>
      </div>
    </template>
  </div>
</template>
