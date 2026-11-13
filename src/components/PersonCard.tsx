import type { Person, Totals } from '../../shared/types'
import { formatGBP } from '../format'
import { personHref } from '../hooks/useHashRoute'
import { Avatar } from './Avatar'
import { ProgressBar } from './ProgressBar'
import { CheckIcon, ChevronRightIcon } from './icons'

interface Props {
  person: Person
  totals: Totals
}

export function PersonCard({ person, totals }: Props) {
  const status =
    totals.count === 0
      ? 'No gifts yet'
      : `${totals.boughtCount} of ${totals.count} bought`

  return (
    <a href={personHref(person.id)} className={`card person-card${person.done ? ' is-done' : ''}`}>
      <div className="person-avatar">
        <Avatar name={person.name} />
        {person.done && (
          <span className="done-badge" aria-label="Done">
            <CheckIcon size={12} strokeWidth={3.5} />
          </span>
        )}
      </div>
      <div className="person-main">
        <div className="person-name">{person.name}</div>
        <div className="person-status">{person.done ? 'All sorted' : status}</div>
        {totals.count > 0 && (
          <ProgressBar value={totals.boughtCount} max={totals.count} label={`${person.name} progress`} thin />
        )}
      </div>
      <div className="person-spent">
        <span className="money">{formatGBP(totals.spentPence)}</span>
        {totals.plannedPence > totals.spentPence && (
          <span className="person-planned">of {formatGBP(totals.plannedPence)}</span>
        )}
      </div>
      <ChevronRightIcon size={18} className="person-chevron" />
    </a>
  )
}
