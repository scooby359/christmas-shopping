import type { AppData, BackupFile, Item, Person } from '../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Thrown when the Cloudflare Access session has expired; the page reloads to show the sign-in screen. */
export class SessionExpiredError extends Error {}

const RELOAD_KEY = 'auth-reload-at'

function reloadAllowed(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    return true
  } catch {
    return false // storage unavailable: never risk a reload loop
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api' + path, {
      method,
      // When the Access session expires, Access answers with a redirect to its login page.
      // Following it cross-origin would fail with a confusing CORS error, so catch it instead.
      redirect: 'manual',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection.")
  }

  if (res.type === 'opaqueredirect' || res.status === 401) {
    // Reload once so Cloudflare Access can show its sign-in page. If we already reloaded
    // very recently, signing in didn't fix it, so stop and report instead of looping.
    if (reloadAllowed()) {
      window.location.reload()
      throw new SessionExpiredError('Session expired')
    }
    let message = 'Signed in, but the server did not accept the sign-in.'
    try {
      const body = (await res.json()) as { error?: string; details?: unknown }
      if (body.error) message = body.error + (body.details ? ` ${JSON.stringify(body.details)}` : '')
    } catch {
      /* redirect or non-JSON */
    }
    throw new ApiError(401, message)
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      message = ((await res.json()) as { error?: string }).error ?? message
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const api = {
  me: () => request<{ email: string }>('GET', '/me'),
  data: () => request<AppData>('GET', '/data'),

  addPerson: (p: { id: string; name: string }) => request<Person>('POST', '/people', p),
  updatePerson: (id: string, patch: Partial<Pick<Person, 'name' | 'done'>>) =>
    request<Person>('PATCH', `/people/${id}`, patch),
  deletePerson: (id: string) => request<void>('DELETE', `/people/${id}`),

  addItem: (i: Omit<Item, 'createdAt' | 'url'> & { url: string | null }) => request<Item>('POST', '/items', i),
  updateItem: (id: string, patch: Partial<Pick<Item, 'name' | 'pricePence' | 'bought'>> & { url?: string | null }) =>
    request<Item>('PATCH', `/items/${id}`, patch),
  deleteItem: (id: string) => request<void>('DELETE', `/items/${id}`),

  importData: (file: BackupFile) => request<{ people: number; items: number }>('POST', '/import', file),
}
