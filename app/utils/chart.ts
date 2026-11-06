/** Aides pures des graphiques (couleurs via variables CSS, échelles lisibles). */
export type ChartTone = 1 | 2 | 3 | 4 | 5 | 'primary' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'muted'

/**
 * Couleur d'une série. Sans `tone`, l'ordre catégoriel est FIXE (1→5) : la couleur suit l'entité, jamais son rang.
 * Les teintes d'état (success/warning/danger) restent réservées aux états.
 */
export function toneVar(tone: ChartTone | undefined, index = 0): string {
  if (typeof tone === 'number') return `var(--chart-${tone})`
  switch (tone) {
    case 'primary': return 'var(--chart-1)'
    case 'info': return 'var(--chart-2)'
    case 'accent': return 'var(--chart-3)'
    case 'success': return 'var(--success)'
    case 'warning': return 'var(--warning)'
    case 'danger': return 'var(--danger)'
    case 'neutral':
    case 'muted': return 'var(--muted)'
    default: return `var(--chart-${(index % 5) + 1})`
  }
}

/** Plus grand « joli » majorant (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(max: number): number {
  if (!isFinite(max) || max <= 0) return 1
  const exp = Math.floor(Math.log10(max))
  const base = 10 ** exp
  const f = max / base
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * base
}

export function ticks(max: number, count = 4): number[] {
  const top = niceMax(max)
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i)
}

/** Format compact : 1 250 000 → « 1,25 M », 12 400 → « 12,4 k ». */
export function compact(n: number): string {
  const abs = Math.abs(n)
  const f = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)
  if (abs >= 1e9) return `${f(n / 1e9)} Md`
  if (abs >= 1e6) return `${f(n / 1e6)} M`
  if (abs >= 1e4) return `${f(n / 1e3)} k`
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)
}
