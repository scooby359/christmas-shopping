import { daysUntilChristmas } from '../format'
import { SnowflakeIcon } from './icons'

export function Countdown() {
  const days = daysUntilChristmas()
  const text =
    days === 0 ? 'Merry Christmas!' : days === 1 ? '1 day to Christmas' : `${days} days to Christmas`
  return (
    <span className="chip">
      <SnowflakeIcon size={14} />
      {text}
    </span>
  )
}
