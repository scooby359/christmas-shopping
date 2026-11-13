import type { AppData, Item, Person } from '../shared/types'
import { HttpError } from './validate'

// Every query is scoped to the signed-in user's email.

interface PersonRow {
  id: string
  name: string
  done: number
  created_at: number
}

interface ItemRow {
  id: string
  person_id: string
  name: string
  price_pence: number
  url: string | null
  bought: number
  created_at: number
}

const toPerson = (r: PersonRow): Person => ({ id: r.id, name: r.name, done: r.done === 1, createdAt: r.created_at })

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  personId: r.person_id,
  name: r.name,
  pricePence: r.price_pence,
  ...(r.url ? { url: r.url } : {}),
  bought: r.bought === 1,
  createdAt: r.created_at,
})

const isConstraintError = (e: unknown) => e instanceof Error && /constraint/i.test(e.message)

export async function getAll(db: D1Database, user: string): Promise<AppData> {
  const [people, items] = await db.batch([
    db.prepare('SELECT id, name, done, created_at FROM people WHERE user_email = ? ORDER BY created_at').bind(user),
    db
      .prepare(
        'SELECT id, person_id, name, price_pence, url, bought, created_at FROM items WHERE user_email = ? ORDER BY created_at',
      )
      .bind(user),
  ])
  return {
    people: (people.results as unknown as PersonRow[]).map(toPerson),
    items: (items.results as unknown as ItemRow[]).map(toItem),
  }
}

// ---- People ----

export async function insertPerson(db: D1Database, user: string, p: { id: string; name: string }): Promise<Person> {
  const createdAt = Date.now()
  try {
    await db
      .prepare('INSERT INTO people (user_email, id, name, done, created_at) VALUES (?, ?, ?, 0, ?)')
      .bind(user, p.id, p.name, createdAt)
      .run()
  } catch (e) {
    if (isConstraintError(e)) throw new HttpError(409, 'A person with that id already exists')
    throw e
  }
  return { id: p.id, name: p.name, done: false, createdAt }
}

export async function updatePerson(
  db: D1Database,
  user: string,
  id: string,
  patch: { name?: string; done?: boolean },
): Promise<Person> {
  const sets: string[] = []
  const args: unknown[] = []
  if (patch.name !== undefined) sets.push('name = ?'), args.push(patch.name)
  if (patch.done !== undefined) sets.push('done = ?'), args.push(patch.done ? 1 : 0)
  const row = await db
    .prepare(
      `UPDATE people SET ${sets.join(', ')} WHERE user_email = ? AND id = ? RETURNING id, name, done, created_at`,
    )
    .bind(...args, user, id)
    .first<PersonRow>()
  if (!row) throw new HttpError(404, 'Person not found')
  return toPerson(row)
}

export async function deletePerson(db: D1Database, user: string, id: string): Promise<void> {
  const [, people] = await db.batch([
    db.prepare('DELETE FROM items WHERE user_email = ? AND person_id = ?').bind(user, id),
    db.prepare('DELETE FROM people WHERE user_email = ? AND id = ?').bind(user, id),
  ])
  if (people.meta.changes === 0) throw new HttpError(404, 'Person not found')
}

// ---- Items ----

export async function insertItem(
  db: D1Database,
  user: string,
  i: { id: string; personId: string; name: string; pricePence: number; url: string | null; bought: boolean },
): Promise<Item> {
  const createdAt = Date.now()
  let changes: number
  try {
    // Only insert if the person exists and belongs to this user.
    const res = await db
      .prepare(
        `INSERT INTO items (user_email, id, person_id, name, price_pence, url, bought, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM people WHERE user_email = ? AND id = ?)`,
      )
      .bind(user, i.id, i.personId, i.name, i.pricePence, i.url, i.bought ? 1 : 0, createdAt, user, i.personId)
      .run()
    changes = res.meta.changes
  } catch (e) {
    if (isConstraintError(e)) throw new HttpError(409, 'An item with that id already exists')
    throw e
  }
  if (changes === 0) throw new HttpError(404, 'Person not found')
  return toItem({
    id: i.id,
    person_id: i.personId,
    name: i.name,
    price_pence: i.pricePence,
    url: i.url,
    bought: i.bought ? 1 : 0,
    created_at: createdAt,
  })
}

export async function updateItem(
  db: D1Database,
  user: string,
  id: string,
  patch: { name?: string; pricePence?: number; url?: string | null; bought?: boolean },
): Promise<Item> {
  const sets: string[] = []
  const args: unknown[] = []
  if (patch.name !== undefined) sets.push('name = ?'), args.push(patch.name)
  if (patch.pricePence !== undefined) sets.push('price_pence = ?'), args.push(patch.pricePence)
  if (patch.url !== undefined) sets.push('url = ?'), args.push(patch.url)
  if (patch.bought !== undefined) sets.push('bought = ?'), args.push(patch.bought ? 1 : 0)
  const row = await db
    .prepare(
      `UPDATE items SET ${sets.join(', ')} WHERE user_email = ? AND id = ?
       RETURNING id, person_id, name, price_pence, url, bought, created_at`,
    )
    .bind(...args, user, id)
    .first<ItemRow>()
  if (!row) throw new HttpError(404, 'Item not found')
  return toItem(row)
}

export async function deleteItem(db: D1Database, user: string, id: string): Promise<void> {
  const res = await db.prepare('DELETE FROM items WHERE user_email = ? AND id = ?').bind(user, id).run()
  if (res.meta.changes === 0) throw new HttpError(404, 'Item not found')
}

// ---- Import (replace everything for this user, atomically) ----

export async function replaceAll(
  db: D1Database,
  user: string,
  data: {
    people: { id: string; name: string; done: boolean; createdAt: number }[]
    items: {
      id: string
      personId: string
      name: string
      pricePence: number
      url: string | null
      bought: boolean
      createdAt: number
    }[]
  },
): Promise<void> {
  const insPerson = db.prepare('INSERT INTO people (user_email, id, name, done, created_at) VALUES (?, ?, ?, ?, ?)')
  const insItem = db.prepare(
    'INSERT INTO items (user_email, id, person_id, name, price_pence, url, bought, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  await db.batch([
    db.prepare('DELETE FROM items WHERE user_email = ?').bind(user),
    db.prepare('DELETE FROM people WHERE user_email = ?').bind(user),
    ...data.people.map((p) => insPerson.bind(user, p.id, p.name, p.done ? 1 : 0, p.createdAt)),
    ...data.items.map((i) =>
      insItem.bind(user, i.id, i.personId, i.name, i.pricePence, i.url, i.bought ? 1 : 0, i.createdAt),
    ),
  ])
}
