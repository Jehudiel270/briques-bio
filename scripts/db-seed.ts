/**
 * Crée le schéma Neon et amorce la base avec le jeu de démonstration fictif.
 *   node --env-file=.env node_modules/.bin/jiti scripts/db-seed.ts [--reset] [--dry-run]
 * --dry-run : compte les lignes par collection sans se connecter. L'URL de connexion n'est jamais affichée.
 */
import { buildSeed, SEED_VERSION } from '../shared/seed/index'
import { ensureSchema, getMeta, replaceAll, setMeta, countRecords, type SqlExec } from '../server/utils/sql'

const args = new Set(process.argv.slice(2))
const seed = buildSeed() as unknown as Record<string, any[]>

if (args.has('--dry-run')) {
  let total = 0
  for (const [c, rows] of Object.entries(seed)) {
    console.log(`${c.padEnd(18)} ${String(rows.length).padStart(4)}`)
    total += rows.length
  }
  console.log(`${'TOTAL'.padEnd(18)} ${String(total).padStart(4)}  (version du jeu : ${SEED_VERSION})`)
  process.exit(0)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL est absent : renseignez-le dans .env (voir .env.example).')
  process.exit(1)
}

try {
  const { neon } = await import('@neondatabase/serverless')
  const client = neon(url)
  const exec: SqlExec = async (text, params = []) => (await client.query(text, params as any[])) as any[]
  await ensureSchema(exec)
  const existing = await countRecords(exec)
  const version = await getMeta<number>(exec, 'seedVersion')
  if (existing > 0 && version === SEED_VERSION && !args.has('--reset')) {
    console.log(`Base déjà amorcée (version ${version}, ${existing} lignes). Utilisez --reset pour la réinitialiser.`)
  } else {
    const n = await replaceAll(exec, seed)
    await setMeta(exec, 'seedVersion', SEED_VERSION)
    console.log(`Base amorcée : ${n} lignes (version ${SEED_VERSION}).`)
  }
} catch (e) {
  console.error('Échec de la connexion ou de l’amorçage :', e instanceof Error ? e.message.replace(url, '[url masquée]') : 'erreur inconnue')
  process.exit(1)
}
