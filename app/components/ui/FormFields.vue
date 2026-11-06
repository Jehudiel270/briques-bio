<script setup lang="ts">
import { isVisible, validateField, type FieldDef } from '~/utils/forms'
/**
 * Champs de formulaire en ligne, pilotés par une liste de `FieldDef` (même définition que `UiFormDialog`).
 * `values` et `errors` sont des objets réactifs appartenant au parent : le composant les modifie en place.
 * `touch` agrandit les cibles pour les portails mobiles. Les identifiants des champs sont `ff-<prefix>-<clé>`.
 */
const props = withDefaults(defineProps<{ fields: FieldDef[]; values: Record<string, any>; errors: Record<string, string>; prefix?: string; touch?: boolean }>(), { prefix: 'f' })

const visible = computed(() => props.fields.filter((f) => isVisible(f, props.values)))
const idOf = (f: FieldDef) => `ff-${props.prefix}-${f.key}`

function blur(f: FieldDef) {
  const e = validateField(f, props.values)
  if (e) props.errors[f.key] = e
  else delete props.errors[f.key]
}
// revalide à la volée un champ déjà en erreur
watch(() => props.values, () => {
  for (const f of props.fields) {
    if (!props.errors[f.key]) continue
    const e = validateField(f, props.values)
    if (e) props.errors[f.key] = e
    else delete props.errors[f.key]
  }
}, { deep: true })

const tagDraft = reactive<Record<string, string>>({})
function addTag(f: FieldDef) {
  const t = (tagDraft[f.key] ?? '').trim().replace(/,$/, '')
  if (!t) return
  const list: string[] = props.values[f.key] ?? (props.values[f.key] = [])
  if (!list.includes(t)) list.push(t)
  tagDraft[f.key] = ''
}
function toggleMulti(f: FieldDef, v: string | number) {
  const list: (string | number)[] = props.values[f.key] ?? (props.values[f.key] = [])
  const i = list.indexOf(v)
  if (i >= 0) list.splice(i, 1)
  else list.push(v)
}
const wide = (f: FieldDef) => f.span === 2 || ['textarea', 'multiselect', 'tags', 'media', 'checkbox', 'switch'].includes(f.type)
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UiField
      v-for="f in visible"
      :key="f.key"
      :label="f.type === 'checkbox' || f.type === 'switch' ? undefined : f.label"
      :hint="f.hint"
      :error="errors[f.key]"
      :required="f.required && f.type !== 'checkbox'"
      :for="idOf(f)"
      :class="wide(f) && 'sm:col-span-2'"
    >
      <template #default="{ id }">
        <UiTextarea v-if="f.type === 'textarea'" :id="id" v-model="values[f.key]" :rows="f.rows ?? 4" :placeholder="f.placeholder" :error="errors[f.key]" :touch="touch" @blur="blur(f)" />
        <UiSelect v-else-if="f.type === 'select'" :id="id" v-model="values[f.key]" :options="f.options ?? []" :placeholder="f.placeholder ?? 'Choisir…'" :error="errors[f.key]" :touch="touch" @update:model-value="blur(f)" />
        <div v-else-if="f.type === 'multiselect'" :id="id" class="flex flex-wrap gap-2" role="group" :aria-label="f.label">
          <button
            v-for="o in f.options ?? []"
            :key="String(o.value)"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors"
            :class="[touch ? 'h-11 text-sm' : 'h-8', (values[f.key] ?? []).includes(o.value) ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-line bg-surface text-ink hover:border-muted/70']"
            :aria-pressed="(values[f.key] ?? []).includes(o.value)"
            @click="toggleMulti(f, o.value)"
          >
            <Icon v-if="(values[f.key] ?? []).includes(o.value)" name="lucide:check" class="size-3.5" aria-hidden="true" />{{ o.label }}
          </button>
        </div>
        <UiCheckbox v-else-if="f.type === 'checkbox'" :id="id" v-model="values[f.key]" :label="f.label" :hint="f.hint" :touch="touch" />
        <UiSwitch v-else-if="f.type === 'switch'" :id="id" v-model="values[f.key]" :label="f.label" :hint="f.hint" />
        <div v-else-if="f.type === 'tags'" class="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <span v-for="(t, i) in values[f.key] ?? []" :key="t" class="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-[13px]">
            {{ t }}<button type="button" class="grid size-5 place-items-center rounded-full hover:bg-line" :aria-label="`Retirer ${t}`" @click="values[f.key].splice(i, 1)"><Icon name="lucide:x" class="size-3" aria-hidden="true" /></button>
          </span>
          <input :id="id" v-model="tagDraft[f.key]" class="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted/70" :placeholder="f.placeholder ?? 'Ajouter puis Entrée'" @keydown.enter.prevent="addTag(f)" @keydown.,.prevent="addTag(f)" @blur="addTag(f)" />
        </div>
        <UiCloudUpload v-else-if="f.type === 'media'" v-model="values[f.key]" :folder="f.folder ?? 'documents'" :multiple="f.multiple" :label="f.label" />
        <UiInput v-else-if="f.type === 'color'" :id="id" v-model="values[f.key]" type="color" :error="errors[f.key]" class="[&_input]:cursor-pointer [&_input]:p-1" @blur="blur(f)" />
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
          :touch="touch"
          @blur="blur(f)"
        />
      </template>
    </UiField>
  </div>
</template>
