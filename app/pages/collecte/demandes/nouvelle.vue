<script setup lang="ts">
import { POLYMER_LABEL } from '#shared/utils/labels'
import { fdate, kg } from '#shared/utils/format'
import type { MediaRef, PolymerCode } from '#shared/types/domain'

usePageTitle('Nouvelle demande d’enlèvement')
const db = useDb()
const svc = useServices()
const act = useAction()
const auth = useAuth()
const settings = useSettings()

const supplier = computed(() => db.peek('suppliers', auth.user.value?.supplierId))
const rules = computed(() => settings.value.polymers)
const qty = reactive<Record<string, number | null>>({})
const point = reactive({ label: '', line: '', city: '' })
const slots = ref<string[]>([])
const notes = ref('')
const photos = ref<MediaRef | MediaRef[] | undefined>([])
const errors = reactive<{ polymers?: string; point?: string }>({})
const busy = ref(false)

watch(supplier, (s) => {
  if (s && !point.line) { point.label = s.name; point.line = s.address.line; point.city = s.address.city }
}, { immediate: true })

/** Créneaux proposés : 7 prochains jours × matin / après-midi (le dimanche est exclu). */
const slotOptions = computed(() => {
  const out: { value: string; label: string }[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86_400_000)
    if (d.getDay() === 0) continue
    const iso = d.toISOString().slice(0, 10)
    for (const part of ['Matin', 'Après-midi']) out.push({ value: `${iso} ${part}`, label: `${fdate(d)} · ${part.toLowerCase()}` })
  }
  return out
})
const total = computed(() => Object.values(qty).reduce<number>((a, v) => a + (Number(v) || 0), 0))
const toggleSlot = (v: string) => { slots.value = slots.value.includes(v) ? slots.value.filter((s) => s !== v) : [...slots.value, v] }

async function submit() {
  errors.polymers = total.value > 0 ? undefined : 'Indiquez la quantité estimée d’au moins un type de plastique.'
  errors.point = point.line.trim() && point.city.trim() ? undefined : 'Renseignez l’adresse et la ville du point d’enlèvement.'
  if (errors.polymers || errors.point) return
  busy.value = true
  let id = ''
  const ok = await act(() => {
    const col = svc.collections.request({
      polymers: Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([code, v]) => ({ code: code as PolymerCode, estimatedKg: Number(v) })),
      pickupPoint: { label: point.label.trim() || point.line.trim(), line: point.line.trim(), city: point.city.trim(), country: 'Bénin' },
      photos: Array.isArray(photos.value) ? photos.value : photos.value ? [photos.value] : [], preferredSlots: slots.value.length ? slots.value : ['Matin', 'Après-midi'], notes: notes.value,
    })
    id = col.id
  }, 'Demande envoyée à l’équipe approvisionnement.')
  busy.value = false
  if (ok) await navigateTo(`/collecte/demandes/${id}`)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <UiPageHeader title="Nouvelle demande" description="Décrivez ce que vous avez à faire enlever." back="/collecte/demandes" icon="circle-plus" />
    <UiAlert v-if="supplier && supplier.status !== 'approved'" tone="warning" icon="hourglass" title="Profil non validé">Vous pourrez déclarer une collecte dès la validation de votre profil.</UiAlert>

    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <UiCard title="Plastiques à enlever" icon="package" description="Quantités estimées, en kilos. Elles seront pesées à la réception.">
        <ul class="flex flex-col gap-3">
          <li v-for="r in rules" :key="r.code" class="flex min-h-12 items-center gap-3">
            <div class="min-w-0 flex-1"><p class="font-medium" :class="!r.accepted && 'text-muted line-through'">{{ POLYMER_LABEL[r.code] }}</p><p class="text-[12px] text-muted">{{ r.accepted ? r.criteria : 'Non accepté actuellement' }}</p></div>
            <UiInput v-if="r.accepted" v-model.number="qty[r.code]" type="number" suffix="kg" class="w-32" :aria-label="`Quantité de ${POLYMER_LABEL[r.code]}`" inputmode="decimal" touch />
          </li>
        </ul>
        <p v-if="errors.polymers" class="mt-3 text-sm text-danger" role="alert">{{ errors.polymers }}</p>
        <p class="tnum mt-3 border-t border-line pt-3 text-right font-display font-semibold">Total estimé : {{ kg(total) }}</p>
      </UiCard>

      <UiCard title="Point d’enlèvement" icon="map-pin">
        <div class="flex flex-col gap-3">
          <UiField label="Nom du lieu" #default="{ id }"><UiInput :id="id" v-model="point.label" touch /></UiField>
          <UiField label="Adresse" required #default="{ id }"><UiInput :id="id" v-model="point.line" touch /></UiField>
          <UiField label="Ville" required #default="{ id }"><UiInput :id="id" v-model="point.city" touch /></UiField>
        </div>
        <p v-if="errors.point" class="mt-3 text-sm text-danger" role="alert">{{ errors.point }}</p>
      </UiCard>

      <UiCard title="Créneaux possibles" icon="calendar-clock" description="Choisissez plusieurs créneaux : l’équipe en retiendra un.">
        <div class="grid grid-cols-2 gap-2">
          <button v-for="s in slotOptions" :key="s.value" type="button" class="min-h-11 rounded-lg border px-3 text-left text-[13px] font-medium transition-colors" :class="slots.includes(s.value) ? 'border-primary bg-primary/8' : 'border-line hover:bg-surface-2'" :aria-pressed="slots.includes(s.value)" @click="toggleSlot(s.value)">{{ s.label }}</button>
        </div>
      </UiCard>

      <UiCard title="Photos et remarques" icon="camera">
        <div class="flex flex-col gap-4">
          <UiCloudUpload v-model="photos" folder="collectes" multiple accept="image/*" label="Ajouter des photos du tas" hint="Facultatif. Aide l’équipe à préparer le véhicule." />
          <UiField label="Remarques" #default="{ id }"><UiTextarea :id="id" v-model="notes" :rows="3" placeholder="Accès, personne à contacter, conditionnement…" /></UiField>
        </div>
      </UiCard>

      <UiButton type="submit" size="lg" block icon="send" :loading="busy" :disabled="supplier?.status !== 'approved'">Envoyer la demande</UiButton>
    </form>
  </div>
</template>
