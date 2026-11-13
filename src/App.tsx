import { useEffect } from 'react'
import { EmptyState } from './components/EmptyState'
import { useToast } from './components/Toast'
import { RefreshIcon } from './components/icons'
import { useHashRoute } from './hooks/useHashRoute'
import { HomePage } from './pages/HomePage'
import { PersonPage } from './pages/PersonPage'
import { load, onStoreError, startAutoRefresh, useStore } from './store'

export function App() {
  const route = useHashRoute()
  const { status, error } = useStore()
  const toast = useToast()

  useEffect(() => {
    onStoreError(toast)
    void load()
    return startAutoRefresh()
  }, [toast])

  if (status === 'loading') {
    return (
      <div className="loading" role="status" aria-label="Loading your list">
        <div className="spinner" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <main className="page">
        <EmptyState
          title="Couldn't load your list"
          text={error ?? 'Check your connection and try again.'}
          action={
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshIcon size={18} /> Try again
            </button>
          }
        />
      </main>
    )
  }

  return route.page === 'person' ? <PersonPage key={route.id} id={route.id} /> : <HomePage />
}
