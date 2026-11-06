/**
 * Notifications éphémères.
 *   const toast = useToast()
 *   toast.success('Devis envoyé', { title: 'Succès' })
 * `UiToaster` (monté dans app.vue) affiche la pile.
 */
export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  title?: string
  /** Durée d'affichage en ms (0 = ne se ferme pas seul) */
  duration: number
}

interface ToastOpts {
  title?: string
  duration?: number
}

const DURATION: Record<ToastKind, number> = { success: 4500, info: 5000, warning: 7000, error: 9000 }
let counter = 0

export function useToast() {
  const items = useState<ToastItem[]>('ecobloc:toasts', () => [])

  function push(kind: ToastKind, message: string, opts: ToastOpts = {}) {
    // évite les doublons exacts empilés (même message, même type)
    const dup = items.value.find((t) => t.kind === kind && t.message === message)
    if (dup) return dup.id
    const id = ++counter
    items.value = [...items.value.slice(-3), { id, kind, message, title: opts.title, duration: opts.duration ?? DURATION[kind] }]
    return id
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return {
    items,
    dismiss,
    clear: () => (items.value = []),
    success: (message: string, opts?: ToastOpts) => push('success', message, opts),
    error: (message: string, opts?: ToastOpts) => push('error', message, opts),
    info: (message: string, opts?: ToastOpts) => push('info', message, opts),
    warning: (message: string, opts?: ToastOpts) => push('warning', message, opts),
  }
}
