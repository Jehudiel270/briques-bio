/**
 * Couche de services métier EcoBloc (fonctions pures `(db, input) => résultat`).
 * `useServices()` renvoie `bindServices(useDb())` : mêmes services, sans le paramètre `db`.
 */
import type { Db } from '../utils/db-core'
import { catalog } from './catalog'
import { collections } from './collections'
import { deliveries } from './deliveries'
import { env } from './env'
import { inventory } from './inventory'
import { orders } from './orders'
import { production } from './production'
import { quality } from './quality'
import { quotes } from './quotes'
import { receipts } from './receipts'

export { ServiceError } from './errors'
export { canRequestQuote, computeTotals, deliveryFeeFor, isOrderable, priceGridFor, productStock, rawStockByPolymer, unitPriceFor } from './pricing'
export type { ProductStock, RawStock, Totals, TotalsInput } from './pricing'
export { meetsCriterion, templatesFor } from './quality'

export const services = { quotes, orders, deliveries, collections, receipts, inventory, production, quality, env, catalog }

export type Services = typeof services

type DropDb<F> = F extends (db: Db, ...args: infer A) => infer R ? (...args: A) => R : never
export type BoundServices = { [S in keyof Services]: { [K in keyof Services[S]]: DropDb<Services[S][K]> } }

/** Renvoie les mêmes services avec `db` déjà lié (chaque fonction perd son premier paramètre). */
export function bindServices(db: Db): BoundServices {
  const out: Record<string, Record<string, (...args: any[]) => unknown>> = {}
  for (const [name, svc] of Object.entries(services)) {
    out[name] = {}
    for (const [fnName, fn] of Object.entries(svc as Record<string, (db: Db, ...args: any[]) => unknown>)) {
      out[name]![fnName] = (...args: any[]) => fn(db, ...args)
    }
  }
  return out as unknown as BoundServices
}
