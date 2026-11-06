/**
 * Logique pure des layouts : fil d'Ariane, onglets bas mobiles, entrées de recherche globale.
 * Aucun import Nuxt : testable sous vitest.
 */
import type { RoleKey } from '../../shared/types/domain'
import { norm } from '../../shared/utils/format'
import { ADMIN_NAV, OPS_NAV, isActive, visibleGroups, type NavGroup, type NavItem } from './nav'

export interface Crumb {
  label: string
  to?: string
}

export const flattenNav = (groups: NavGroup[]): NavItem[] => groups.flatMap((g) => g.items)

/** Entrée de navigation la plus spécifique pour un chemin (préfixe le plus long). */
export function bestNavMatch(items: NavItem[], path: string): NavItem | undefined {
  let best: NavItem | undefined
  let bestLen = -1
  for (const it of items) {
    if (!isActive(it, path)) continue
    const len = (it.match ?? it.to).length
    if (len > bestLen) {
      best = it
      bestLen = len
    }
  }
  return best
}

const NEW_SEGMENTS = new Set(['nouveau', 'nouvelle'])

export function buildBreadcrumbs(opts: { path: string; items: NavItem[]; root: Crumb; pageTitle?: string }): Crumb[] {
  const { path, items, root, pageTitle } = opts
  const crumbs: Crumb[] = [{ label: root.label, to: root.to }]
  const item = bestNavMatch(items, path)
  if (item && item.to !== root.to) crumbs.push({ label: item.label, to: item.to })
  const base = item ? (item.match ?? item.to) : root.to
  const deeper = !!base && path.length > base.length && path.startsWith(base + '/')
  if (deeper) {
    const last = path.replace(/\/+$/, '').split('/').pop() ?? ''
    crumbs.push({ label: pageTitle || (NEW_SEGMENTS.has(last) ? 'Nouveau' : 'Détail') })
  }
  // le dernier élément est la page courante : pas de lien
  const lastCrumb = crumbs[crumbs.length - 1]
  if (lastCrumb) lastCrumb.to = undefined
  return crumbs
}

/** Partage des entrées pour la barre d'onglets basse : `max` onglets, le reste dans « Plus ». */
export function splitTabs(items: NavItem[], max = 5): { tabs: NavItem[]; more: NavItem[] } {
  if (items.length <= max) return { tabs: items, more: [] }
  return { tabs: items.slice(0, max - 1), more: items.slice(max - 1) }
}

export interface SearchEntry {
  label: string
  to: string
  icon: string
  section: string
}

/** Toutes les pages de la console accessibles à un rôle (modules /ops/* et /admin). */
export function consoleSearchEntries(role: RoleKey | undefined): SearchEntry[] {
  const out: SearchEntry[] = []
  for (const zone of Object.values(OPS_NAV)) {
    if (!role || !zone.roles.includes(role)) continue
    for (const g of visibleGroups(zone.groups, role)) {
      for (const it of g.items) out.push({ label: it.label, to: it.to, icon: it.icon, section: zone.title })
    }
  }
  if (role === 'admin') {
    for (const g of visibleGroups(ADMIN_NAV, role)) {
      for (const it of g.items) out.push({ label: it.label, to: it.to, icon: it.icon, section: g.title ? `Administration, ${g.title.toLowerCase()}` : 'Administration' })
    }
  }
  return out
}

/** Recherche tolérante (accents, casse, mots dans le désordre) ; meilleurs résultats d'abord. */
export function searchEntries(entries: SearchEntry[], query: string, limit = 50): SearchEntry[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return entries.slice(0, limit)
  const scored: { e: SearchEntry; score: number }[] = []
  for (const e of entries) {
    const label = norm(e.label)
    const hay = `${label} ${norm(e.section)}`
    let score = 0
    let ok = true
    for (const t of tokens) {
      if (label.startsWith(t)) score += 4
      else if (label.split(/[\s'’-]+/).some((w) => w.startsWith(t))) score += 3
      else if (label.includes(t)) score += 2
      else if (hay.includes(t)) score += 1
      else {
        ok = false
        break
      }
    }
    if (ok) scored.push({ e, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.e)
}

/** Module (clé de OPS_NAV) pour un chemin /ops/<module>/… ; `admin` pour /admin. */
export function consoleModuleOf(path: string): 'admin' | keyof typeof OPS_NAV | null {
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin'
  const m = /^\/ops\/([^/]+)/.exec(path)
  return m && OPS_NAV[m[1]!] ? (m[1] as keyof typeof OPS_NAV) : null
}

/** Layout d'une route (zones du contrat §5). */
export function layoutForPath(path: string): 'public' | 'client' | 'field' | 'console' {
  if (path === '/espace' || path.startsWith('/espace/')) return 'client'
  if (path === '/collecte' || path.startsWith('/collecte/') || path === '/terrain' || path.startsWith('/terrain/')) return 'field'
  if (path === '/admin' || path.startsWith('/admin/') || path === '/ops' || path.startsWith('/ops/')) return 'console'
  return 'public'
}
