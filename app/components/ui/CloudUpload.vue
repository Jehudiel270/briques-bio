<script setup lang="ts">
import type { MediaRef } from '#shared/types/domain'
import { authHeaders } from '~/utils/auth-session'
/**
 * Téléversement vers Cloudinary (signature serveur → envoi direct). `v-model` : MediaRef (ou MediaRef[] si `multiple`).
 * Si la signature ou le réseau échoue, l'image reste en aperçu local (mention « aperçu local — non envoyé »).
 * Props en plus du contrat : `hint`, `maxMb` (8 par défaut).
 */
const model = defineModel<MediaRef | MediaRef[] | undefined>()
const props = withDefaults(
  defineProps<{ folder: string; multiple?: boolean; accept?: string; label?: string; hint?: string; maxMb?: number }>(),
  { accept: 'image/*,application/pdf', maxMb: 8 },
)
const config = useRuntimeConfig()
const input = ref<HTMLInputElement>()
const busy = ref(0)
const error = ref('')
const dragging = ref(false)

/** Aperçus locaux non envoyés (clé = url d'aperçu) */
const localOnly = reactive(new Set<string>())

const list = computed<MediaRef[]>(() => (Array.isArray(model.value) ? model.value : model.value ? [model.value] : []))
function setList(next: MediaRef[]) {
  model.value = props.multiple ? next : next[0]
}

async function sign(): Promise<{ cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string }> {
  return await $fetch('/api/cloudinary/sign', { method: 'POST', body: { folder: props.folder }, headers: await authHeaders() })
}

async function send(file: File): Promise<MediaRef> {
  const alt = file.name.replace(/\.[^.]+$/, '')
  try {
    const s = await sign()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', s.apiKey)
    fd.append('timestamp', String(s.timestamp))
    fd.append('signature', s.signature)
    fd.append('folder', s.folder)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/auto/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`Cloudinary ${res.status}`)
    const json = await res.json()
    return { publicId: json.public_id, url: json.secure_url, alt }
  } catch {
    // repli : aperçu local, jamais envoyé
    const url = await new Promise<string>((resolve) => {
      if (file.type.startsWith('image/')) {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => resolve(URL.createObjectURL(file))
        r.readAsDataURL(file)
      } else resolve(URL.createObjectURL(file))
    })
    localOnly.add(url)
    return { url, alt }
  }
}

async function addFiles(files: FileList | File[]) {
  error.value = ''
  const picked = Array.from(files).slice(0, props.multiple ? 12 : 1)
  const accepted: File[] = []
  for (const f of picked) {
    if (f.size > props.maxMb * 1024 * 1024) { error.value = `« ${f.name} » dépasse ${props.maxMb} Mo : réduisez le fichier puis réessayez.`; continue }
    if (!/^(image\/|application\/pdf)/.test(f.type)) { error.value = `« ${f.name} » : seuls les images et les PDF sont acceptés.`; continue }
    accepted.push(f)
  }
  if (!accepted.length) return
  busy.value += accepted.length
  try {
    const refs = await Promise.all(accepted.map(send))
    setList(props.multiple ? [...list.value, ...refs] : refs)
  } finally {
    busy.value -= accepted.length
  }
}

function remove(i: number) {
  const next = list.value.filter((_, idx) => idx !== i)
  setList(next)
}
const isImage = (m: MediaRef) => !!m.url && (m.url.startsWith('data:image') || /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(m.url) || m.url.includes('/image/upload/'))
const thumb = (m: MediaRef) => {
  if (m.url?.includes('/image/upload/')) return m.url.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_240,h_240,c_fill/')
  return m.url
}
void config
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div
      class="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors"
      :class="dragging ? 'border-primary bg-primary/5' : 'border-line bg-surface-2/40 hover:border-muted/70'"
      role="button"
      tabindex="0"
      :aria-label="`${label ?? 'Ajouter un fichier'} : cliquer ou glisser-déposer`"
      @click="input?.click()"
      @keydown.enter.prevent="input?.click()"
      @keydown.space.prevent="input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="dragging = false; addFiles($event.dataTransfer?.files ?? [])"
    >
      <Icon :name="busy ? 'lucide:loader-circle' : 'lucide:cloud-upload'" class="size-6 text-primary" :class="busy && 'animate-spin'" aria-hidden="true" />
      <p class="text-sm font-medium text-ink">{{ busy ? 'Envoi en cours…' : (label ?? 'Ajouter un fichier') }}</p>
      <p class="text-[13px] text-muted">{{ hint ?? `Glissez-déposez ou cliquez · images et PDF jusqu’à ${maxMb} Mo` }}</p>
      <input ref="input" type="file" class="sr-only" tabindex="-1" :accept="accept" :multiple="multiple" @change="addFiles(($event.target as HTMLInputElement).files ?? []); ($event.target as HTMLInputElement).value = ''" />
    </div>
    <p v-if="error" class="flex items-start gap-1.5 text-[13px] text-danger" role="alert"><Icon name="lucide:circle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{{ error }}</p>
    <ul v-if="list.length" class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <li v-for="(m, i) in list" :key="(m.publicId ?? m.url ?? '') + i" class="group relative overflow-hidden rounded-lg border border-line bg-surface">
        <img v-if="isImage(m)" :src="thumb(m)" :alt="m.alt" class="aspect-square w-full object-cover" loading="lazy" />
        <div v-else class="grid aspect-square place-items-center bg-surface-2 text-muted"><Icon name="lucide:file-text" class="size-8" aria-hidden="true" /></div>
        <p class="truncate px-2 py-1.5 text-xs text-muted" :title="m.alt">{{ m.alt }}</p>
        <UiBadge v-if="m.url && localOnly.has(m.url)" tone="warning" size="sm" class="absolute left-1.5 top-1.5" icon="cloud-off">aperçu local — non envoyé</UiBadge>
        <UiBadge v-else-if="m.publicId" tone="success" size="sm" class="absolute left-1.5 top-1.5" icon="cloud-check">Cloudinary</UiBadge>
        <button type="button" class="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink/70 text-bg opacity-100 transition-opacity hover:bg-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" :aria-label="`Retirer ${m.alt}`" @click="remove(i)">
          <Icon name="lucide:x" class="size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
