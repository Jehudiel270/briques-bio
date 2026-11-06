const NBSP = ' '

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/** 12500 → « 12 500 FCFA » */
export const fcfa = (n: number | null | undefined, opts: { unit?: boolean } = {}) =>
  n == null || Number.isNaN(n) ? '—' : `${nf0.format(Math.round(n))}${opts.unit === false ? '' : `${NBSP}FCFA`}`

export const num = (n: number | null | undefined, digits: 0 | 1 | 2 = 0) =>
  n == null || Number.isNaN(n) ? '—' : (digits === 0 ? nf0 : digits === 1 ? nf1 : nf2).format(n)

export const kg = (n: number | null | undefined) => (n == null ? '—' : `${n >= 1000 ? nf2.format(n / 1000) + NBSP + 't' : nf1.format(n) + NBSP + 'kg'}`)
export const pct = (n: number | null | undefined, digits: 0 | 1 = 1) => (n == null || Number.isNaN(n) ? '—' : `${(digits === 0 ? nf0 : nf1).format(n)}${NBSP}%`)

const dfDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
const dfDateTime = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const dfShort = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })
const dfMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

const toDate = (v: string | number | Date | undefined | null) => (v ? new Date(v) : null)
export const fdate = (v?: string | number | Date | null) => {
  const d = toDate(v)
  return d && !Number.isNaN(+d) ? dfDate.format(d) : '—'
}
export const fdatetime = (v?: string | number | Date | null) => {
  const d = toDate(v)
  return d && !Number.isNaN(+d) ? dfDateTime.format(d) : '—'
}
export const fshort = (v?: string | number | Date | null) => {
  const d = toDate(v)
  return d && !Number.isNaN(+d) ? dfShort.format(d) : '—'
}
export const fmonth = (period: string) => {
  const d = new Date(`${period}-01T00:00:00`)
  return Number.isNaN(+d) ? period : dfMonth.format(d)
}

/** « il y a 3 h », « dans 2 j » */
export function relTime(v?: string | number | Date | null, now: number = Date.now()) {
  const d = toDate(v)
  if (!d || Number.isNaN(+d)) return '—'
  const diff = (+d - now) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return dfDate.format(d)
}

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${Math.abs(n) > 1 ? many : one}`
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
export const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
export const clampNum = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const isoNow = () => new Date().toISOString()
export const addDays = (d: Date | string, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x.toISOString()
}

/** Normalise pour la recherche : minuscules, sans accents */
export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const UNIT_LABEL: Record<string, string> = { piece: 'pièce', m2: 'm²', ml: 'ml', pallet: 'palette', kg: 'kg', unit: 'unité' }
export const unitLabel = (u: string) => UNIT_LABEL[u] ?? u

/** Adresse sur une ligne : « rue, ville ». */
export const fmtAddress = (a?: { line?: string; city?: string; label?: string } | null) =>
  a ? [a.label, a.line, a.city].filter(Boolean).join(', ') || '—' : '—'
/** Nombre de jours entre maintenant et une date (négatif si passée). */
export const daysUntil = (v?: string | number | Date | null) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86_400_000) : null)
