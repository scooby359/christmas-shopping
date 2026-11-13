import { useState } from 'react'
import { totalsFor, type Item } from '../../shared/types'
import { addPerson, useStore } from '../store'
import { OfflineBanner } from '../components/OfflineBanner'
import { Countdown } from '../components/Countdown'
import { EmptyState } from '../components/EmptyState'
import { Menu } from '../components/Menu'
import { Modal } from '../components/Modal'
import { PersonCard } from '../components/PersonCard'
import { PersonForm } from '../components/PersonForm'
import { SummaryCard } from '../components/SummaryCard'
import { useToast } from '../components/Toast'
import { PlusIcon } from '../components/icons'

export function HomePage() {
  const { people, items } = useStore().data
  const [adding, setAdding] = useState(false)
  const toast = useToast()

  const byPerson = new Map<string, Item[]>()
  for (const item of items) {
    const list = byPerson.get(item.personId)
    if (list) list.push(item)
    else byPerson.set(item.personId, [item])
  }
  // Done people drop to the bottom; otherwise keep creation order.
  const sorted = [...people].sort((a, b) => Number(a.done) - Number(b.done))
  const doneCount = people.filter((p) => p.done).length

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-top">
            <Countdown />
            <Menu />
          </div>
          <h1 className="hero-title">Christmas Shopping</h1>
        </div>
      </header>

      <main className="page page-overlap">
        <OfflineBanner />
        <SummaryCard totals={totalsFor(items)} peopleCount={people.length} doneCount={doneCount} />

        {people.length === 0 ? (
          <EmptyState
            title="Who are you buying for?"
            text="Add the people on your list, then jot down gift ideas for each."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                <PlusIcon size={18} /> Add a person
              </button>
            }
          />
        ) : (
          <>
            <h2 className="section-title">People</h2>
            <ul className="stack">
              {sorted.map((person) => (
                <li key={person.id}>
                  <PersonCard person={person} totals={totalsFor(byPerson.get(person.id) ?? [])} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {people.length > 0 && (
        <button type="button" className="fab" onClick={() => setAdding(true)}>
          <PlusIcon size={22} />
          <span>Person</span>
        </button>
      )}

      <Modal open={adding} title="Add person" onClose={() => setAdding(false)}>
        <PersonForm
          submitLabel="Add"
          onCancel={() => setAdding(false)}
          onSubmit={(name) => {
            if (navigator.onLine) setAdding(false)
            void addPerson(name).then((ok) => ok && toast(`Added ${name}`))
          }}
        />
      </Modal>
    </>
  )
}
