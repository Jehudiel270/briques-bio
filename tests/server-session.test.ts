import { describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { makeJwksVerifier, resolveActorFrom, VISITOR } from '../server/utils/session'
import { buildSeed } from '../shared/seed'

const users = buildSeed().users
const BASE = 'https://auth.example.test/neondb/auth'
const ISS = 'https://auth.example.test'

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true })
  const other = await generateKeyPair('EdDSA')
  const verify = makeJwksVerifier({ jwksUrl: 'https://unused.test/jwks', baseUrl: BASE, keys: publicKey as any })
  const sign = (claims: Record<string, unknown>, o: { iss?: string; aud?: string; exp?: string; key?: any } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA' }).setIssuedAt().setIssuer(o.iss ?? ISS).setAudience(o.aud ?? ISS).setExpirationTime(o.exp ?? '10m').sign(o.key ?? privateKey)
  return { verify, sign, other, jwk: await exportJWK(publicKey) }
}

const findUsers = async () => users

describe('session — jetons Neon Auth', () => {
  it('accepte un jeton valide et retrouve l’utilisateur par e-mail', async () => {
    const { verify, sign } = await setup()
    const jwt = await sign({ sub: 'neon-1', email: 'Pro@ecobloc.demo', name: 'Désiré' })
    const a = await resolveActorFrom({ authorization: `Bearer ${jwt}`, demoMode: false, verify, findUsers })
    expect(a.mode).toBe('neon')
    expect(a.role).toBe('pro')
    expect(a.id).toBe('usr_pro1')
  })

  it('accepte un jeton valide sans profil : visiteur avec identité (pour /api/auth/sync)', async () => {
    const { verify, sign } = await setup()
    const jwt = await sign({ sub: 'neon-2', email: 'nouveau@exemple.test' })
    const a = await resolveActorFrom({ authorization: `Bearer ${jwt}`, demoMode: false, verify, findUsers })
    expect(a.role).toBe('visitor')
    expect(a.identity?.email).toBe('nouveau@exemple.test')
  })

  it('refuse un jeton expiré, d’un autre émetteur, d’une autre audience ou mal signé', async () => {
    const { verify, sign, other } = await setup()
    for (const jwt of [
      await sign({ sub: 'x', email: 'pro@ecobloc.demo' }, { exp: '-1m' }),
      await sign({ sub: 'x', email: 'pro@ecobloc.demo' }, { iss: 'https://evil.test' }),
      await sign({ sub: 'x', email: 'pro@ecobloc.demo' }, { aud: 'https://evil.test' }),
      await sign({ sub: 'x', email: 'pro@ecobloc.demo' }, { key: other.privateKey }),
      'pas.un.jeton',
    ]) {
      const a = await resolveActorFrom({ authorization: `Bearer ${jwt}`, demoMode: true, demoUser: 'usr_admin', verify, findUsers })
      expect(a).toEqual(VISITOR)
    }
  })

  it('ignore x-demo-user hors mode démo, et pour un compte non démo', async () => {
    const { verify } = await setup()
    expect((await resolveActorFrom({ demoUser: 'usr_admin', demoMode: false, verify, findUsers })).role).toBe('visitor')
    const real = [{ ...users.find((u) => u.id === 'usr_admin')!, demo: false }]
    expect((await resolveActorFrom({ demoUser: 'usr_admin', demoMode: true, verify, findUsers: async () => real })).role).toBe('visitor')
  })

  it('accepte x-demo-user en mode démo', async () => {
    const a = await resolveActorFrom({ demoUser: 'usr_sales', demoMode: true, findUsers })
    expect(a.role).toBe('sales')
    expect(a.mode).toBe('demo')
  })

  it('un compte en attente de validation ne reçoit aucun droit', async () => {
    const { verify, sign } = await setup()
    const pending = [{ ...users.find((u) => u.id === 'usr_client1')!, pendingApproval: true }]
    const jwt = await sign({ sub: 'n', email: 'client@ecobloc.demo' })
    const a = await resolveActorFrom({ authorization: `Bearer ${jwt}`, demoMode: false, verify, findUsers: async () => pending })
    expect(a.role).toBe('visitor')
  })
})
