import { computed, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'

/**
 * Titre d'onglet « titre · Marque ». Mémorise aussi le titre courant (état `ecobloc:page-title`)
 * pour le fil d'Ariane et l'en-tête mobile des layouts.
 */
export function usePageTitle(title: MaybeRefOrGetter<string | undefined | null>) {
  const brand = useBrand()
  const current = useState<string>('ecobloc:page-title', () => '')
  const resolved = computed(() => (toValue(title) ?? '').trim())

  watch(resolved, (v) => (current.value = v), { immediate: true })
  onBeforeUnmount(() => {
    if (current.value === resolved.value) current.value = ''
  })

  useHead({ title: computed(() => (resolved.value ? `${resolved.value} · ${brand.name}` : brand.name)) })
}
