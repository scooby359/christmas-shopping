import { LIMITS } from '../shared/types'

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

const bad = (msg: string) => new HttpError(400, msg)

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function id(v: unknown, field = 'id'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw bad(`${field} must be a UUID`)
  return v.toLowerCase()
}

function text(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw bad(`${field} must be a string`)
  const t = v.trim()
  if (!t) throw bad(`${field} is required`)
  if (t.length > max) throw bad(`${field} is too long`)
  return t
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw bad(`${field} must be true or false`)
  return v
}

function price(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > LIMITS.maxPricePence) {
    throw bad('pricePence must be a whole number of pence, 0 or more')
  }
  return v
}

/** http(s) URL or null (to clear). */
function url(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || v.length > LIMITS.url) throw bad('url is invalid')
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
    return u.href
  } catch {
    throw bad('url must be an http(s) link')
  }
}

function body(v: unknown): Obj {
  if (!isObj(v)) throw bad('Expected a JSON object')
  return v
}

// ---- People ----

export function newPerson(v: unknown) {
  const b = body(v)
  return { id: id(b.id), name: text(b.name, 'name', LIMITS.personName) }
}

export function personPatch(v: unknown) {
  const b = body(v)
  const out: { name?: string; done?: boolean } = {}
  if ('name' in b) out.name = text(b.name, 'name', LIMITS.personName)
  if ('done' in b) out.done = bool(b.done, 'done')
  if (Object.keys(out).length === 0) throw bad('Nothing to update')
  return out
}

// ---- Items ----

export function newItem(v: unknown) {
  const b = body(v)
  return {
    id: id(b.id),
    personId: id(b.personId, 'personId'),
    name: text(b.name, 'name', LIMITS.itemName),
    pricePence: price(b.pricePence ?? 0),
    url: url(b.url),
    bought: b.bought === undefined ? false : bool(b.bought, 'bought'),
  }
}

export function itemPatch(v: unknown) {
  const b = body(v)
  const out: { name?: string; pricePence?: number; url?: string | null; bought?: boolean } = {}
  if ('name' in b) out.name = text(b.name, 'name', LIMITS.itemName)
  if ('pricePence' in b) out.pricePence = price(b.pricePence)
  if ('url' in b) out.url = url(b.url)
  if ('bought' in b) out.bought = bool(b.bought, 'bought')
  if (Object.keys(out).length === 0) throw bad('Nothing to update')
  return out
}

// ---- Import ----

export function importFile(v: unknown) {
  const b = body(v)
  if (b.app !== 'christmas-shopping' || !Array.isArray(b.people) || !Array.isArray(b.items)) {
    throw bad("That doesn't look like a Christmas Shopping export")
  }
  if (b.people.length > LIMITS.maxPeople || b.items.length > LIMITS.maxItems) {
    throw new HttpError(413, 'Export file is too large')
  }
  const now = Date.now()
  const ts = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : now)

  const people = b.people.map((p) => {
    const o = body(p)
    return { id: id(o.id), name: text(o.name, 'name', LIMITS.personName), done: Boolean(o.done), createdAt: ts(o.createdAt) }
  })
  const personIds = new Set(people.map((p) => p.id))
  if (personIds.size !== people.length) throw bad('Duplicate person ids')

  const items = b.items.map((i) => {
    const o = body(i)
    return {
      id: id(o.id),
      personId: id(o.personId, 'personId'),
      name: text(o.name, 'name', LIMITS.itemName),
      pricePence: price(o.pricePence ?? 0),
      url: url(o.url),
      bought: Boolean(o.bought),
      createdAt: ts(o.createdAt),
    }
  })
  if (new Set(items.map((i) => i.id)).size !== items.length) throw bad('Duplicate item ids')
  // Drop orphaned items rather than failing the whole import.
  return { people, items: items.filter((i) => personIds.has(i.personId)) }
}
