<script setup lang="ts">
import { fcfa, fdate, fdatetime, kg } from '#shared/utils/format'
import { POLYMER_LABEL, STATUS } from '#shared/utils/labels'

const route = useRoute()
const id = computed(() => String(route.params.id))
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const L = useLookups()

const r = computed(() => db.get('receipts', id.value))
usePageTitle(r.value ? `Réception ${r.value.ref}` : 'Réception')
const lots = computed(() => db.all('rawLots').filter((l) => l.receiptId === id.value))
const movements = computed(() => db.all('stockMovements').filter((m) => m.refType === 'receipt' && m.refId === id.value))
const collection = computed(() => (r.value?.collectionId ? db.peek('collections', r.value.collectionId) : undefined))
const accepted = computed(() => r.value?.lines.reduce((a, l) => a + l.acceptedKg, 0) ?? 0)
const rejected = computed(() => r.value?.lines.reduce((a, l) => a + l.rejectedKg, 0) ?? 0)
const quarantine = computed(() => r.value?.lines.reduce((a, l) => a + l.quarantineKg, 0) ?? 0)
const canPay = computed(() => !!r.value?.payout && r.value.payout.status === 'pending' && auth.can('receipts.manage'))
const pay = () => act(() => svc.receipts.pay(id.value), 'Rémunération simulée enregistrée.')
</script>

<template>
  <div>
    <UiEmpty v-if="!r" icon="scale" title="Réception introuvable"><UiButton icon="arrow-left" to="/ops/appro/receptions">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="`Réception ${r.ref}`" back="/ops/appro/receptions" icon="scale" :description="`${L.supplierName(r.supplierId)} · ${fdatetime(r.receivedAt)} · reçue par ${L.userName(r.receivedBy)}`">
        <template #meta><UiStatusBadge kind="receipt" :value="r.status" /><UiDemoBadge /></template>
        <template #actions><UiButton v-if="canPay" icon="wallet" @click="pay">Verser la rémunération (simulée)</UiButton></template>
      </UiPageHeader>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStat label="Pesé" :value="kg(r.weighedKg)" icon="scale" tone="info" :hint="`${kg(r.declaredKg)} annoncés`" />
        <UiStat label="Accepté" :value="kg(accepted)" icon="circle-check" tone="success" />
        <UiStat label="Quarantaine" :value="kg(quarantine)" icon="shield-alert" :tone="quarantine ? 'warning' : 'neutral'" />
        <UiStat label="Rejeté" :value="kg(rejected)" icon="circle-x" :tone="rejected ? 'danger' : 'neutral'" />
      </div>

      <div class="mt-6 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div class="flex flex-col gap-5">
          <UiCard title="Décision par plastique" icon="atom" padding="none">
            <div class="scroll-x">
              <table class="w-full min-w-[34rem] text-sm">
                <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Plastique</th><th class="px-3 py-2.5 text-right font-medium">Pesé</th><th class="px-3 py-2.5 text-right font-medium">Accepté</th><th class="px-3 py-2.5 text-right font-medium">Quarantaine</th><th class="px-3 py-2.5 text-right font-medium">Rejeté</th><th class="px-4 py-2.5 font-medium">Décision</th></tr></thead>
                <tbody>
                  <tr v-for="l in r.lines" :key="l.polymer" class="border-b border-line/70 align-top last:border-0">
                    <td class="px-4 py-3 font-medium">{{ POLYMER_LABEL[l.polymer] }}<p v-if="l.reason" class="mt-0.5 text-[13px] font-normal text-muted">{{ l.reason }}</p></td>
                    <td class="tnum px-3 py-3 text-right">{{ kg(l.weighedKg) }}</td><td class="tnum px-3 py-3 text-right">{{ kg(l.acceptedKg) }}</td><td class="tnum px-3 py-3 text-right">{{ kg(l.quarantineKg) }}</td><td class="tnum px-3 py-3 text-right">{{ kg(l.rejectedKg) }}</td>
                    <td class="px-4 py-3"><UiStatusBadge kind="receiptDecision" :value="l.decision" size="sm" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard title="Lots de matière créés" icon="boxes">
            <UiEmpty v-if="!lots.length" compact icon="boxes" title="Aucun lot créé" hint="Seules les quantités acceptées ou en quarantaine créent un lot." />
            <ul v-else class="divide-y divide-line">
              <li v-for="l in lots" :key="l.id"><NuxtLink :to="`/ops/appro/lots-matiere/${l.id}`" class="flex items-center gap-3 py-3 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-md sm:px-2"><div class="min-w-0 flex-1"><p class="font-medium">{{ l.ref }}</p><p class="text-[13px] text-muted">{{ POLYMER_LABEL[l.polymer] }} · {{ kg(l.kgInitial) }} · {{ L.locationName(l.locationId) }}</p></div><UiStatusBadge kind="rawLot" :value="l.status" size="sm" /></NuxtLink></li>
            </ul>
          </UiCard>

          <UiCard v-if="movements.length" title="Mouvements de stock" icon="arrow-left-right">
            <ul class="divide-y divide-line text-sm"><li v-for="m in movements" :key="m.id" class="flex items-center justify-between gap-3 py-2.5"><span>{{ fdatetime(m.at) }}<span class="text-muted"> · {{ m.note ?? '' }}</span></span><UiStatusBadge kind="stockMovement" :value="m.type" size="sm" /><span class="tnum font-medium">{{ kg(m.qty) }}</span></li></ul>
          </UiCard>
        </div>

        <aside class="flex flex-col gap-5">
          <UiCard title="Rémunération simulée" icon="wallet">
            <template v-if="r.payout">
              <p class="tnum font-display text-2xl font-semibold">{{ fcfa(r.payout.amount) }}</p>
              <p class="mt-1 text-sm text-muted">{{ r.payout.status === 'paid_simulated' ? `Versée (simulation) le ${r.payout.paidAt ? fdate(r.payout.paidAt) : '—'}${r.payout.ref ? ` · ${r.payout.ref}` : ''}` : 'En attente de versement (simulation).' }}</p>
              <UiButton v-if="canPay" class="mt-3" size="sm" icon="wallet" @click="pay">Verser (simulé)</UiButton>
            </template>
            <p v-else class="text-sm text-muted">Aucune rémunération : ce partenaire n’est pas rémunéré au kilo ou la fonction est désactivée.</p>
            <SiteNotice class="mt-3" kind="simulated" dense />
          </UiCard>
          <UiCard title="Origine" icon="truck">
            <UiKeyValue :items="[{ label: 'Collecte', value: collection?.ref ?? 'Apport direct' }, { label: 'Fournisseur', value: L.supplierName(r.supplierId) }, { label: 'Statut', value: STATUS.receipt[r.status].label }]" />
            <UiButton v-if="collection" class="mt-3" size="sm" variant="ghost" iconRight="arrow-right" :to="`/ops/appro/demandes/${collection.id}`">Voir la collecte</UiButton>
            <p v-if="r.notes" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ r.notes }}</p>
          </UiCard>
        </aside>
      </div>
    </template>
  </div>
</template>
