interface Props {
  value: number
  max: number
  label: string
  thin?: boolean
}

export function ProgressBar({ value, max, label, thin }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className={`progress${thin ? ' progress-thin' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
