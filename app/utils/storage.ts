/**
 * Accès sûr à localStorage / sessionStorage : ne lève jamais (navigation privée,
 * stockage bloqué, quota dépassé) et fonctionne sans navigateur (tests, SSR).
 */
type Kind = 'local' | 'session'

function store(kind: Kind): Storage | null {
  try {
    const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage }
    return (kind === 'local' ? g.localStorage : g.sessionStorage) ?? null
  } catch {
    return null
  }
}

export function lsGet(key: string, kind: Kind = 'local'): string | null {
  try {
    return store(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function lsSet(key: string, value: string, kind: Kind = 'local'): boolean {
  try {
    const s = store(kind)
    if (!s) return false
    s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function lsRemove(key: string, kind: Kind = 'local'): void {
  try {
    store(kind)?.removeItem(key)
  } catch {
    /* ignoré */
  }
}

export function lsGetJson<T>(key: string, fallback: T, kind: Kind = 'local'): T {
  const raw = lsGet(key, kind)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function lsSetJson(key: string, value: unknown, kind: Kind = 'local'): boolean {
  try {
    return lsSet(key, JSON.stringify(value), kind)
  } catch {
    return false
  }
}
