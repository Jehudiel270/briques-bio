<script setup lang="ts">
import type { FieldDef } from '~/utils/forms'
import { cleanValues, initialValues, validateAll } from '~/utils/forms'
import type { Prospect } from '#shared/types/domain'
/**
 * Formulaire de prise de contact de la vitrine : enregistre un prospect (collection `prospects`) et prévient l'équipe commerciale.
 * Champs fixes : nom, e-mail, téléphone (au moins un moyen de contact) ; `fields` ajoute les champs propres à la page.
 * Les champs supplémentaires sont regroupés dans les notes du prospect.
 */
const props = withDefaults(defineProps<{
  interest: NonNullable<Prospect['interest']>
  source?: Prospect['source']
  fields?: FieldDef[]
  submitLabel?: string
  successTitle?: string
  successText?: string
  /** clé du champ qui contient le nom de l'entreprise (copié dans `company`) */
  companyKey?: string
}>(), { source: 'site', fields: () => [], submitLabel: 'Envoyer', successTitle: 'Message envoyé', successText: 'Notre équipe vous répond sous quelques jours ouvrés (délai indicatif à confirmer).' })

const db = useDb()
const auth = useAuth()
const act = useAction()

const base: FieldDef[] = [
  { key: 'name', label: 'Nom et prénom', type: 'text', required: true },
  { key: 'email', label: 'Adresse e-mail', type: 'email' },
  { key: 'phone', label: 'Téléphone (WhatsApp possible)', type: 'tel', placeholder: '+229 …' },
]
const all = computed<FieldDef[]>(() => [
  ...base,
  ...props.fields,
  { key: 'consent', label: 'J’accepte que ces informations soient utilisées pour répondre à ma demande (voir la politique de confidentialité).', type: 'checkbox', required: true, span: 2 },
])

const values = reactive<Record<string, any>>({})
const errors = reactive<Record<string, string>>({})
const sent = ref(false)
const busy = ref(false)
const formError = ref('')

function reset() {
  for (const k of Object.keys(values)) delete values[k]
  for (const k of Object.keys(errors)) delete errors[k]
  Object.assign(values, initialValues(all.value, { name: auth.user.value?.name, email: auth.user.value?.email, phone: auth.user.value?.phone }))
}
reset()
watch(() => auth.user.value?.id, reset)

async function submit() {
  formError.value = ''
  const errs = validateAll(all.value, values)
  if (!values.email?.toString().trim() && !values.phone?.toString().trim()) errs.email = 'Indiquez une adresse e-mail ou un numéro de téléphone pour que nous puissions vous répondre.'
  for (const k of Object.keys(errors)) delete errors[k]
  Object.assign(errors, errs)
  const first = Object.keys(errs)[0]
  if (first) {
    await nextTick()
    document.getElementById(`ff-lead-${first}`)?.focus()
    return
  }
  const clean = cleanValues(all.value, values)
  const extras = props.fields
    .map((f) => {
      const v = clean[f.key]
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return ''
      const shown = Array.isArray(v) ? v.map((x) => f.options?.find((o) => o.value === x)?.label ?? x).join(', ') : f.options?.find((o) => o.value === v)?.label ?? v
      return `${f.label} : ${shown}`
    })
    .filter(Boolean)
  busy.value = true
  const ok = await act(() => {
    db.create('prospects', {
      name: clean.name,
      company: props.companyKey ? clean[props.companyKey] : undefined,
      email: clean.email, phone: clean.phone,
      source: props.source, interest: props.interest, status: 'new',
      notes: extras.join('\n') || undefined,
      createdAt: db.now(), demo: true,
    } as any, { summary: `Demande reçue via le site (${props.interest})` })
    db.notify({ roles: ['sales'], title: 'Nouvelle demande reçue via le site', body: `${clean.name} — ${props.interest}`, level: 'info', href: '/ops/commercial/prospects' })
  })
  busy.value = false
  if (ok) sent.value = true
}
</script>

<template>
  <UiAlert v-if="sent" tone="success" icon="circle-check" :title="successTitle">
    {{ successText }}
    <div class="mt-3"><UiButton size="sm" variant="outline" icon="rotate-ccw" @click="sent = false; reset()">Envoyer une autre demande</UiButton></div>
  </UiAlert>
  <form v-else novalidate class="flex flex-col gap-5" @submit.prevent="submit">
    <UiAlert v-if="formError" tone="danger">{{ formError }}</UiAlert>
    <UiFormFields :fields="all" :values="values" :errors="errors" prefix="lead" />
    <div class="flex flex-wrap items-center gap-3">
      <UiButton type="submit" icon="send" :loading="busy">{{ submitLabel }}</UiButton>
      <p class="text-[13px] text-muted">Vos données de démonstration restent dans ce prototype.</p>
    </div>
  </form>
</template>
