<script setup lang="ts">
import { fcfa, fdate, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'

usePageTitle('Justificatifs')
const db = useDb()
const settings = useSettings()
const L = useLookups()
const rows = computed(() => [...db.all('receipts')].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const sel = computed(() => db.get('receipts', openId.value))
const accepted = (r: { lines: { acceptedKg: number }[] }) => r.lines.reduce((a, l) => a + l.acceptedKg, 0)
const print = () => window.print()
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPageHeader title="Justificatifs de pesée" description="Un bon de réception pour chaque arrivage : à conserver en cas de désaccord." icon="file-check-2" />
    <SiteNotice kind="document" dense />
    <UiEmpty v-if="!rows.length" icon="file-check-2" title="Aucun justificatif" hint="Un bon est établi à chaque réception pesée." />
    <ul v-else class="flex flex-col gap-3">
      <li v-for="r in rows" :key="r.id">
        <button type="button" class="card block min-h-16 w-full p-4 text-left transition-colors hover:border-primary/50" @click="openId = r.id">
          <div class="flex items-start justify-between gap-3"><div><p class="font-display font-semibold">{{ r.ref }}</p><p class="text-[13px] text-muted">{{ fdate(r.receivedAt) }}</p></div><UiStatusBadge kind="receipt" :value="r.status" size="sm" /></div>
          <p class="tnum mt-2 text-sm"><span class="text-muted">Pesé</span> {{ kg(r.weighedKg) }} · <span class="text-muted">accepté</span> <strong>{{ kg(accepted(r)) }}</strong></p>
        </button>
      </li>
    </ul>

    <UiSheet v-model:open="open" :title="sel?.ref ?? 'Bon de réception'" side="bottom">
      <div v-if="sel" class="flex flex-col gap-4">
        <div class="relative overflow-hidden rounded-lg border border-line p-4">
          <p class="pointer-events-none absolute inset-0 grid place-items-center text-5xl font-bold uppercase tracking-widest text-ink/5 -rotate-12 select-none" aria-hidden="true">Démo</p>
          <p class="relative font-display font-semibold">{{ settings.company.legalName }} — Bon de réception</p>
          <p class="relative text-[13px] text-muted">{{ sel.ref }} · {{ fdate(sel.receivedAt) }} · reçu par {{ L.userName(sel.receivedBy) }}</p>
          <table class="relative mt-3 w-full text-sm">
            <thead><tr class="border-b border-line text-left text-[12px] text-muted"><th class="py-1.5 font-medium">Plastique</th><th class="py-1.5 text-right font-medium">Pesé</th><th class="py-1.5 text-right font-medium">Accepté</th><th class="py-1.5 text-right font-medium">Rejeté</th></tr></thead>
            <tbody><tr v-for="l in sel.lines" :key="l.polymer" class="border-b border-line/60"><td class="py-2">{{ POLYMER_LABEL[l.polymer] }}<p v-if="l.reason" class="text-[12px] text-muted">{{ l.reason }}</p></td><td class="tnum py-2 text-right">{{ kg(l.weighedKg) }}</td><td class="tnum py-2 text-right">{{ kg(l.acceptedKg) }}</td><td class="tnum py-2 text-right">{{ kg(l.rejectedKg) }}</td></tr></tbody>
          </table>
          <p v-if="sel.payout" class="relative mt-3 text-sm">Rémunération simulée : <strong class="tnum">{{ fcfa(sel.payout.amount) }}</strong> — {{ sel.payout.status === 'paid_simulated' ? 'versée (simulé)' : 'en attente' }}</p>
          <p class="relative mt-3 text-[12px] text-muted">Document de démonstration — non officiel, sans valeur comptable.</p>
        </div>
        <UiButton variant="outline" block icon="printer" @click="print">Imprimer</UiButton>
      </div>
    </UiSheet>
  </div>
</template>
