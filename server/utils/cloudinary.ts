/** Logique pure Cloudinary : signature d'envoi et dossiers du projet. */
import { createHash } from 'node:crypto'

export const SUBFOLDERS = ['produits', 'atelier', 'collectes', 'qualite', 'livraisons', 'documents', 'branding', 'etudes-de-cas'] as const
export type Subfolder = (typeof SUBFOLDERS)[number]

export const isSubfolder = (s: unknown): s is Subfolder => typeof s === 'string' && (SUBFOLDERS as readonly string[]).includes(s)

/** Racine + sous-dossiers à créer. */
export const projectFolders = (root: string): string[] => [root, ...SUBFOLDERS.map((s) => `${root}/${s}`)]

/** Signature Cloudinary : SHA-1 de « k=v&k=v… » (clés triées, sans file/api_key/resource_type) suivie du secret. */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => !['file', 'cloud_name', 'resource_type', 'api_key'].includes(k) && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

export function buildUploadSignature(opts: { folder: unknown; root: string; cloudName: string; apiKey: string; apiSecret: string; now?: number }) {
  if (!opts.cloudName || !opts.apiKey || !opts.apiSecret) return { error: 'config' as const }
  if (!isSubfolder(opts.folder)) return { error: 'folder' as const }
  const timestamp = Math.floor((opts.now ?? Date.now()) / 1000)
  const folder = `${opts.root}/${opts.folder}`
  return { cloudName: opts.cloudName, apiKey: opts.apiKey, timestamp, folder, signature: signParams({ folder, timestamp }, opts.apiSecret) }
}

export interface FolderResult {
  path: string
  status: 'created' | 'exists' | 'error'
  detail?: string
}

/** Crée les dossiers via l'API admin Cloudinary (auth Basic). `fetcher` injectable pour les tests. */
export async function createProjectFolders(opts: { cloudName: string; apiKey: string; apiSecret: string; root: string; fetcher?: typeof fetch }): Promise<FolderResult[]> {
  const f = opts.fetcher ?? fetch
  const auth = 'Basic ' + Buffer.from(`${opts.apiKey}:${opts.apiSecret}`).toString('base64')
  const out: FolderResult[] = []
  for (const path of projectFolders(opts.root)) {
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(opts.cloudName)}/folders/${path.split('/').map(encodeURIComponent).join('/')}`
    try {
      const res = await f(url, { method: 'POST', headers: { Authorization: auth } })
      const body: any = await res.json().catch(() => ({}))
      const msg = String(body?.error?.message ?? '')
      if (res.ok) out.push({ path, status: 'created' })
      else if (res.status === 409 || /already exists/i.test(msg)) out.push({ path, status: 'exists' })
      else out.push({ path, status: 'error', detail: `${res.status}${msg ? ' — ' + msg : ''}` })
    } catch (e: any) {
      out.push({ path, status: 'error', detail: 'Cloudinary injoignable depuis le serveur.' })
    }
  }
  return out
}
