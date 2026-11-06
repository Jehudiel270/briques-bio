import { computed, ref, type Ref } from 'vue'
import { lsGet, lsRemove, lsSetJson } from '~/utils/storage'

export interface CartItem {
  productId: string
  qty: number
  finish?: string
  color?: string
}

const CART_KEY = 'ecobloc:cart'
const MAX_QTY = 1_000_000

const items = ref<CartItem[]>([])
let started = false

function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  const out: CartItem[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object' || typeof (r as any).productId !== 'string') continue
    const qty = Math.floor(Number((r as any).qty))
    if (!Number.isFinite(qty) || qty < 1) continue
    out.push({
      productId: (r as any).productId,
      qty: Math.min(qty, MAX_QTY),
      finish: typeof (r as any).finish === 'string' ? (r as any).finish : undefined,
      color: typeof (r as any).color === 'string' ? (r as any).color : undefined,
    })
  }
  return out
}

function load() {
  try {
    const raw = lsGet(CART_KEY)
    items.value = raw ? sanitize(JSON.parse(raw)) : []
  } catch {
    items.value = []
  }
}

function persist() {
  if (items.value.length) lsSetJson(CART_KEY, items.value)
  else lsRemove(CART_KEY)
}

function start() {
  if (started || !import.meta.client) return
  started = true
  load()
  // synchronisation entre onglets
  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY || e.key === null) load()
  })
}

const sameLine = (a: CartItem, productId: string, finish?: string, color?: string) =>
  a.productId === productId && (a.finish ?? '') === (finish ?? '') && (a.color ?? '') === (color ?? '')

/**
 * Liste de produits à chiffrer (« panier » de la vitrine), persistée dans `ecobloc:cart`.
 * `count` = nombre de lignes (pas la somme des quantités, souvent en centaines de pièces).
 */
export function useCart() {
  start()
  const count = computed(() => items.value.length)

  function add(productId: string, qty = 1, opts: { finish?: string; color?: string } = {}) {
    const n = Math.max(1, Math.floor(qty) || 1)
    const line = items.value.find((i) => sameLine(i, productId, opts.finish, opts.color))
    if (line) line.qty = Math.min(line.qty + n, MAX_QTY)
    else items.value.push({ productId, qty: Math.min(n, MAX_QTY), finish: opts.finish, color: opts.color })
    persist()
  }

  /** Fixe la quantité d'une ligne (≤ 0 : la ligne est retirée) */
  function setQty(productId: string, qty: number, opts: { finish?: string; color?: string } = {}) {
    const n = Math.floor(qty)
    const idx = items.value.findIndex((i) => sameLine(i, productId, opts.finish, opts.color))
    if (idx < 0) return
    if (!Number.isFinite(n) || n <= 0) items.value.splice(idx, 1)
    else items.value[idx]!.qty = Math.min(n, MAX_QTY)
    persist()
  }

  function remove(productId: string, opts: { finish?: string; color?: string } = {}) {
    const hasOpts = opts.finish !== undefined || opts.color !== undefined
    items.value = items.value.filter((i) => !(hasOpts ? sameLine(i, productId, opts.finish, opts.color) : i.productId === productId))
    persist()
  }

  function clear() {
    items.value = []
    persist()
  }

  const has = (productId: string) => items.value.some((i) => i.productId === productId)

  return { items: items as Ref<CartItem[]>, add, setQty, remove, clear, count, has }
}
