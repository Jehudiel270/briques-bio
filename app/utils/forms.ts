/**
 * Types et logique pure des formulaires (UiFormDialog). Aucun import Nuxt : testable sous vitest.
 */
export type FieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'currency' | 'select' | 'multiselect'
  | 'checkbox' | 'switch' | 'date' | 'datetime' | 'color' | 'tags' | 'media'

export interface FieldOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: FieldOption[]
  required?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
  hint?: string
  /** Largeur : 1 = demi-ligne (défaut), 2 = pleine ligne */
  span?: 1 | 2
  rows?: number
  /** Dossier Cloudinary pour le type `media` */
  folder?: string
  multiple?: boolean
  validate?: (value: any, all: Record<string, any>) => string | undefined
  showIf?: (all: Record<string, any>) => boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^[+()\d\s.-]{6,20}$/

export function isEmpty(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** Valeur initiale d'un champ selon son type. */
export function defaultValue(f: FieldDef): unknown {
  switch (f.type) {
    case 'checkbox':
    case 'switch':
      return false
    case 'multiselect':
    case 'tags':
      return []
    case 'media':
      return f.multiple ? [] : undefined
    case 'number':
    case 'currency':
      return null
    default:
      return ''
  }
}

export function initialValues(fields: FieldDef[], initial?: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    const given = initial?.[f.key]
    out[f.key] = given === undefined ? defaultValue(f) : Array.isArray(given) ? [...given] : given
  }
  return out
}

export function isVisible(f: FieldDef, values: Record<string, any>): boolean {
  return f.showIf ? !!f.showIf(values) : true
}

/** Message d'erreur d'un champ, ou undefined s'il est valide. Les champs masqués ne sont jamais validés. */
export function validateField(f: FieldDef, values: Record<string, any>): string | undefined {
  if (!isVisible(f, values)) return undefined
  const v = values[f.key]
  const required = f.required && f.type !== 'checkbox' && f.type !== 'switch'
  if (required && isEmpty(v)) return `${f.label} : renseignez ce champ.`
  if (f.required && f.type === 'checkbox' && v !== true) return `${f.label} : cochez la case pour continuer.`
  if (isEmpty(v)) return f.validate?.(v, values)
  if (f.type === 'email' && !EMAIL.test(String(v).trim())) return 'Saisissez une adresse e-mail valide (ex. nom@exemple.com).'
  if (f.type === 'tel' && !PHONE.test(String(v).trim())) return 'Saisissez un numéro de téléphone valide (chiffres, espaces, +).'
  if (f.type === 'number' || f.type === 'currency') {
    const n = Number(v)
    if (!Number.isFinite(n)) return 'Saisissez un nombre.'
    if (f.min != null && n < f.min) return `La valeur minimale est ${f.min}.`
    if (f.max != null && n > f.max) return `La valeur maximale est ${f.max}.`
    if (f.step && f.step >= 1 && !Number.isInteger(n / f.step)) return `Saisissez un multiple de ${f.step}.`
  }
  if ((f.type === 'text' || f.type === 'textarea') && typeof v === 'string') {
    if (f.min != null && v.trim().length < f.min) return `Saisissez au moins ${f.min} caractères.`
    if (f.max != null && v.length > f.max) return `Saisissez au plus ${f.max} caractères.`
  }
  return f.validate?.(v, values)
}

/** Erreurs de tous les champs visibles (objet vide = formulaire valide). */
export function validateAll(fields: FieldDef[], values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const e = validateField(f, values)
    if (e) errors[f.key] = e
  }
  return errors
}

/** Valeurs à envoyer : champs masqués retirés, chaînes rognées, nombres convertis, vides → undefined. */
export function cleanValues(fields: FieldDef[], values: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) {
    if (!isVisible(f, values)) continue
    let v = values[f.key]
    if (typeof v === 'string') v = v.trim()
    if (f.type === 'number' || f.type === 'currency') v = isEmpty(v) ? undefined : Number(v)
    if (v === '') v = undefined
    out[f.key] = v
  }
  return out
}
