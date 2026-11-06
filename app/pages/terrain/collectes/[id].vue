<script setup lang="ts">
import { fdatetime, kg } from '#shared/utils/format'
import { POLYMER_LABEL } from '#shared/utils/labels'
import type { MediaRef } from '#shared/types/domain'
import type { FieldDef } from '~/utils/forms'

const route = useRoute()
const db = useDb()
const svc = useServices()
const act = useAction()
const L = useLookups()

const c = computed(() => db.get('collections', String(route.params.id)))
usePageTitle(c.value ? c.value.ref : 'Collecte')
const supplier = computed(() => db.peek('suppliers', c.value?.supplierId))

const weight = ref<number | null>(null)
const note = ref('')
const photo = ref<MediaRef | MediaRef[] | undefined>()
const busy = ref(false)
const stepError = ref('')
watch(c, (x) => { if (x && weight.value == null) weight.value = x.recordedKg ?? null }, { immediate: true })

const problemOpen = ref(false)
const cancelOpen = ref(false)
const reasonField = (label: string): FieldDef[] => [{ key: 'reason', label, type: 'textarea', required: true, span: 2, rows: 3 }]

const mapUrl = computed(() => (c.value?.pickupPoint.lat != null && c.value.pickupPoint.lng != null ? `https://www.openstreetmap.org/?mlat=${c.value.pickupPoint.lat}&mlon=${c.value.pickupPoint.lng}#map=17/${c.value.pickupPoint.lat}/${c.value.pickupPoint.lng}` : undefined))
const editable = computed(() => !!c.value && ['planned', 'en_route', 'collected', 'problem'].includes(c.value.status))

async function step(status: 'en_route' | 'collected' | 'weighed') {
  stepError.value = ''
  if ((status === 'weighed') && !(Number(weight.value) > 0)) { stepError.value = 'Saisissez le poids relevé en kilos avant de valider la pesée.'; return }
  if (status === 'collected' && !note.value.trim()) { stepError.value = 'Ajoutez une note de preuve (ex. « 3 sacs remis par M. Agbo »).'; return }
  busy.value = true
  const label = { en_route: 'Trajet démarré.', collected: 'Enlèvement confirmé.', weighed: 'Pesée enregistrée.' }[status]
  const ok = await act(() => svc.collections.driverUpdate(c.value!.id, {
    status, recordedKg: Number(weight.value) > 0 ? Number(weight.value) : undefined,
    proof: status === 'collected' ? { note: note.value.trim(), photo: Array.isArray(photo.value) ? photo.value[0] : photo.value } : undefined,
  }), label)
  busy.value = false
  if (ok && status === 'collected') { note.value = ''; photo.value = undefined }
}
const problem = (v: Record<string, any>) => svc.collections.driverUpdate(c.value!.id, { status: 'problem', problemReason: String(v.reason) })
const cancel = (v: Record<string, any>) => svc.collections.driverUpdate(c.value!.id, { status: 'cancelled', problemReason: String(v.reason) })
</script>

<template>
  <div class="flex flex-col gap-5">
    <UiEmpty v-if="!c" icon="package-x" title="Collecte introuvable" hint="Elle ne vous est pas attribuée."><UiButton icon="arrow-left" to="/terrain/collectes">Retour</UiButton></UiEmpty>
    <template v-else>
      <UiPageHeader :title="c.ref" back="/terrain/collectes" icon="package-search" :description="supplier?.name">
        <template #meta><UiStatusBadge kind="collection" :value="c.status" /></template>
      </UiPageHeader>

      <UiAlert v-if="c.status === 'problem'" tone="danger" icon="triangle-alert" title="Problème signalé">{{ c.problemReason }}</UiAlert>

      <UiCard title="Où et quand" icon="map-pin">
        <UiKeyValue :items="[
          { label: 'Lieu', value: c.pickupPoint.label }, { label: 'Adresse', value: `${c.pickupPoint.line}, ${c.pickupPoint.city}` },
          { label: 'Rendez-vous', value: c.scheduledAt ? fdatetime(c.scheduledAt) : 'À confirmer' },
          { label: 'Contact', value: supplier ? `${supplier.contactName} · ${supplier.phone}` : '—' },
        ]" />
        <div class="mt-4 grid grid-cols-2 gap-2">
          <a v-if="supplier?.phone" :href="`tel:${supplier.phone.replace(/\s/g, '')}`" class="contents"><UiButton variant="outline" block size="lg" icon="phone">Appeler</UiButton></a>
          <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener noreferrer" class="contents"><UiButton variant="outline" block size="lg" icon="navigation">Itinéraire</UiButton></a>
        </div>
      </UiCard>

      <UiCard title="À enlever" icon="package">
        <ul class="divide-y divide-line"><li v-for="p in c.polymers" :key="p.code" class="flex items-center justify-between py-2.5"><span class="font-medium">{{ POLYMER_LABEL[p.code] }}</span><span class="tnum">{{ kg(p.estimatedKg) }}</span></li></ul>
        <p class="tnum mt-2 flex justify-between border-t border-line pt-3 font-display font-semibold"><span>Total estimé</span><span>{{ kg(c.estimatedTotalKg) }}</span></p>
        <p v-if="c.notes" class="mt-3 rounded-md bg-surface-2 p-3 text-sm">{{ c.notes }}</p>
      </UiCard>

      <UiCard v-if="editable" title="Prochaine étape" icon="footprints">
        <UiAlert v-if="stepError" tone="danger" class="mb-4" role="alert">{{ stepError }}</UiAlert>

        <UiButton v-if="c.status === 'planned' || c.status === 'problem'" block size="lg" icon="truck" :loading="busy" @click="step('en_route')">{{ c.status === 'problem' ? 'Reprendre le trajet' : 'Démarrer le trajet' }}</UiButton>

        <div v-else-if="c.status === 'en_route'" class="flex flex-col gap-4">
          <UiField label="Poids relevé sur place (kg, facultatif)" #default="{ id }"><UiInput :id="id" v-model.number="weight" type="number" inputmode="decimal" suffix="kg" touch /></UiField>
          <UiField label="Note de preuve" required hint="Qui a remis les plastiques, nombre de sacs…" #default="{ id }"><UiTextarea :id="id" v-model="note" :rows="3" touch /></UiField>
          <UiCloudUpload v-model="photo" folder="collectes" accept="image/*" label="Photo de preuve" hint="Facultatif" />
          <UiButton block size="lg" icon="package-check" :loading="busy" @click="step('collected')">Confirmer l’enlèvement</UiButton>
        </div>

        <div v-else-if="c.status === 'collected'" class="flex flex-col gap-4">
          <UiField label="Poids relevé (kg)" required #default="{ id }"><UiInput :id="id" v-model.number="weight" type="number" inputmode="decimal" suffix="kg" touch /></UiField>
          <UiButton block size="lg" icon="scale" :loading="busy" @click="step('weighed')">Valider la pesée</UiButton>
        </div>
      </UiCard>

      <UiAlert v-if="c.status === 'weighed'" tone="success" icon="badge-check" title="Pesée enregistrée">{{ kg(c.recordedKg ?? 0) }} relevés. L’atelier confirmera la réception.</UiAlert>

      <div v-if="editable" class="grid grid-cols-2 gap-2">
        <UiButton variant="outline" size="lg" block icon="triangle-alert" @click="problemOpen = true">Signaler un problème</UiButton>
        <UiButton variant="outline" size="lg" block icon="ban" @click="cancelOpen = true">Annuler</UiButton>
      </div>

      <UiCard title="Historique" icon="history"><UiTimeline :items="[...c.history].reverse().map((h) => ({ at: h.at, title: h.action, body: h.note, by: h.userName }))" empty="Aucun événement." /></UiCard>
      <UiFormDialog v-model:open="problemOpen" title="Signaler un problème" :fields="reasonField('Décrivez le problème')" submit-label="Signaler" @submit="problem" />
      <UiFormDialog v-model:open="cancelOpen" title="Annuler la collecte" :fields="reasonField('Motif de l’annulation')" submit-label="Annuler la collecte" @submit="cancel" />
      <p class="text-center text-[12px] text-muted">Collecte pour {{ L.supplierName(c.supplierId) }}</p>
    </template>
  </div>
</template>
