import { useSyncExternalStore } from 'react'
import type { AppData, BackupFile, Item, Person } from '../shared/types'
import { api, SessionExpiredError } from './api'

/*
 * Client-side store. The server (D1) is the source of truth; this holds the last
 * loaded copy in memory. Mutations update the screen immediately, then save; if the
 * save fails the change is rolled back and an error is reported.
 */

export type LoadState = 'loading' | 'ready' | 'error'

interface State {
  status: LoadState
  error: string | null
  email: string | null
  data: AppData
}

let state: State = { status: 'loading', error: null, email: null, data: { people: [], items: [] } }
const listeners = new Set<() => void>()
let errorHandler: (message: string) => void = () => {}
let pending = 0
let needsSync = false

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function setData(fn: (d: AppData) => AppData) {
  set({ data: fn(state.data) })
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Register how errors are shown (e.g. a toast). */
export function onStoreError(handler: (message: string) => void) {
  errorHandler = handler
}

// ---- Loading ----

export async function load() {
  // Don't overwrite optimistic changes that are still being saved.
  if (pending > 0) return
  try {
    const [me, data] = await Promise.all([state.email ? null : api.me(), api.data()])
    if (pending > 0) return
    set({ status: 'ready', data, ...(me && { email: me.email }) })
  } catch (e) {
    if (e instanceof SessionExpiredError) return
    // A failed first load shows the error screen. A failed background refresh is
    // ignored: the last loaded list stays on screen and the next refresh retries.
    if (state.status === 'loading') set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

/** Refresh when the app comes back into view or back online, so edits made on another device show up. */
export function startAutoRefresh() {
  const refresh = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void load()
  }
  // The 'online' event often fires a moment before the network actually works.
  let timer: number | undefined
  const onOnline = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(refresh, 1500)
  }
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', onOnline)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('online', onOnline)
  }
}

// ---- Mutations ----

async function mutate(optimistic: (d: AppData) => AppData, save: () => Promise<unknown>, failMessage: string) {
  if (!navigator.onLine) {
    errorHandler("You're offline. Changes need a connection.")
    return false
  }
  const before = state.data
  setData(optimistic)
  pending++
  try {
    await save()
    return true
  } catch (e) {
    if (e instanceof SessionExpiredError) return false
    // Undo on screen now, then re-sync with the server once nothing else is in flight
    // (the snapshot may also have hidden another change that did save).
    set({ data: before })
    needsSync = true
    errorHandler(`${failMessage}: ${e instanceof Error ? e.message : 'unknown error'}`)
    return false
  } finally {
    pending--
    if (pending === 0 && needsSync) {
      needsSync = false
      void load()
    }
  }
}

export function addPerson(name: string) {
  const person: Person = { id: crypto.randomUUID(), name, done: false, createdAt: Date.now() }
  return mutate(
    (d) => ({ ...d, people: [...d.people, person] }),
    () => api.addPerson({ id: person.id, name }),
    "Couldn't add person",
  )
}

export function updatePerson(id: string, patch: Partial<Pick<Person, 'name' | 'done'>>) {
  return mutate(
    (d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
    () => api.updatePerson(id, patch),
    "Couldn't save",
  )
}

export function deletePerson(id: string) {
  return mutate(
    (d) => ({ people: d.people.filter((p) => p.id !== id), items: d.items.filter((i) => i.personId !== id) }),
    () => api.deletePerson(id),
    "Couldn't delete",
  )
}

export type ItemInput = Pick<Item, 'name' | 'pricePence' | 'url' | 'bought'>

export function addItem(personId: string, input: ItemInput) {
  const item: Item = { id: crypto.randomUUID(), personId, ...input, createdAt: Date.now() }
  return mutate(
    (d) => ({ ...d, items: [...d.items, item] }),
    () => api.addItem({ id: item.id, personId, ...input, url: input.url ?? null }),
    "Couldn't add gift",
  )
}

export function updateItem(id: string, patch: Partial<ItemInput>) {
  return mutate(
    (d) => ({
      ...d,
      items: d.items.map((i) => {
        if (i.id !== id) return i
        const next = { ...i, ...patch }
        if ('url' in patch && !patch.url) delete next.url
        return next
      }),
    }),
    () => api.updateItem(id, { ...patch, ...('url' in patch && { url: patch.url ?? null }) }),
    "Couldn't save",
  )
}

export function deleteItem(id: string) {
  return mutate(
    (d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }),
    () => api.deleteItem(id),
    "Couldn't delete",
  )
}

/** Replace everything on the server with a backup file, then reload. Throws on failure. */
export async function importBackup(file: BackupFile) {
  const result = await api.importData(file)
  await load()
  return result
}
