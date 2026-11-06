import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { buildUploadSignature, createProjectFolders, projectFolders, signParams } from '../server/utils/cloudinary'

describe('cloudinary — signature', () => {
  it('signe les paramètres triés avec le secret (SHA-1)', () => {
    const sig = signParams({ timestamp: 1700000000, folder: 'ecobloc/produits' }, 'secret')
    expect(sig).toBe(createHash('sha1').update('folder=ecobloc/produits&timestamp=1700000000secret').digest('hex'))
  })
  it('refuse un dossier hors arborescence et une configuration absente', () => {
    const base = { root: 'ecobloc', cloudName: 'c', apiKey: 'k', apiSecret: 's' }
    expect(buildUploadSignature({ ...base, folder: '../autre' })).toEqual({ error: 'folder' })
    expect(buildUploadSignature({ ...base, folder: 'produits', apiSecret: '' })).toEqual({ error: 'config' })
    const ok: any = buildUploadSignature({ ...base, folder: 'produits', now: 1_700_000_000_000 })
    expect(ok.folder).toBe('ecobloc/produits')
    expect(ok.signature).toHaveLength(40)
    expect(JSON.stringify(ok)).not.toContain('"s"')
  })
  it('liste les dossiers du projet', () => {
    expect(projectFolders('ecobloc')).toEqual(expect.arrayContaining(['ecobloc', 'ecobloc/produits', 'ecobloc/qualite', 'ecobloc/etudes-de-cas']))
    expect(projectFolders('ecobloc')).toHaveLength(9)
  })
})

describe('cloudinary — création des dossiers', () => {
  const run = (fetcher: any) => createProjectFolders({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', root: 'ecobloc', fetcher })
  it('distingue créé / déjà présent / erreur', async () => {
    let n = 0
    const res = await run(async (url: string, init: any) => {
      n++
      expect(init.headers.Authorization).toMatch(/^Basic /)
      expect(url).toContain('/v1_1/demo/folders/ecobloc')
      if (n === 1) return new Response('{"success":true}', { status: 200 })
      if (n === 2) return new Response('{"error":{"message":"Folder already exists"}}', { status: 409 })
      return new Response('{"error":{"message":"Invalid"}}', { status: 401 })
    })
    expect(res[0]!.status).toBe('created')
    expect(res[1]!.status).toBe('exists')
    expect(res[2]!.status).toBe('error')
  })
  it('signale un réseau injoignable sans fuite de détail technique', async () => {
    const res = await run(async () => {
      throw new Error('getaddrinfo ENOTFOUND api.cloudinary.com')
    })
    expect(res.every((r) => r.status === 'error' && !/ENOTFOUND/.test(r.detail ?? ''))).toBe(true)
  })
})
