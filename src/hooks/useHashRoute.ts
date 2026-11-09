import { useEffect, useState } from 'react'

export type Route = { page: 'home' } | { page: 'person'; id: string }

function parse(hash: string): Route {
  const match = hash.match(/^#\/person\/([^/]+)$/)
  if (match) return { page: 'person', id: decodeURIComponent(match[1]) }
  return { page: 'home' }
}

/** True once we've navigated within the app, so history.back() stays inside it. */
let navigatedInApp = false

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      navigatedInApp = true
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const personHref = (id: string) => `#/person/${encodeURIComponent(id)}`

export function goHome() {
  // Going back keeps the phone's back button/gesture natural.
  if (navigatedInApp) window.history.back()
  else window.location.replace('#/')
}
