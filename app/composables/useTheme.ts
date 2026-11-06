/**
 * Thème de l'interface : mode clair / sombre / système, surcharges de couleurs par thème,
 * rayon des angles et densité. État partagé (singleton), persisté dans `ecobloc:theme`
 * et appliqué sur <html> (`data-theme`, `data-radius`, `data-density`, variables CSS).
 * La logique pure vit dans `~/utils/theme` (testée) ; les valeurs par défaut sont lues dans main.css.
 */
import { computed, effectScope, reactive, ref, toRef, watch } from 'vue'
// @ts-ignore — import brut de la feuille de style (type fourni par vite/client)
import mainCss from '~/assets/css/main.css?raw'
import { lsGetJson, lsSetJson } from '~/utils/storage'
import {
  THEME_STORAGE_KEY,
  THEME_TOKEN_KEYS,
  THEME_TOKEN_META,
  applyTheme,
  defaultThemeState,
  isValidColor,
  parseThemeDefaults,
  resolveTheme,
  sanitizeThemeState,
  type DensityKey,
  type RadiusKey,
  type ThemeMode,
  type ThemeName,
  type ThemeState,
} from '~/utils/theme'

const state = reactive<ThemeState>(defaultThemeState())
const prefersDark = ref(false)
const resolved = computed<ThemeName>(() => resolveTheme(state.mode, prefersDark.value))
const defaults = parseThemeDefaults(typeof mainCss === 'string' ? mainCss : '')
let started = false

const readStored = () => sanitizeThemeState(lsGetJson<unknown>(THEME_STORAGE_KEY, null))

function assign(next: ThemeState) {
  state.mode = next.mode
  state.density = next.density
  state.radius = next.radius
  state.overrides = next.overrides
}

function start() {
  if (started || !import.meta.client) return
  started = true
  assign(readStored())
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  prefersDark.value = !!mq?.matches
  mq?.addEventListener?.('change', (e) => {
    prefersDark.value = e.matches
  })
  // watcher indépendant de tout composant : il vit aussi longtemps que l'application
  effectScope(true).run(() => {
    watch(
      () => [state.mode, state.density, state.radius, JSON.stringify(state.overrides), prefersDark.value],
      () => {
        applyTheme(document.documentElement, state, resolved.value)
        lsSetJson(THEME_STORAGE_KEY, { mode: state.mode, density: state.density, radius: state.radius, overrides: state.overrides })
      },
      { immediate: true },
    )
  })
  // synchronisation entre onglets
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) assign(readStored())
  })
}

const defaultFor = (theme: ThemeName, key: string): string => defaults[theme][key] ?? ''

export function useTheme() {
  start()

  const setMode = (mode: ThemeMode) => {
    state.mode = mode
  }
  const setRadius = (radius: RadiusKey) => {
    state.radius = radius
  }
  const setDensity = (density: DensityKey) => {
    state.density = density
  }

  /** Bascule clair ↔ sombre à partir du thème effectivement affiché */
  const toggle = () => setMode(resolved.value === 'dark' ? 'light' : 'dark')

  /**
   * Surcharge une couleur d'un thème. Une valeur vide (ou identique à la valeur par défaut) retire la surcharge.
   * Renvoie false si la clé est inconnue ou la couleur invalide.
   */
  function setOverride(theme: ThemeName, key: string, value: string): boolean {
    if (!THEME_TOKEN_KEYS.includes(key)) return false
    const next = { ...state.overrides[theme] }
    const v = value.trim()
    if (!v || v.toLowerCase() === defaultFor(theme, key).toLowerCase()) delete next[key]
    else if (isValidColor(v)) next[key] = v
    else return false
    state.overrides = { ...state.overrides, [theme]: next }
    return true
  }

  /** Retire les surcharges d'un thème (ou des deux) */
  function resetOverrides(theme?: ThemeName) {
    state.overrides = theme ? { ...state.overrides, [theme]: {} } : { light: {}, dark: {} }
  }

  /** Valeur effective d'un token : surcharge sinon valeur par défaut de main.css */
  const valueFor = (theme: ThemeName, key: string) => state.overrides[theme][key] ?? defaultFor(theme, key)
  const isOverridden = (theme: ThemeName, key: string) => key in state.overrides[theme]

  const exportState = () => JSON.stringify({ mode: state.mode, density: state.density, radius: state.radius, overrides: state.overrides }, null, 2)
  function importState(json: string): boolean {
    try {
      assign(sanitizeThemeState(JSON.parse(json)))
      return true
    } catch {
      return false
    }
  }

  return {
    mode: toRef(state, 'mode'),
    resolved,
    setMode,
    toggle,
    overrides: toRef(state, 'overrides'),
    setOverride,
    resetOverrides,
    radius: toRef(state, 'radius'),
    density: toRef(state, 'density'),
    setRadius,
    setDensity,
    /** Tokens de couleur éditables (clé, libellé, groupe) */
    tokens: THEME_TOKEN_META,
    /** Valeurs par défaut par thème, lues dans main.css */
    defaults,
    defaultFor,
    valueFor,
    isOverridden,
    exportState,
    importState,
  }
}
