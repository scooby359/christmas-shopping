import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addItem, db, deleteItem, deletePerson, totalsFor, updateItem, updatePerson, type Item } from '../db'
import { formatGBP, plural } from '../format'
import { goHome } from '../hooks/useHashRoute'
import { Avatar } from '../components/Avatar'
import { Checkbox } from '../components/Checkbox'
import { EmptyState } from '../components/EmptyState'
import { ItemForm } from '../components/ItemForm'
import { ItemRow } from '../components/ItemRow'
import { Modal } from '../components/Modal'
import { PersonForm } from '../components/PersonForm'
import { ProgressBar } from '../components/ProgressBar'
import { useToast } from '../components/Toast'
import { BackIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons'

type Sheet = { kind: 'rename' } | { kind: 'addItem' } | { kind: 'editItem'; item: Item } | null

export function PersonPage({ id }: { id: string }) {
  const data = useLiveQuery(async () => {
    const [person, items] = await Promise.all([
      db.people.get(id),
      db.items.where('personId').equals(id).sortBy('createdAt'),
    ])
    return { person, items }
  }, [id])
  const [sheet, setSheet] = useState<Sheet>(null)
  const toast = useToast()
  const close = () => setSheet(null)

  if (!data) return <div className="loading" />

  const { person, items } = data
  if (!person) {
    return (
      <main className="page">
        <EmptyState
          title="Person not found"
          text="They may have been deleted."
          action={
            <a className="btn btn-primary" href="#/">
              Back to list
            </a>
          }
        />
      </main>
    )
  }

  const totals = totalsFor(items)
  // Unbought first so the to-do list stays at the top.
  const sorted = [...items].sort((a, b) => Number(a.bought) - Number(b.bought))

  const onDeletePerson = async () => {
    const msg = items.length
      ? `Delete ${person.name} and their ${plural(items.length, 'gift')}?`
      : `Delete ${person.name}?`
    if (!window.confirm(msg)) return
    goHome()
    await deletePerson(person.id)
    toast(`Deleted ${person.name}`)
  }

  return (
    <>
      <header className="hero hero-compact">
        <div className="hero-inner">
          <div className="hero-top">
            <button type="button" className="icon-btn icon-btn-on-dark" onClick={goHome} aria-label="Back">
              <BackIcon />
            </button>
            <div className="hero-actions">
              <button
                type="button"
                className="icon-btn icon-btn-on-dark"
                onClick={() => setSheet({ kind: 'rename' })}
                aria-label="Rename person"
              >
                <EditIcon size={20} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-on-dark"
                onClick={onDeletePerson}
                aria-label="Delete person"
              >
                <TrashIcon size={20} />
              </button>
            </div>
          </div>
          <div className="person-hero">
            <Avatar name={person.name} size={52} />
            <h1 className="hero-title hero-title-sm">{person.name}</h1>
          </div>
        </div>
      </header>

      <main className="page page-overlap">
        <section className="card person-summary">
          <div className="person-summary-figures">
            <div>
              <div className="summary-label">Spent</div>
              <div className="person-summary-total money">{formatGBP(totals.spentPence)}</div>
            </div>
            <div className="align-right">
              <div className="summary-label">Planned</div>
              <div className="person-summary-planned money">{formatGBP(totals.plannedPence)}</div>
            </div>
          </div>
          {totals.count > 0 && (
            <>
              <ProgressBar value={totals.boughtCount} max={totals.count} label="Gifts bought" />
              <div className="muted small">
                {totals.boughtCount} of {plural(totals.count, 'gift')} bought
              </div>
            </>
          )}
          <div
            className={`done-toggle${person.done ? ' is-on' : ''}`}
            onClick={() => updatePerson(person.id, { done: !person.done })}
          >
            <Checkbox
              checked={person.done}
              onChange={(done) => updatePerson(person.id, { done })}
              label={`Mark ${person.name} as done`}
              size="lg"
            />
            <div>
              <div className="done-toggle-title">{person.done ? 'All done!' : 'Mark as done'}</div>
              <div className="muted small">
                {person.done ? 'Nothing more to get' : 'Tick when you’ve finished shopping'}
              </div>
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <EmptyState
            title="No gifts yet"
            text={`What are you getting ${person.name}? Add ideas now and tick them off as you buy.`}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setSheet({ kind: 'addItem' })}>
                <PlusIcon size={18} /> Add a gift
              </button>
            }
          />
        ) : (
          <>
            <h2 className="section-title">Gifts</h2>
            <ul className="card item-list">
              {sorted.map((item) => (
                <ItemRow key={item.id} item={item} onEdit={() => setSheet({ kind: 'editItem', item })} />
              ))}
            </ul>
          </>
        )}
      </main>

      {items.length > 0 && (
        <button type="button" className="fab" onClick={() => setSheet({ kind: 'addItem' })}>
          <PlusIcon size={22} />
          <span>Gift</span>
        </button>
      )}

      <Modal open={sheet?.kind === 'rename'} title="Rename" onClose={close}>
        <PersonForm
          initialName={person.name}
          submitLabel="Save"
          onCancel={close}
          onSubmit={async (name) => {
            await updatePerson(person.id, { name })
            close()
          }}
        />
      </Modal>

      <Modal open={sheet?.kind === 'addItem'} title={`Gift for ${person.name}`} onClose={close}>
        <ItemForm
          onCancel={close}
          onSubmit={async (input) => {
            await addItem(person.id, input)
            close()
          }}
        />
      </Modal>

      <Modal open={sheet?.kind === 'editItem'} title="Edit gift" onClose={close}>
        {sheet?.kind === 'editItem' && (
          <ItemForm
            key={sheet.item.id}
            item={sheet.item}
            onCancel={close}
            onSubmit={async (input) => {
              // A cleared link is `undefined`, which Dexie's update() removes from the record.
              await updateItem(sheet.item.id, input)
              close()
            }}
            onDelete={async () => {
              if (!window.confirm(`Delete “${sheet.item.name}”?`)) return
              await deleteItem(sheet.item.id)
              close()
              toast('Gift deleted')
            }}
          />
        )}
      </Modal>
    </>
  )
}
