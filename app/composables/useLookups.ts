import type { CollectionMap, CollectionName } from '#shared/types/domain'

/**
 * Jointures d'affichage : renvoie le libellé d'une ligne liée sans filtrage par rôle (`db.peek`).
 *   const L = useLookups(); L.productName(line.productId)
 */
export function useLookups() {
  const db = useDb()
  const pick = <C extends CollectionName>(c: C, id: string | null | undefined, key: string): string => {
    if (!id) return '—'
    const row = db.peek(c, id) as Record<string, any> | undefined
    return (row?.[key] as string | undefined) ?? '—'
  }
  return {
    peek: <C extends CollectionName>(c: C, id?: string | null): CollectionMap[C] | undefined => (id ? (db.peek(c, id) as CollectionMap[C] | undefined) : undefined),
    productName: (id?: string | null) => pick('products', id, 'name'),
    productRef: (id?: string | null) => pick('products', id, 'ref'),
    userName: (id?: string | null) => pick('users', id, 'name'),
    companyName: (id?: string | null) => pick('companies', id, 'name'),
    supplierName: (id?: string | null) => pick('suppliers', id, 'name'),
    carrierName: (id?: string | null) => pick('carriers', id, 'name'),
    lotRef: (id?: string | null) => pick('productionLots', id, 'ref'),
    rawLotRef: (id?: string | null) => pick('rawLots', id, 'ref'),
    orderRef: (id?: string | null) => pick('orders', id, 'ref'),
    quoteRef: (id?: string | null) => pick('quotes', id, 'ref'),
    workOrderRef: (id?: string | null) => pick('workOrders', id, 'ref'),
    locationName: (id?: string | null) => pick('stockLocations', id, 'name'),
    zoneName: (id?: string | null) => (id ? (useSettings().value.zones.find((z) => z.id === id)?.name ?? '—') : '—'),
  }
}
