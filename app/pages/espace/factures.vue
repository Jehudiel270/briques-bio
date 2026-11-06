<script setup lang="ts">
import { fcfa, fdate } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'
import type { Invoice } from '#shared/types/domain'

usePageTitle('Factures et bons de commande')
const db = useDb()
const settings = useSettings()
const L = useLookups()
const rows = computed(() => [...db.all('invoices')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
const columns = [
  { key: 'ref', label: 'Facture', sortable: true },
  { key: 'issuedAt', label: 'Émise le', sortable: true, hide: 'sm' as const, value: (i: Invoice) => (i.issuedAt ? fdate(i.issuedAt) : '—'), sortValue: (i: Invoice) => i.issuedAt ?? '' },
  { key: 'order', label: 'Commande', value: (i: Invoice) => L.orderRef(i.orderId) },
  { key: 'po', label: 'Bon de commande', hide: 'md' as const, value: (i: Invoice) => i.purchaseOrderRef ?? '—' },
  { key: 'amount', label: 'Montant', align: 'right' as const, sortable: true, value: (i: Invoice) => fcfa(i.amount), sortValue: (i: Invoice) => i.amount },
  { key: 'status', label: 'Statut', value: (i: Invoice) => STATUS.invoice[i.status].label },
]
const openId = ref<string | null>(null)
const open = computed({ get: () => !!openId.value, set: (v: boolean) => { if (!v) openId.value = null } })
const inv = computed(() => db.get('invoices', openId.value))
const order = computed(() => db.get('orders', inv.value?.orderId))
const print = () => window.print()
</script>

<template>
  <div>
    <UiPageHeader title="Factures et bons de commande" description="Documents fictifs générés par la maquette : ils n’ont aucune valeur comptable ou fiscale." icon="receipt-text" />
    <SiteNotice kind="document" class="mb-5" />
    <UiDataTable :rows="rows" :columns="columns" export-name="mes-factures" @row-click="(i: Invoice) => (openId = i.id)">
      <template #cell-ref="{ row }"><span class="font-medium">{{ row.ref }}</span></template>
      <template #cell-status="{ row }"><UiStatusBadge kind="invoice" :value="row.status" size="sm" /></template>
      <template #empty><UiEmpty icon="receipt-text" title="Aucune facture" hint="Une facture fictive est émise à l’acceptation d’un devis ou d’une commande." /></template>
    </UiDataTable>

    <UiDialog v-model:open="open" :title="inv?.ref ?? 'Facture'" description="Aperçu de la facture fictive" size="lg">
      <div v-if="inv" class="relative overflow-hidden rounded-lg border border-line bg-surface p-5 print:border-0" id="facture">
        <p class="pointer-events-none absolute inset-0 grid place-items-center text-6xl font-bold uppercase tracking-widest text-ink/5 -rotate-12 select-none" aria-hidden="true">Fictive</p>
        <div class="relative flex flex-wrap justify-between gap-4">
          <div><p class="font-display text-lg font-semibold">{{ settings.company.legalName }}</p><p class="text-[13px] text-muted">{{ settings.company.address }}, {{ settings.company.city }}</p></div>
          <div class="text-right text-sm"><p class="font-display font-semibold">{{ inv.ref }}</p><p class="text-muted">Émise le {{ inv.issuedAt ? fdate(inv.issuedAt) : '—' }}</p><p class="text-muted">Échéance {{ inv.dueAt ? fdate(inv.dueAt) : '—' }}</p></div>
        </div>
        <table class="relative mt-5 w-full text-sm">
          <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="py-2 font-medium">Produit</th><th class="py-2 text-right font-medium">Qté</th><th class="py-2 text-right font-medium">Montant</th></tr></thead>
          <tbody><tr v-for="l in order?.lines ?? []" :key="l.id" class="border-b border-line/60"><td class="py-2">{{ l.label }}</td><td class="tnum py-2 text-right">{{ l.qty }}</td><td class="tnum py-2 text-right">{{ fcfa(Math.round(l.qty * l.unitPrice * (1 - (l.discountPct ?? 0) / 100))) }}</td></tr></tbody>
        </table>
        <p class="relative mt-4 flex justify-between border-t border-line pt-3 font-display text-lg font-semibold"><span>Total</span><span class="tnum">{{ fcfa(inv.amount) }}</span></p>
        <p class="relative mt-4 text-[12px] text-muted">Document de démonstration — non officiel, sans valeur de certificat, de facture ou de pièce comptable.</p>
      </div>
      <template #footer><UiButton variant="outline" icon="printer" @click="print">Imprimer l’aperçu</UiButton></template>
    </UiDialog>
  </div>
</template>
