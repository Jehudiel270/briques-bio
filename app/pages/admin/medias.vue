<script setup lang="ts">
import { authHeaders } from '~/utils/auth-session'
import type { MediaRef } from '#shared/types/domain'

usePageTitle('Médias Cloudinary')
const toast = useToast()
const config = useRuntimeConfig()
const root = String((config.public as any).cloudinaryFolder ?? 'ecobloc')
const SUB = [
  { key: 'produits', label: 'Produits', icon: 'package', hint: 'Photos du catalogue' },
  { key: 'atelier', label: 'Atelier', icon: 'factory', hint: 'Photos de production' },
  { key: 'collectes', label: 'Collectes', icon: 'truck', hint: 'Photos de lots et preuves d’enlèvement' },
  { key: 'qualite', label: 'Qualité', icon: 'microscope', hint: 'Essais et preuves' },
  { key: 'livraisons', label: 'Livraisons', icon: 'package-check', hint: 'Preuves de livraison' },
  { key: 'documents', label: 'Documents', icon: 'files', hint: 'Fiches et rapports' },
  { key: 'branding', label: 'Marque', icon: 'badge', hint: 'Logo et visuels' },
  { key: 'etudes-de-cas', label: 'Études de cas', icon: 'newspaper', hint: 'Illustrations (fictives)' },
]
interface FolderResult { path: string; status: 'created' | 'exists' | 'error'; detail?: string }
const busy = ref(false)
const results = ref<FolderResult[]>([])
const error = ref('')
async function createFolders() {
  busy.value = true; error.value = ''
  try {
    const res: any = await $fetch('/api/cloudinary/folders', { method: 'POST', headers: await authHeaders() })
    results.value = res?.results ?? []
    if (res?.ok) toast.success('Dossiers Cloudinary prêts.')
    else error.value = 'Certains dossiers n’ont pas pu être créés. Consultez le détail ci-dessous.'
  } catch (e: any) {
    results.value = e?.data?.data?.results ?? []
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Création impossible : serveur injoignable ou Cloudinary non configuré.'
  } finally { busy.value = false }
}
const tone = { created: 'success', exists: 'info', error: 'danger' } as const
const label = { created: 'Créé', exists: 'Déjà présent', error: 'Erreur' } as const

const folder = ref('produits')
const uploaded = ref<MediaRef[]>([])
const gallery = ref<MediaRef[]>([])
watch(uploaded, (v) => { gallery.value = [...(Array.isArray(v) ? v : v ? [v] : []), ...gallery.value].slice(0, 12) })
</script>

<template>
  <div>
    <UiPageHeader title="Médias Cloudinary" description="Arborescence du projet et envoi de fichiers. Les clés secrètes restent côté serveur : le navigateur reçoit uniquement une signature d’envoi." icon="image" />
    <div class="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <UiCard :title="`Dossiers du projet · ${root}/`" icon="folder-tree" description="Un dossier par usage, pour retrouver et nettoyer facilement les médias.">
        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="s in SUB" :key="s.key" class="flex items-center gap-3 rounded-lg border border-line p-3"><Icon :name="`lucide:${s.icon}`" class="size-5 shrink-0 text-primary" aria-hidden="true" /><div class="min-w-0"><p class="text-sm font-medium">{{ root }}/{{ s.key }}</p><p class="truncate text-[13px] text-muted">{{ s.hint }}</p></div></li>
        </ul>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <UiButton icon="folder-plus" :loading="busy" @click="createFolders">Créer / vérifier les dossiers</UiButton>
          <span class="text-[13px] text-muted">Opération sans risque : un dossier déjà présent est simplement signalé.</span>
        </div>
        <UiAlert v-if="error" class="mt-4" tone="danger" icon="triangle-alert" title="Dossiers non créés">{{ error }}</UiAlert>
        <ul v-if="results.length" class="mt-4 divide-y divide-line text-sm"><li v-for="r in results" :key="r.path" class="flex items-center justify-between gap-3 py-2"><span class="truncate">{{ r.path }}<span v-if="r.detail" class="text-[13px] text-muted"> · {{ r.detail }}</span></span><UiBadge :tone="tone[r.status]" size="sm">{{ label[r.status] }}</UiBadge></li></ul>
      </UiCard>

      <UiCard title="Envoyer un fichier" icon="cloud-upload">
        <UiField label="Dossier de destination" #default="{ id }"><UiSelect :id="id" v-model="folder" :options="SUB.map((s) => ({ value: s.key, label: `${root}/${s.key}` }))" /></UiField>
        <UiCloudUpload :key="folder" v-model="uploaded" class="mt-4" :folder="folder" multiple accept="image/*,application/pdf" label="Déposer des images ou PDF" hint="10 Mo maximum par fichier." />
        <UiAlert class="mt-4" tone="info" icon="shield-check" dense>Les envois sont signés côté serveur et limités aux dossiers du projet.</UiAlert>
      </UiCard>
    </div>

    <UiCard class="mt-5" title="Derniers envois de cette session" icon="images">
      <UiEmpty v-if="!gallery.length" compact icon="images" title="Aucun envoi" hint="Les fichiers envoyés apparaissent ici." />
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><UiImage v-for="(m, i) in gallery" :key="i" :media="m" ratio="1/1" class="rounded-md" /></div>
    </UiCard>
  </div>
</template>
