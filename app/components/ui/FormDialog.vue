<script setup lang="ts">
import { cleanValues, initialValues, isVisible, validateAll, validateField, type FieldDef } from '~/utils/forms'
/**
 * Formulaire en boîte de dialogue, piloté par une liste de champs (`FieldDef`, voir app/utils/forms.ts).
 * `submit(values)` peut être asynchrone : le bouton est en chargement tant que la promesse n'est pas résolue ;
 * si elle lève, le message d'erreur s'affiche dans le dialogue et celui-ci reste ouvert.
 * Si `submit` se termine sans erreur, le dialogue se ferme.
 */
const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    fields: FieldDef[]
    initial?: Record<string, any>
    submitLabel?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Reçoit `@submit="fn"` : déclaré comme prop (et non comme émission) pour pouvoir attendre la promesse renvoyée par `fn` */
    onSubmit?: (values: Record<string, any>) => unknown
  }>(),
  { submitLabel: 'Enregistrer', size: 'md' },
)

const values = reactive<Record<string, any>>({})
const errors = reactive<Record<string, string>>({})
const touched = reactive<Record<string, boolean>>({})
const submitting = ref(false)
const formError = ref('')

function reset() {
  for (const k of Object.keys(values)) delete values[k]
  for (const k of Object.keys(errors)) delete errors[k]
  for (const k of Object.keys(touched)) delete touched[k]
  Object.assign(values, initialValues(props.fields, props.initial))
  formError.value = ''
}
watch(open, (o) => { if (o) reset() }, { immediate: true })

const visible = computed(() => props.fields.filter((f) => isVisible(f, values)))

function blur(f: FieldDef) {
  touched[f.key] = true
  const e = validateField(f, values)
  if (e) errors[f.key] = e
  else delete errors[f.key]
}
// revalide à la volée un champ déjà en erreur
watch(values, () => {
  for (const f of props.fields) {
    if (!errors[f.key]) continue
    const e = validateField(f, values)
    if (e) errors[f.key] = e
    else delete errors[f.key]
  }
}, { deep: true })

async function submit() {
  formError.value = ''
  const errs = validateAll(props.fields, values)
  for (const k of Object.keys(errors)) delete errors[k]
  Object.assign(errors, errs)
  const first = Object.keys(errs)[0]
  if (first) {
    await nextTick()
    document.getElementById(`ff-${first}`)?.focus()
    return
  }
  submitting.value = true
  try {
    const clean = cleanValues(props.fields, values)
    await props.onSubmit?.(clean)
    open.value = false
  } catch (e: any) {
    formError.value = e?.message || 'L’enregistrement a échoué : vérifiez les champs puis réessayez.'
  } finally {
    submitting.value = false
  }
}

const tagDraft = reactive<Record<string, string>>({})
function addTag(f: FieldDef) {
  const t = (tagDraft[f.key] ?? '').trim().replace(/,$/, '')
  if (!t) return
  const list: string[] = values[f.key] ?? (values[f.key] = [])
  if (!list.includes(t)) list.push(t)
  tagDraft[f.key] = ''
}
function toggleMulti(f: FieldDef, v: string | number) {
  const list: (string | number)[] = values[f.key] ?? (values[f.key] = [])
  const i = list.indexOf(v)
  if (i >= 0) list.splice(i, 1)
  else list.push(v)
}
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :description="description" :size="size" :dismissable="!submitting">
    <form id="form-dialog" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="submit">
      <UiAlert v-if="formError" tone="danger" class="sm:col-span-2">{{ formError }}</UiAlert>
      <UiField
        v-for="f in visible"
        :key="f.key"
        :label="f.type === 'checkbox' || f.type === 'switch' ? undefined : f.label"
        :hint="f.hint"
        :error="errors[f.key]"
        :required="f.required && f.type !== 'checkbox'"
        :for="`ff-${f.key}`"
        :class="f.span === 2 || f.type === 'textarea' || f.type === 'multiselect' || f.type === 'tags' || f.type === 'media' || f.type === 'checkbox' || f.type === 'switch' ? 'sm:col-span-2' : ''"
      >
        <template #default="{ id }">
          <UiTextarea v-if="f.type === 'textarea'" :id="id" v-model="values[f.key]" :rows="f.rows ?? 4" :placeholder="f.placeholder" :error="errors[f.key]" @blur="blur(f)" />
          <UiSelect v-else-if="f.type === 'select'" :id="id" v-model="values[f.key]" :options="f.options ?? []" :placeholder="f.placeholder ?? 'Choisir…'" :error="errors[f.key]" @update:model-value="blur(f)" />
          <div v-else-if="f.type === 'multiselect'" :id="id" class="flex flex-wrap gap-2" role="group" :aria-label="f.label">
            <button
              v-for="o in f.options ?? []"
              :key="String(o.value)"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors"
              :class="(values[f.key] ?? []).includes(o.value) ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-line bg-surface text-ink hover:border-muted/70'"
              :aria-pressed="(values[f.key] ?? []).includes(o.value)"
              @click="toggleMulti(f, o.value)"
            >
              <Icon v-if="(values[f.key] ?? []).includes(o.value)" name="lucide:check" class="size-3.5" aria-hidden="true" />{{ o.label }}
            </button>
          </div>
          <UiCheckbox v-else-if="f.type === 'checkbox'" :id="id" v-model="values[f.key]" :label="f.label" :hint="f.hint" />
          <UiSwitch v-else-if="f.type === 'switch'" :id="id" v-model="values[f.key]" :label="f.label" :hint="f.hint" />
          <div v-else-if="f.type === 'tags'" class="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
            <span v-for="(t, i) in values[f.key] ?? []" :key="t" class="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-[13px]">
              {{ t }}<button type="button" class="grid size-5 place-items-center rounded-full hover:bg-line" :aria-label="`Retirer ${t}`" @click="values[f.key].splice(i, 1)"><Icon name="lucide:x" class="size-3" aria-hidden="true" /></button>
            </span>
            <input
              :id="id"
              v-model="tagDraft[f.key]"
              class="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted/70"
              :placeholder="f.placeholder ?? 'Ajouter puis Entrée'"
              @keydown.enter.prevent="addTag(f)"
              @keydown.,.prevent="addTag(f)"
              @blur="addTag(f)"
            />
          </div>
          <UiCloudUpload v-else-if="f.type === 'media'" v-model="values[f.key]" :folder="f.folder ?? 'documents'" :multiple="f.multiple" :label="f.label" />
          <UiInput
            v-else-if="f.type === 'color'"
            :id="id"
            v-model="values[f.key]"
            type="color"
            :error="errors[f.key]"
            class="[&_input]:cursor-pointer [&_input]:p-1"
            @blur="blur(f)"
          />
          <UiInput
            v-else
            :id="id"
            v-model="values[f.key]"
            :type="f.type === 'currency' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type"
            :suffix="f.type === 'currency' ? 'FCFA' : undefined"
            :min="f.min"
            :max="f.max"
            :step="f.step ?? (f.type === 'currency' ? 1 : undefined)"
            :placeholder="f.placeholder"
            :inputmode="f.type === 'currency' ? 'numeric' : f.type === 'tel' ? 'tel' : undefined"
            :error="errors[f.key]"
            @blur="blur(f)"
          />
        </template>
      </UiField>
    </form>
    <template #footer>
      <UiButton variant="outline" :disabled="submitting" @click="open = false">Annuler</UiButton>
      <UiButton variant="primary" type="submit" form="form-dialog" :loading="submitting">{{ submitLabel }}</UiButton>
    </template>
  </UiDialog>
</template>
