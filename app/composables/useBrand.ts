import { computed, type ComputedRef } from 'vue'

export interface Brand {
  name: string
  tagline: string
  monogram: string
  logoUrl: string | undefined
}

export type BrandRef = ComputedRef<Brand> & Brand

let cached: BrandRef | null = null

/**
 * Identité de marque issue des paramètres.
 * Utilisable de deux façons : `brand.name` ou `brand.value.name` (ref calculée dotée des mêmes propriétés).
 */
export function useBrand(): BrandRef {
  if (cached) return cached
  const settings = useSettings()
  const brand = computed<Brand>(() => {
    const b = settings.value.brand
    return { name: b.name, tagline: b.tagline, monogram: b.monogram, logoUrl: b.logoUrl }
  })
  for (const key of ['name', 'tagline', 'monogram', 'logoUrl'] as const) {
    Object.defineProperty(brand, key, { get: () => brand.value[key], enumerable: true })
  }
  cached = brand as BrandRef
  return cached
}
