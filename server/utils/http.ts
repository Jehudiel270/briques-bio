/** Aides HTTP du serveur : erreurs françaises sans fuite d'information, limitation de débit simple. */
import type { H3Event } from 'h3'
import { HttpError } from './rbac'

export function toHttp(e: unknown): never {
  if (e instanceof HttpError) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
  if (e && typeof e === 'object' && 'statusCode' in e) throw e
  console.error('[EcoBloc] erreur serveur', e instanceof Error ? e.message : 'inconnue')
  throw createError({ statusCode: 500, statusMessage: 'Une erreur interne est survenue : réessayez dans un instant.' })
}

const hits = new Map<string, number[]>()

/** Limite en mémoire (par instance) : `max` appels par fenêtre de `windowMs` et par clé. */
export function rateLimit(event: H3Event, bucket: string, max: number, windowMs = 60_000, now = Date.now()) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'inconnue'
  const key = `${bucket}:${ip}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    throw createError({ statusCode: 429, statusMessage: 'Trop de requêtes : patientez une minute puis réessayez.' })
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
}

