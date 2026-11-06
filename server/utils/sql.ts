/**
 * Logique SQL pure du stockage EcoBloc.
 * Elle ne connaît qu'un « exécuteur » (texte + paramètres → lignes) : branché sur `neon(DATABASE_URL)` en
 * production et sur PGlite dans les tests. Toutes les requêtes sont paramétrées (jamais de SQL concaténé).
 */
export type SqlExec = (text: string, params?: unknown[]) => Promise<any[]>

/** Schéma idempotent (une instruction par entrée : le pilote HTTP de Neon n'accepte pas les lots). */
export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS records (
    seq bigint GENERATED ALWAYS AS IDENTITY,
    collection text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection, id)
  )`,
  `CREATE INDEX IF NOT EXISTS records_collection_seq_idx ON records (collection, seq)`,
  `CREATE TABLE IF NOT EXISTS meta (
    key text PRIMARY KEY,
    value jsonb NOT NULL
  )`,
]

export async function ensureSchema(exec: SqlExec): Promise<void> {
  for (const stmt of DDL) await exec(stmt)
}

export type RawState = Record<string, any[]>

/** Toutes les lignes, regroupées par collection, dans l'ordre d'insertion. */
export async function loadAll(exec: SqlExec): Promise<RawState> {
  const rows = await exec('SELECT collection, data FROM records ORDER BY seq')
  const out: RawState = {}
  for (const r of rows) (out[r.collection] ??= []).push(typeof r.data === 'string' ? JSON.parse(r.data) : r.data)
  return out
}

export async function loadCollection(exec: SqlExec, collection: string): Promise<any[]> {
  const rows = await exec('SELECT data FROM records WHERE collection = $1 ORDER BY seq', [collection])
  return rows.map((r) => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data))
}

export async function getRow(exec: SqlExec, collection: string, id: string): Promise<any | undefined> {
  const rows = await exec('SELECT data FROM records WHERE collection = $1 AND id = $2', [collection, id])
  const d = rows[0]?.data
  return d === undefined ? undefined : typeof d === 'string' ? JSON.parse(d) : d
}

export async function countRecords(exec: SqlExec): Promise<number> {
  const rows = await exec('SELECT count(*)::int AS n FROM records')
  return Number(rows[0]?.n ?? 0)
}

export async function upsertRow(exec: SqlExec, collection: string, id: string, data: unknown): Promise<void> {
  await exec(
    `INSERT INTO records (collection, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [collection, id, JSON.stringify(data)],
  )
}

export async function removeRow(exec: SqlExec, collection: string, id: string): Promise<boolean> {
  const rows = await exec('DELETE FROM records WHERE collection = $1 AND id = $2 RETURNING id', [collection, id])
  return rows.length > 0
}

export async function getMeta<T = unknown>(exec: SqlExec, key: string): Promise<T | undefined> {
  const rows = await exec('SELECT value FROM meta WHERE key = $1', [key])
  const v = rows[0]?.value
  return v === undefined ? undefined : ((typeof v === 'string' ? JSON.parse(v) : v) as T)
}

export async function setMeta(exec: SqlExec, key: string, value: unknown): Promise<void> {
  await exec(
    `INSERT INTO meta (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  )
}

/** Remplace tout le contenu (amorçage / réinitialisation de la démo) par paquets de 400 lignes. */
export async function replaceAll(exec: SqlExec, state: RawState, chunk = 400): Promise<number> {
  await exec('DELETE FROM records')
  const flat: { c: string; id: string; d: string }[] = []
  for (const [c, rows] of Object.entries(state)) {
    for (const row of rows) if (row && row.id != null) flat.push({ c, id: String(row.id), d: JSON.stringify(row) })
  }
  // les lignes sont insérées « dans l'ordre inverse » de l'état pour conserver l'ordre d'affichage (seq croissant)
  for (let i = 0; i < flat.length; i += chunk) {
    const part = flat.slice(i, i + chunk)
    await exec(
      `INSERT INTO records (collection, id, data)
       SELECT t.c, t.i, t.d::jsonb FROM unnest($1::text[], $2::text[], $3::text[]) AS t(c, i, d)
       ON CONFLICT (collection, id) DO NOTHING`,
      [part.map((x) => x.c), part.map((x) => x.id), part.map((x) => x.d)],
    )
  }
  return flat.length
}
