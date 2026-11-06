import { computed, type ComputedRef } from 'vue'
import type { AppSettings } from '#shared/types/domain'

/** Valeurs de repli si la ligne `settings` n'est pas (encore) chargée */
function fallbackSettings(appName: string): AppSettings {
  return {
    id: 'company',
    brand: { name: appName, tagline: 'Matériaux d’aménagement issus de plastiques valorisés', monogram: appName.slice(0, 2).toUpperCase() },
    company: { legalName: appName, address: '', city: 'Cotonou', country: 'Bénin', phone: '', email: '' },
    currency: 'XOF',
    vatRatePct: 18,
    defaultDepositPct: 30,
    quoteValidityDays: 30,
    zones: [],
    polymers: [],
    rawThresholdsKg: {},
    features: { collectorPayouts: true, distributorPortfolio: true, proPriceGrid: true, publicImpactPage: true },
    demoBanner: 'Prototype de démonstration : toutes les données, documents, prix et paiements sont fictifs.',
  }
}

let cached: ComputedRef<AppSettings> | null = null

/** Paramètres de l'application (ligne `settings/company`) ; toujours défini. */
export function useSettings(): ComputedRef<AppSettings> {
  if (cached) return cached
  const db = useDb()
  const appName = String((useRuntimeConfig().public as any).appName || 'EcoBloc')
  const fallback = fallbackSettings(appName)
  cached = computed(() => db.peek('settings', 'company') ?? fallback)
  return cached
}
