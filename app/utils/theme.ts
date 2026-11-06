/**
 * Logique pure du thème (sans Vue ni Nuxt) : état persistant, validation,
 * lecture des valeurs par défaut dans main.css, application sur <html>.
 * Format de stockage (clé `ecobloc:theme`), lu aussi par le script anti-flash de nuxt.config.ts :
 *   { mode, density, radius, overrides: { light: { <token>: <couleur> }, dark: { … } } }
 * où <token> est le nom de variable CSS sans « -- » (ex. « primary », « surface-2 »).
 */
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeName = 'light' | 'dark'
export type RadiusKey = 'sharp' | 'soft' | 'round'
export type DensityKey = 'compact' | 'comfortable'
export type ThemeOverrides = Record<ThemeName, Record<string, string>>

export interface ThemeState {
  mode: ThemeMode
  density: DensityKey
  radius: RadiusKey
  overrides: ThemeOverrides
}

export const THEME_STORAGE_KEY = 'ecobloc:theme'
export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
export const RADIUS_KEYS: RadiusKey[] = ['sharp', 'soft', 'round']
export const DENSITY_KEYS: DensityKey[] = ['compact', 'comfortable']

export const THEME_MODE_LABEL: Record<ThemeMode, string> = { light: 'Clair', dark: 'Sombre', system: 'Système' }
export const RADIUS_LABEL: Record<RadiusKey, string> = { sharp: 'Angles droits', soft: 'Angles adoucis', round: 'Angles arrondis' }
export const DENSITY_LABEL: Record<DensityKey, string> = { compact: 'Compacte', comfortable: 'Confortable' }

export interface ThemeTokenMeta {
  key: string
  label: string
  group: 'Fonds et texte' | 'Marque' | 'États'
  hint?: string
}

/** Tokens de couleur modifiables depuis l'éditeur de thème (toutes les variables couleur de main.css). */
export const THEME_TOKEN_META: ThemeTokenMeta[] = [
  { key: 'bg', label: 'Fond de page', group: 'Fonds et texte' },
  { key: 'surface', label: 'Surface (cartes, panneaux)', group: 'Fonds et texte' },
  { key: 'surface-2', label: 'Surface secondaire', group: 'Fonds et texte', hint: 'Bandeaux, lignes de tableau, motif de pavés.' },
  { key: 'border', label: 'Filets et bordures', group: 'Fonds et texte' },
  { key: 'ink', label: 'Texte principal', group: 'Fonds et texte' },
  { key: 'muted', label: 'Texte secondaire', group: 'Fonds et texte' },
  { key: 'primary', label: 'Couleur principale', group: 'Marque', hint: 'Boutons principaux, liens actifs.' },
  { key: 'primary-ink', label: 'Texte sur couleur principale', group: 'Marque' },
  { key: 'accent', label: 'Accent', group: 'Marque', hint: 'Mise en évidence, focus, repères.' },
  { key: 'accent-ink', label: 'Texte sur accent', group: 'Marque' },
  { key: 'success', label: 'Succès', group: 'États' },
  { key: 'warning', label: 'Alerte', group: 'États' },
  { key: 'danger', label: 'Erreur', group: 'États' },
  { key: 'info', label: 'Information', group: 'États' },
]
export const THEME_TOKEN_KEYS = THEME_TOKEN_META.map((t) => t.key)

export const defaultThemeState = (): ThemeState => ({
  mode: 'system',
  density: 'comfortable',
  radius: 'soft',
  overrides: { light: {}, dark: {} },
})

// ------------------------------------------------------------------ Couleurs
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FN_RE = /^(?:rgba?|hsla?|oklch|oklab)\(\s*[0-9a-z%.,/\s-]+\)$/i

/** Couleur CSS simple acceptée dans les surcharges (hexadécimal ou rgb/hsl/oklch). */
export function isValidColor(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const v = value.trim()
  return v.length <= 64 && (HEX_RE.test(v) || FN_RE.test(v))
}

/** `#abc` → `#aabbcc` ; renvoie null si la couleur n'est pas un hexadécimal exploitable. */
export function normalizeHex(value: string): string | null {
  const v = value.trim()
  if (!HEX_RE.test(v)) return null
  let h = v.slice(1)
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
  return `#${h.slice(0, 6).toLowerCase()}`
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales (null si non calculable). */
export function contrastRatio(a: string, b: string): number | null {
  const ha = normalizeHex(a)
  const hb = normalizeHex(b)
  if (!ha || !hb) return null
  const la = luminance(ha)
  const lb = luminance(hb)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ------------------------------------------------------------------ Valeurs par défaut lues dans main.css
export type ThemeDefaults = Record<ThemeName, Record<string, string>>

function readDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const key = m[1]!
    const value = m[2]!.trim()
    if (THEME_TOKEN_KEYS.includes(key) && isValidColor(value)) out[key] = value
  }
  return out
}

/** Extrait les couleurs des blocs `:root, [data-theme="light"]` et `[data-theme="dark"]` d'un fichier CSS. */
export function parseThemeDefaults(css: string): ThemeDefaults {
  const lightBlock = /:root\s*,\s*\[data-theme="light"\]\s*\{([^}]*)\}/.exec(css) ?? /:root\s*\{([^}]*)\}/.exec(css)
  const dark = /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)
  return {
    light: lightBlock ? readDeclarations(lightBlock[1]!) : {},
    dark: dark ? readDeclarations(dark[1]!) : {},
  }
}

// ------------------------------------------------------------------ État
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Nettoie un état lu depuis le stockage : valeurs inconnues ou invalides ignorées. */
export function sanitizeThemeState(raw: unknown): ThemeState {
  const out = defaultThemeState()
  if (!isRecord(raw)) return out
  if (THEME_MODES.includes(raw.mode as ThemeMode)) out.mode = raw.mode as ThemeMode
  if (DENSITY_KEYS.includes(raw.density as DensityKey)) out.density = raw.density as DensityKey
  if (RADIUS_KEYS.includes(raw.radius as RadiusKey)) out.radius = raw.radius as RadiusKey
  if (isRecord(raw.overrides)) {
    for (const theme of ['light', 'dark'] as ThemeName[]) {
      const src = raw.overrides[theme]
      if (!isRecord(src)) continue
      for (const [k, v] of Object.entries(src)) {
        if (THEME_TOKEN_KEYS.includes(k) && isValidColor(v)) out.overrides[theme][k] = v.trim()
      }
    }
  }
  return out
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ThemeName {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
}

/** Plus petit sous-ensemble de HTMLElement utilisé par applyTheme (permet un faux élément en test). */
export interface ThemeTarget {
  setAttribute(name: string, value: string): void
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown }
}

/** Applique thème, rayon, densité et surcharges de couleurs sur l'élément racine. */
export function applyTheme(root: ThemeTarget, state: ThemeState, resolved: ThemeName): void {
  root.setAttribute('data-theme', resolved)
  root.setAttribute('data-radius', state.radius)
  root.setAttribute('data-density', state.density)
  const overrides = state.overrides[resolved] ?? {}
  for (const key of THEME_TOKEN_KEYS) {
    const v = overrides[key]
    if (v && isValidColor(v)) root.style.setProperty(`--${key}`, v)
    else root.style.removeProperty(`--${key}`)
  }
}

/** Nombre de surcharges de couleur actives (pour l'éditeur). */
export const countOverrides = (state: ThemeState) => Object.values(state.overrides).reduce((n, o) => n + Object.keys(o).length, 0)
