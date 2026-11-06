/**
 * Confirmation avant une action destructrice ou irréversible.
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Annuler la commande ?', message: '…', confirmLabel: 'Annuler la commande', tone: 'danger' }))) return
 * `UiConfirmHost` (monté dans app.vue) affiche le dialogue.
 */
export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

// Résolveur hors état réactif (une fonction n'est pas sérialisable dans useState)
let resolver: ((ok: boolean) => void) | null = null

export function useConfirm() {
  const state = useState<ConfirmState>('ecobloc:confirm', () => ({ open: false, title: '' }))

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    if (resolver) resolver(false)
    state.value = { confirmLabel: 'Confirmer', cancelLabel: 'Annuler', tone: 'primary', ...opts, open: true }
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function settle(ok: boolean) {
    state.value = { ...state.value, open: false }
    const r = resolver
    resolver = null
    r?.(ok)
  }

  // `useConfirm()` est à la fois la fonction de confirmation et le point d'accès de l'hôte
  return Object.assign(confirm, { state, settle })
}
