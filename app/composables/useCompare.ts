/** Sélection de produits à comparer (3 maximum), mémorisée dans le navigateur. */
import { lsGet, lsSetJson } from '~/utils/storage'

const KEY = 'ecobloc:compare'
export const COMPARE_MAX = 3

export function useCompare() {
  const ids = useState<string[]>('ecobloc:compare', () => [])
  if (import.meta.client && !ids.value.length) {
    try {
      const raw = JSON.parse(lsGet(KEY) ?? '[]')
      if (Array.isArray(raw)) ids.value = raw.filter((x) => typeof x === 'string').slice(0, COMPARE_MAX)
    } catch { /* ignore */ }
  }
  const save = () => lsSetJson(KEY, ids.value)
  return {
    ids,
    has: (id: string) => ids.value.includes(id),
    /** Renvoie false si la sélection est pleine */
    toggle(id: string): boolean {
      if (ids.value.includes(id)) ids.value = ids.value.filter((x) => x !== id)
      else if (ids.value.length >= COMPARE_MAX) return false
      else ids.value = [...ids.value, id]
      save()
      return true
    },
    clear() {
      ids.value = []
      save()
    },
  }
}
