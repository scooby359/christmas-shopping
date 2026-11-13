import { Hono } from 'hono'
import { emailFromAccessJwt } from './auth'
import * as db from './db'
import * as v from './validate'
import { HttpError } from './validate'

type AppEnv = { Bindings: Env; Variables: { user: string } }

export const app = new Hono<AppEnv>().basePath('/api')

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

// 1. Authentication via Cloudflare Access. Fails closed: with no valid Access sign-in,
//    every request gets 401, so switching Access off never exposes data.
//    a) ctx.access - set when Access is enabled from the Worker's Access tab (and locally
//       via the access.dev block in wrangler.jsonc).
//    b) Otherwise verify the signed Access JWT ourselves - works however Access was set
//       up, including an application created in Zero Trust. Needs ACCESS_TEAM_DOMAIN and
//       ACCESS_AUD to be configured.
app.use('*', async (c, next) => {
  // Hono types executionCtx with its own minimal interface; it's the Workers ctx at runtime.
  const access = (c.executionCtx as unknown as ExecutionContext).access
  let email = ''

  if (access) {
    const identity = await access.getIdentity()
    email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : ''
  }

  if (!email) {
    const token = c.req.header('Cf-Access-Jwt-Assertion')
    if (!token) {
      console.warn('auth 401: no Access sign-in on request')
      throw new HttpError(401, 'Sign-in required: request did not come through Cloudflare Access')
    }
    const teamDomain = c.env.ACCESS_TEAM_DOMAIN?.trim()
    const aud = c.env.ACCESS_AUD?.trim()
    if (!teamDomain || !aud) {
      console.error('auth 401: ACCESS_TEAM_DOMAIN / ACCESS_AUD not configured')
      throw new HttpError(
        401,
        'Sign-in required: the server is missing ACCESS_TEAM_DOMAIN / ACCESS_AUD settings in wrangler.jsonc',
      )
    }
    email = await emailFromAccessJwt(token, { teamDomain, aud })
  }

  c.set('user', email)
  await next()
})

// 2. Cross-site request protection for anything that changes data.
app.use('*', async (c, next) => {
  if (MUTATING.has(c.req.method)) {
    const site = c.req.header('Sec-Fetch-Site')
    if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Cross-site request blocked')
    const origin = c.req.header('Origin')
    if (origin && origin !== new URL(c.req.url).origin) throw new HttpError(403, 'Cross-site request blocked')
    if (c.req.method !== 'DELETE' && !c.req.header('Content-Type')?.startsWith('application/json')) {
      throw new HttpError(400, 'Expected application/json')
    }
  }
  await next()
})

const json = async (c: { req: { json: () => Promise<unknown> } }) => {
  try {
    return await c.req.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

app.get('/me', (c) => c.json({ email: c.get('user') }))

app.get('/data', async (c) => c.json(await db.getAll(c.env.DB, c.get('user'))))

app.post('/people', async (c) => {
  const p = v.newPerson(await json(c))
  return c.json(await db.insertPerson(c.env.DB, c.get('user'), p), 201)
})

app.patch('/people/:id', async (c) => {
  const patch = v.personPatch(await json(c))
  return c.json(await db.updatePerson(c.env.DB, c.get('user'), v.id(c.req.param('id')), patch))
})

app.delete('/people/:id', async (c) => {
  await db.deletePerson(c.env.DB, c.get('user'), v.id(c.req.param('id')))
  return c.body(null, 204)
})

app.post('/items', async (c) => {
  const i = v.newItem(await json(c))
  return c.json(await db.insertItem(c.env.DB, c.get('user'), i), 201)
})

app.patch('/items/:id', async (c) => {
  const patch = v.itemPatch(await json(c))
  return c.json(await db.updateItem(c.env.DB, c.get('user'), v.id(c.req.param('id')), patch))
})

app.delete('/items/:id', async (c) => {
  await db.deleteItem(c.env.DB, c.get('user'), v.id(c.req.param('id')))
  return c.body(null, 204)
})

app.post('/import', async (c) => {
  const data = v.importFile(await json(c))
  await db.replaceAll(c.env.DB, c.get('user'), data)
  return c.json({ people: data.people.length, items: data.items.length })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, ...(err.details && { details: err.details }) }, err.status)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>
