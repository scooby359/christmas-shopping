import { useHashRoute } from './hooks/useHashRoute'
import { HomePage } from './pages/HomePage'
import { PersonPage } from './pages/PersonPage'

export function App() {
  const route = useHashRoute()
  return route.page === 'person' ? <PersonPage key={route.id} id={route.id} /> : <HomePage />
}
