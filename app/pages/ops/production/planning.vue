<script setup lang="ts">
import { fdate, num } from '#shared/utils/format'
import { STATUS } from '#shared/utils/labels'

usePageTitle('Planification')
const db = useDb()
const L = useLookups()
const offset = ref(0)
const DAY = 86_400_000
const monday = computed(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7); return d })
const days = computed(() => Array.from({ length: 7 }, (_, i) => new Date(monday.value.getTime() + i * DAY)))
const orders = computed(() => db.all('workOrders').filter((w) => w.status !== 'cancelled'))
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const onDay = (d: Date) => orders.value.filter((w) => {
  const s = w.plannedStart.slice(0, 10); const e = w.plannedEnd.slice(0, 10); const k = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  return k >= s && k <= e
})
const isToday = (d: Date) => dayKey(new Date(d.getTime() - d.getTimezoneOffset() * 60000)) === dayKey(new Date(Date.now() - new Date().getTimezoneOffset() * 60000))
const label = (d: Date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
const tone = (s: string) => STATUS.workOrder[s as keyof typeof STATUS.workOrder]?.tone ?? 'neutral'
const toneCls: Record<string, string> = { neutral: 'border-line bg-surface-2', info: 'border-info/40 bg-info/10', success: 'border-success/40 bg-success/10', warning: 'border-warning/40 bg-warning/10', danger: 'border-danger/40 bg-danger/10', accent: 'border-accent/50 bg-accent/20' }
</script>

<template>
  <div>
    <UiPageHeader title="Planification" description="Vue hebdomadaire des ordres de fabrication planifiés." icon="calendar-range">
      <template #actions>
        <UiButton variant="outline" icon="chevron-left" aria-label="Semaine précédente" icon-only @click="offset--" />
        <UiButton variant="outline" @click="offset = 0">Cette semaine</UiButton>
        <UiButton variant="outline" icon="chevron-right" aria-label="Semaine suivante" icon-only @click="offset++" />
      </template>
    </UiPageHeader>
    <p class="mb-3 text-sm text-muted">Semaine du {{ fdate(days[0]) }} au {{ fdate(days[6]) }}</p>
    <div class="scroll-x">
      <div class="grid min-w-[56rem] grid-cols-7 gap-2">
        <section v-for="d in days" :key="d.toISOString()" class="min-h-44 rounded-lg border border-line bg-surface p-2.5" :class="isToday(d) && 'ring-2 ring-primary/30'">
          <h2 class="mb-2 text-[13px] font-semibold capitalize" :class="isToday(d) ? 'text-primary' : 'text-ink'">{{ label(d) }}</h2>
          <ul class="flex flex-col gap-1.5">
            <li v-for="w in onDay(d)" :key="w.id">
              <NuxtLink :to="`/ops/production/ordres/${w.id}`" class="block rounded-md border p-2 text-xs leading-snug hover:shadow-sm" :class="toneCls[tone(w.status)]">
                <span class="block font-semibold">{{ w.ref }}</span>
                <span class="block truncate">{{ L.productName(w.productId) }}</span>
                <span class="text-muted">{{ num(w.plannedQty) }} pièces</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-if="!onDay(d).length" class="text-xs text-muted">Libre</p>
        </section>
      </div>
    </div>
  </div>
</template>
