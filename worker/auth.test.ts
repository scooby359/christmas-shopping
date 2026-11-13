import { env } from 'cloudflare:workers'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { issuerFor, setKeySetForTests } from './auth'
import { app } from './index'

const TEAM = 'myteam'
const ISSUER = 'https://myteam.cloudflareaccess.com'
const AUD = 'aud-for-this-app'
const configured = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env

let goodKey: CryptoKey
let otherKey: CryptoKey

beforeAll(async () => {
  const good = await generateKeyPair('RS256', { extractable: true })
  const other = await generateKeyPair('RS256', { extractable: true })
  goodKey = good.privateKey
  otherKey = other.privateKey
  // The "team's published certs" contain only the good key.
  setKeySetForTests(createLocalJWKSet({ keys: [{ ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'RS256' }] }))
})
afterAll(() => setKeySetForTests(undefined))

function token(opts: { email?: string; iss?: string; aud?: string; exp?: string | number; key?: CryptoKey } = {}) {
  const jwt = new SignJWT(opts.email === undefined ? { email: 'Person@Example.com' } : opts.email ? { email: opts.email } : {})
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
  return jwt.sign(opts.key ?? goodKey)
}

/** Context with NO ctx.access - like a Zero Trust app that only sends the JWT header. */
const noAccessCtx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext

async function me(jwt: string | undefined, e: Env = configured) {
  const res = await app.fetch(
    new Request('https://shop.example/api/me', { headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} }),
    e,
    noAccessCtx,
  )
  return { status: res.status, body: (await res.json()) as { email?: string; error?: string } }
}

describe('issuerFor', () => {
  it('accepts a team name, hostname or URL', () => {
    expect(issuerFor('myteam')).toBe(ISSUER)
    expect(issuerFor('myteam.cloudflareaccess.com')).toBe(ISSUER)
    expect(issuerFor('https://myteam.cloudflareaccess.com/')).toBe(ISSUER)
  })
})

describe('Access JWT sign-in (no ctx.access)', () => {
  it('accepts a valid token and uses its email', async () => {
    expect(await me(await token())).toEqual({ status: 200, body: { email: 'person@example.com' } })
  })

  it('rejects a request with no token', async () => {
    expect((await me(undefined)).status).toBe(401)
  })

  it('rejects a token for a different Access application (aud)', async () => {
    expect((await me(await token({ aud: 'some-other-app' }))).status).toBe(401)
  })

  it('rejects a token from a different team (issuer)', async () => {
    expect((await me(await token({ iss: 'https://attacker.cloudflareaccess.com' }))).status).toBe(401)
  })

  it('rejects a token signed with the wrong key', async () => {
    expect((await me(await token({ key: otherKey }))).status).toBe(401)
  })

  it('rejects an expired token', async () => {
    const r = await me(await token({ exp: Math.floor(Date.now() / 1000) - 60 }))
    expect(r.status).toBe(401)
    expect(r.body.error).toContain('expired')
  })

  it('rejects a token with no email', async () => {
    expect((await me(await token({ email: '' }))).status).toBe(401)
  })

  it('rejects a forged unsigned token', async () => {
    const header = btoa(JSON.stringify({ alg: 'none' })).replace(/=+$/, '')
    const body = btoa(JSON.stringify({ email: 'x@example.com', iss: ISSUER, aud: AUD })).replace(/=+$/, '')
    expect((await me(`${header}.${body}.`)).status).toBe(401)
  })

  it('refuses everything when the team domain / AUD are not configured', async () => {
    const unconfigured = { ...env, ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' } as unknown as Env
    const r = await me(await token(), unconfigured)
    expect(r.status).toBe(401)
    expect(r.body.error).toContain('ACCESS_AUD')
  })
})
