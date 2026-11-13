import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { app } from './index'

const ORIGIN = 'https://shop.example'

/** Fake ExecutionContext, optionally signed in via Cloudflare Access as `email`. */
function ctx(email?: string) {
  return {
    waitUntil() {},
    passThroughOnException() {},
    ...(email !== undefined && { access: { aud: 'test', getIdentity: async () => ({ email }) } }),
  } as unknown as ExecutionContext
}

let n = 0
/** A fresh user per test keeps tests independent of each other. */
function user() {
  const email = `user${++n}-${crypto.randomUUID().slice(0, 8)}@example.com`
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.fetch(
      new Request(ORIGIN + '/api' + path, {
        method,
        headers: {
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(method !== 'GET' && { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
      ctx(email),
    )
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }
  return { email, call }
}

const uuid = () => crypto.randomUUID()

async function seed(u: ReturnType<typeof user>) {
  const personId = uuid()
  const itemId = uuid()
  await u.call('POST', '/people', { id: personId, name: 'Mum' })
  await u.call('POST', '/items', { id: itemId, personId, name: 'Scarf', pricePence: 4500, url: 'https://shop.example/x' })
  return { personId, itemId }
}

describe('authentication', () => {
  it('rejects requests that did not come through Cloudflare Access', async () => {
    const res = await app.fetch(new Request(ORIGIN + '/api/data'), env, ctx())
    expect(res.status).toBe(401)
  })

  it('rejects an Access identity with no email', async () => {
    const res = await app.fetch(new Request(ORIGIN + '/api/data'), env, ctx(''))
    expect(res.status).toBe(401)
  })

  it('returns the signed-in email, lower-cased', async () => {
    const res = await app.fetch(new Request(ORIGIN + '/api/me'), env, ctx('Someone@Example.COM'))
    expect(await res.json()).toEqual({ email: 'someone@example.com' })
  })
})

describe('people and items', () => {
  it('creates, reads, updates and deletes', async () => {
    const u = user()
    const { personId, itemId } = await seed(u)

    let data = (await u.call('GET', '/data')).body
    expect(data.people).toMatchObject([{ id: personId, name: 'Mum', done: false }])
    expect(data.items).toMatchObject([
      { id: itemId, personId, name: 'Scarf', pricePence: 4500, url: 'https://shop.example/x', bought: false },
    ])

    expect((await u.call('PATCH', `/people/${personId}`, { done: true, name: 'Mother' })).body).toMatchObject({
      name: 'Mother',
      done: true,
    })
    const patched = (await u.call('PATCH', `/items/${itemId}`, { bought: true, pricePence: 3999, url: null })).body
    expect(patched).toMatchObject({ bought: true, pricePence: 3999 })
    expect(patched.url).toBeUndefined()

    expect((await u.call('DELETE', `/items/${itemId}`)).status).toBe(204)
    data = (await u.call('GET', '/data')).body
    expect(data.items).toEqual([])
  })

  it('deleting a person deletes their items', async () => {
    const u = user()
    const { personId } = await seed(u)
    expect((await u.call('DELETE', `/people/${personId}`)).status).toBe(204)
    expect((await u.call('GET', '/data')).body).toEqual({ people: [], items: [] })
  })

  it('refuses an item for a person that does not exist', async () => {
    const u = user()
    const res = await u.call('POST', '/items', { id: uuid(), personId: uuid(), name: 'X', pricePence: 1 })
    expect(res.status).toBe(404)
  })

  it('validates input', async () => {
    const u = user()
    const { personId } = await seed(u)
    const cases = [
      ['POST', '/people', { id: 'not-a-uuid', name: 'A' }],
      ['POST', '/people', { id: uuid(), name: '   ' }],
      ['POST', '/people', { id: uuid(), name: 'x'.repeat(81) }],
      ['POST', '/items', { id: uuid(), personId, name: 'A', pricePence: 1.5 }],
      ['POST', '/items', { id: uuid(), personId, name: 'A', pricePence: -1 }],
      ['POST', '/items', { id: uuid(), personId, name: 'A', url: 'javascript:alert(1)' }],
      ['PATCH', `/people/${personId}`, {}],
      ['PATCH', `/people/${personId}`, { done: 'yes' }],
    ] as const
    for (const [method, path, body] of cases) {
      expect((await u.call(method, path, body)).status, `${method} ${path} ${JSON.stringify(body)}`).toBe(400)
    }
  })
})

describe('isolation between users', () => {
  it("one user cannot see, change or delete another user's data", async () => {
    const alice = user()
    const bob = user()
    const { personId, itemId } = await seed(alice)

    expect((await bob.call('GET', '/data')).body).toEqual({ people: [], items: [] })
    expect((await bob.call('PATCH', `/people/${personId}`, { name: 'Hacked' })).status).toBe(404)
    expect((await bob.call('PATCH', `/items/${itemId}`, { bought: true })).status).toBe(404)
    expect((await bob.call('POST', '/items', { id: uuid(), personId, name: 'Sneaky' })).status).toBe(404)
    expect((await bob.call('DELETE', `/items/${itemId}`)).status).toBe(404)
    expect((await bob.call('DELETE', `/people/${personId}`)).status).toBe(404)

    const data = (await alice.call('GET', '/data')).body
    expect(data.people).toMatchObject([{ name: 'Mum' }])
    expect(data.items).toMatchObject([{ name: 'Scarf', bought: false }])
  })

  it("importing replaces only the importing user's data, and the same ids can exist for two users", async () => {
    const alice = user()
    const bob = user()
    await seed(alice)
    const exported = { app: 'christmas-shopping', version: 1, ...(await alice.call('GET', '/data')).body }

    // Bob imports Alice's file (same ids) - must not clash with or affect Alice.
    expect((await bob.call('POST', '/import', exported)).body).toEqual({ people: 1, items: 1 })
    await bob.call('PATCH', `/people/${exported.people[0].id}`, { name: 'Bob mum' })

    expect((await alice.call('GET', '/data')).body.people[0].name).toBe('Mum')
    expect((await bob.call('GET', '/data')).body.people[0].name).toBe('Bob mum')
  })
})

describe('import', () => {
  it('replaces all existing data and drops orphaned items', async () => {
    const u = user()
    await seed(u)
    const p = uuid()
    const file = {
      app: 'christmas-shopping',
      version: 1,
      people: [{ id: p, name: 'Dad', done: true, createdAt: 1 }],
      items: [
        { id: uuid(), personId: p, name: 'Whisky', pricePence: 3800, bought: true, createdAt: 2 },
        { id: uuid(), personId: uuid(), name: 'Orphan', pricePence: 1, bought: false, createdAt: 3 },
      ],
    }
    expect((await u.call('POST', '/import', file)).body).toEqual({ people: 1, items: 1 })
    const data = (await u.call('GET', '/data')).body
    expect(data.people).toMatchObject([{ name: 'Dad', done: true }])
    expect(data.items).toMatchObject([{ name: 'Whisky', pricePence: 3800 }])
  })

  it('rejects files that are not exports, without touching existing data', async () => {
    const u = user()
    await seed(u)
    expect((await u.call('POST', '/import', { people: [], items: [] })).status).toBe(400)
    expect((await u.call('POST', '/import', { app: 'christmas-shopping', people: [{ id: 'x' }], items: [] })).status).toBe(400)
    expect((await u.call('GET', '/data')).body.people).toHaveLength(1)
  })
})

describe('cross-site protection', () => {
  it('blocks writes from another origin', async () => {
    const u = user()
    const res = await u.call('POST', '/people', { id: uuid(), name: 'X' }, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })
    expect(res.status).toBe(403)
  })

  it('requires JSON for writes with a body', async () => {
    const u = user()
    const res = await u.call('POST', '/people', undefined, { 'Content-Type': 'text/plain' })
    expect(res.status).toBe(400)
  })
})
