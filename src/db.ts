import { Dexie, type EntityTable } from 'dexie'

export interface Person {
  id: string
  name: string
  done: boolean
  createdAt: number
}

export interface Item {
  id: string
  personId: string
  name: string
  /** Price in pence, to avoid floating point rounding. */
  pricePence: number
  url?: string
  bought: boolean
  createdAt: number
}

export const db = new Dexie('ChristmasShopping') as Dexie & {
  people: EntityTable<Person, 'id'>
  items: EntityTable<Item, 'id'>
}

db.version(1).stores({
  people: 'id, createdAt',
  items: 'id, personId, createdAt',
})

/** Ask the browser not to evict our data under storage pressure. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {})
}

// ---- People ----

export async function addPerson(name: string): Promise<string> {
  const id = crypto.randomUUID()
  await db.people.add({ id, name: name.trim(), done: false, createdAt: Date.now() })
  return id
}

export function updatePerson(id: string, changes: Partial<Omit<Person, 'id'>>) {
  return db.people.update(id, changes)
}

export function deletePerson(id: string) {
  return db.transaction('rw', db.people, db.items, async () => {
    await db.items.where('personId').equals(id).delete()
    await db.people.delete(id)
  })
}

// ---- Items ----

export type ItemInput = Pick<Item, 'name' | 'pricePence' | 'url' | 'bought'>

export async function addItem(personId: string, input: ItemInput): Promise<string> {
  const id = crypto.randomUUID()
  await db.items.add({ id, personId, ...input, createdAt: Date.now() })
  return id
}

export function updateItem(id: string, changes: Partial<Omit<Item, 'id' | 'personId'>>) {
  return db.items.update(id, changes)
}

export function deleteItem(id: string) {
  return db.items.delete(id)
}

// ---- Totals ----

export interface Totals {
  count: number
  boughtCount: number
  spentPence: number
  plannedPence: number
}

export function totalsFor(items: Item[]): Totals {
  let spentPence = 0
  let plannedPence = 0
  let boughtCount = 0
  for (const item of items) {
    plannedPence += item.pricePence
    if (item.bought) {
      spentPence += item.pricePence
      boughtCount++
    }
  }
  return { count: items.length, boughtCount, spentPence, plannedPence }
}
