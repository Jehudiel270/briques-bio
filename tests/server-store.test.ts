import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { memoryStore, sqlStore, type Store } from '../server/utils/store'
import { buildSeed, SEED_VERSION } from '../shared/seed'
import type { SqlExec } from '../server/utils/sql'

const make = async () => {
  const pg = new PGlite()
  const exec: SqlExec = async (text, params = []) => (await pg.query(text, params as any[])).rows as any[]
  return sqlStore(exec, 'neon')
}

const contract = (name: string, factory: () => Promise<Store>) =>
  describe(`magasin ${name}`, () => {
    let store: Store
    beforeAll(async () => {
      store = await factory()
      await store.ensure()
    })

    it('part d’une base vide, schéma idempotent', async () => {
      expect(await store.isEmpty()).toBe(true)
      await store.ensure()
      await store.ensure()
    })

    it('crée, relit, remplace et supprime une ligne', async () => {
      await store.upsert('faqs', 'f1', { id: 'f1', question: 'Q ?', n: 1 })
      expect(await store.getRow('faqs', 'f1')).toEqual({ id: 'f1', question: 'Q ?', n: 1 })
      await store.upsert('faqs', 'f1', { id: 'f1', question: 'Q ?', n: 2 })
      expect((await store.loadCollection('faqs'))).toHaveLength(1)
      expect((await store.getRow('faqs', 'f1')).n).toBe(2)
      expect(await store.remove('faqs', 'f1')).toBe(true)
      expect(await store.remove('faqs', 'f1')).toBe(false)
      expect(await store.getRow('faqs', 'f1')).toBeUndefined()
    })

    it('neutralise les caractères dangereux (paramètres liés, pas de SQL concaténé)', async () => {
      const evil = `x'); DROP TABLE records; --`
      await store.upsert('faqs', evil, { id: evil, question: evil })
      expect((await store.getRow('faqs', evil)).question).toBe(evil)
      expect(await store.isEmpty()).toBe(false)
      await store.remove('faqs', evil)
    })

    it('stocke des métadonnées', async () => {
      expect(await store.getMeta('seedVersion')).toBeUndefined()
      await store.setMeta('seedVersion', 3)
      await store.setMeta('seedVersion', 4)
      expect(await store.getMeta('seedVersion')).toBe(4)
    })

    it('remplace tout par le jeu de démonstration, en conservant les accents et l’ordre', async () => {
      const seed = buildSeed() as any
      const n = await store.replaceAll(seed)
      const total = Object.values(seed).reduce((a: number, rows: any) => a + rows.length, 0)
      expect(n).toBe(total)
      const all = await store.loadAll()
      expect(all.products).toHaveLength(seed.products.length)
      expect(all.products!.map((p: any) => p.id)).toEqual(seed.products.map((p: any) => p.id))
      expect(all.orders).toEqual(seed.orders) // jsonb ne conserve pas l'ordre des clés : comparaison structurelle
      expect(all.faqs!.some((f: any) => /é|è|à/.test(f.question))).toBe(true)
      expect(SEED_VERSION).toBeGreaterThan(0)
    })
  })

contract('SQL (PGlite)', make)
contract('mémoire', async () => memoryStore())
