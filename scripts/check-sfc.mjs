#!/usr/bin/env node
/**
 * Vérification rapide des composants Vue (sans lancer Nuxt) :
 *  - compile script + template de chaque .vue (erreurs de syntaxe) ;
 *  - signale les composants PascalCase du template introuvables (auto-import Nuxt : app/components/**, ou import explicite).
 *
 * Usage : node scripts/check-sfc.mjs [fichiers ou dossiers…]   (défaut : app/)
 * Ce n'est PAS un contrôle de types : `nuxt typecheck` reste la référence en fin de chantier.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const root = resolve(import.meta.dirname, '..')
const compDir = join(root, 'app', 'components')

const walk = (p, out = []) => {
  const st = statSync(p)
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) if (f !== 'node_modules' && !f.startsWith('.')) walk(join(p, f), out)
  } else if (p.endsWith('.vue')) out.push(p)
  return out
}

// Noms de composants disponibles par auto-import Nuxt (préfixe de dossier + nom de fichier, doublons de préfixe fusionnés)
const available = new Set()
for (const f of walk(compDir)) {
  const rel = relative(compDir, f).replace(/\.vue$/, '').split(sep)
  const parts = []
  for (const seg of rel) {
    const pascal = seg.replace(/(^|[-_.])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/\.client$|\.server$/i, '')
    parts.push(pascal)
  }
  // Nuxt supprime le préfixe répété (ui/UiButton.vue → UiButton)
  let name = parts[0]
  for (const seg of parts.slice(1)) name += seg.startsWith(name) ? seg.slice(name.length) || seg : seg
  available.add(name)
  available.add(parts.join(''))
  // .client / .server : même nom de composant
}

const BUILTIN = new Set([
  'Icon', 'NuxtLink', 'NuxtPage', 'NuxtLayout', 'NuxtErrorBoundary', 'NuxtLoadingIndicator', 'NuxtRouteAnnouncer', 'ClientOnly', 'DevOnly', 'NuxtImg', 'NuxtPicture',
  'Transition', 'TransitionGroup', 'Teleport', 'KeepAlive', 'Suspense', 'Component', 'Slot', 'RouterLink', 'RouterView', 'NuxtIsland', 'NuxtTime', 'NuxtWelcome',
])

const args = process.argv.slice(2)
const targets = (args.length ? args : ['app']).flatMap((a) => {
  const p = resolve(root, a)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

let errors = 0
for (const file of targets) {
  const rel = relative(root, file)
  const src = readFileSync(file, 'utf8')
  const { descriptor, errors: perr } = parse(src, { filename: file })
  const problems = [...perr.map((e) => `parse: ${e.message}`)]
  let bindings
  const imported = new Set()
  try {
    if (descriptor.script || descriptor.scriptSetup) {
      const res = compileScript(descriptor, { id: basename(file), inlineTemplate: false })
      bindings = res.bindings
      for (const k of Object.keys(res.imports ?? {})) imported.add(k)
    }
  } catch (e) {
    problems.push(`script: ${e.message}`)
  }
  if (descriptor.template) {
    const res = compileTemplate({ source: descriptor.template.content, filename: file, id: basename(file), compilerOptions: { bindingMetadata: bindings } })
    for (const e of res.errors) problems.push(`template: ${typeof e === 'string' ? e : e.message}`)
    const tags = new Set()
    for (const m of descriptor.template.content.matchAll(/<([A-Z][A-Za-z0-9]+)[\s/>]/g)) tags.add(m[1])
    for (const t of tags) {
      if (BUILTIN.has(t) || available.has(t) || imported.has(t) || (bindings && t in bindings)) continue
      problems.push(`composant introuvable : <${t}> (créer app/components/… ou l'importer)`)
    }
  }
  if (problems.length) {
    errors += problems.length
    console.log(`✗ ${rel}`)
    for (const p of problems) console.log(`    ${p}`)
  }
}
console.log(errors ? `\n${errors} problème(s) dans ${targets.length} fichier(s).` : `✓ ${targets.length} fichier(s) .vue valides.`)
process.exit(errors ? 1 : 0)
