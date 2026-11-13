// Types and helpers shared by the React app (src/) and the Worker API (worker/).

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

export interface AppData {
  people: Person[]
  items: Item[]
}

/** Shape of an exported backup file. */
export interface BackupFile extends AppData {
  app: 'christmas-shopping'
  version: 1
  exportedAt: string
}

export const LIMITS = {
  personName: 80,
  itemName: 120,
  url: 2048,
  maxPricePence: 100_000_000, // £1m
  maxPeople: 500,
  maxItems: 5000,
} as const

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
