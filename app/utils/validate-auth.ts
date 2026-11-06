/**
 * Validation des formulaires de connexion et d'inscription (messages en français, actionnables).
 * Fonctions pures : chaque erreur dit ce qui ne va pas et comment le corriger.
 */
import type { RoleKey } from '../../shared/types/domain'
import { SELF_SIGNUP_ROLES } from '../../shared/utils/roles'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export type FieldErrors<K extends string> = Partial<Record<K, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isEmail = (v: string) => EMAIL_RE.test(v.trim())

export interface LoginValues {
  email: string
  password: string
}

export function validateLogin(v: LoginValues): FieldErrors<keyof LoginValues> {
  const e: FieldErrors<keyof LoginValues> = {}
  if (!v.email.trim()) e.email = 'Saisissez votre adresse e-mail.'
  else if (!isEmail(v.email)) e.email = 'Adresse e-mail invalide : vérifiez sa forme (nom@domaine.bj).'
  if (!v.password) e.password = 'Saisissez votre mot de passe.'
  return e
}

export interface SignUpValues {
  name: string
  email: string
  password: string
  confirm: string
  role: RoleKey | ''
  terms: boolean
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Choisissez un mot de passe.'
  if (password.length < PASSWORD_MIN) return `Le mot de passe est trop court : utilisez au moins ${PASSWORD_MIN} caractères.`
  if (password.length > PASSWORD_MAX) return `Le mot de passe est trop long : ${PASSWORD_MAX} caractères au maximum.`
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Ajoutez au moins une lettre et un chiffre au mot de passe.'
  return undefined
}

export function validateSignUp(v: SignUpValues): FieldErrors<keyof SignUpValues> {
  const e: FieldErrors<keyof SignUpValues> = {}
  const name = v.name.trim()
  if (!name) e.name = 'Indiquez votre nom complet.'
  else if (name.length < 2) e.name = 'Le nom est trop court : indiquez au moins 2 caractères.'
  else if (name.length > 80) e.name = 'Le nom est trop long : 80 caractères au maximum.'
  if (!v.email.trim()) e.email = 'Saisissez votre adresse e-mail.'
  else if (!isEmail(v.email)) e.email = 'Adresse e-mail invalide : vérifiez sa forme (nom@domaine.bj).'
  const pw = validatePassword(v.password)
  if (pw) e.password = pw
  if (!v.confirm) e.confirm = 'Saisissez à nouveau le mot de passe.'
  else if (v.confirm !== v.password) e.confirm = 'Les deux mots de passe sont différents : saisissez-les à l’identique.'
  if (!v.role) e.role = 'Choisissez le type de compte qui vous correspond.'
  else if (!SELF_SIGNUP_ROLES.includes(v.role)) e.role = 'Ce type de compte est créé par l’administration : choisissez-en un autre.'
  if (!v.terms) e.terms = 'Acceptez les conditions pour créer le compte.'
  return e
}

export const hasErrors = (e: Record<string, unknown>) => Object.values(e).some(Boolean)

/** Ne conserve qu'une redirection interne (jamais d'URL externe ni de « // »). */
export function safeRedirect(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return null
  return v
}
