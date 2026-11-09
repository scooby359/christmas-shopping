import { db, type Item, type Person } from './db'

const APP_ID = 'christmas-shopping'

interface BackupFile {
  app: typeof APP_ID
  version: 1
  exportedAt: string
  people: Person[]
  items: Item[]
}

export async function exportData(): Promise<void> {
  const [people, items] = await Promise.all([db.people.toArray(), db.items.toArray()])
  const data: BackupFile = {
    app: APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    people,
    items,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `christmas-shopping-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function parsePerson(v: unknown): Person {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string') throw new Error('bad person')
  return {
    id: v.id,
    name: v.name,
    done: Boolean(v.done),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now(),
  }
}

function parseItem(v: unknown): Item {
  if (
    !isObj(v) ||
    typeof v.id !== 'string' ||
    typeof v.personId !== 'string' ||
    typeof v.name !== 'string'
  )
    throw new Error('bad item')
  const price = Number(v.pricePence)
  return {
    id: v.id,
    personId: v.personId,
    name: v.name,
    pricePence: Number.isFinite(price) ? Math.max(0, Math.round(price)) : 0,
    url: typeof v.url === 'string' && v.url ? v.url : undefined,
    bought: Boolean(v.bought),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now(),
  }
}

/** Parse and validate a backup file. Throws with a friendly message if invalid. */
export async function readBackup(file: File): Promise<{ people: Person[]; items: Item[] }> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!isObj(json) || json.app !== APP_ID || !Array.isArray(json.people) || !Array.isArray(json.items)) {
    throw new Error("That doesn't look like a Christmas Shopping export.")
  }
  try {
    const people = json.people.map(parsePerson)
    const ids = new Set(people.map((p) => p.id))
    const items = json.items.map(parseItem).filter((i) => ids.has(i.personId))
    return { people, items }
  } catch {
    throw new Error('The export file is damaged or incomplete.')
  }
}

/** Replace all current data with the backup contents. */
export function replaceAllData(data: { people: Person[]; items: Item[] }) {
  return db.transaction('rw', db.people, db.items, async () => {
    await db.items.clear()
    await db.people.clear()
    await db.people.bulkAdd(data.people)
    await db.items.bulkAdd(data.items)
  })
}
