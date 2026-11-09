import type { Totals } from '../db'
import { formatGBP } from '../format'
import { ProgressBar } from './ProgressBar'
import { StarIcon } from './icons'

interface Props {
  totals: Totals
  peopleCount: number
  doneCount: number
}

export function SummaryCard({ totals, peopleCount, doneCount }: Props) {
  const allDone = peopleCount > 0 && doneCount === peopleCount
  const remaining = totals.plannedPence - totals.spentPence

  return (
    <section className={`card summary${allDone ? ' is-all-done' : ''}`} aria-label="Summary">
      <div className="summary-label">Total spent</div>
      <div className="summary-total money">{formatGBP(totals.spentPence)}</div>
      <div className="summary-sub">
        {remaining > 0
          ? `${formatGBP(remaining)} still to buy · ${formatGBP(totals.plannedPence)} planned`
          : totals.count > 0
            ? 'Everything on the list is bought'
            : 'Add people and gifts to get started'}
      </div>

      <div className="summary-people">
        <div className="summary-people-row">
          <span>People done</span>
          <span className="summary-count">
            {doneCount} <span className="muted">of {peopleCount}</span>
          </span>
        </div>
        <ProgressBar value={doneCount} max={peopleCount} label="People done" />
      </div>

      {allDone && (
        <div className="summary-celebrate">
          <StarIcon size={16} /> All wrapped up! 🎄
        </div>
      )}
    </section>
  )
}
