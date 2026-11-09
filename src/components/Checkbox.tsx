import { CheckIcon } from './icons'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  size?: 'md' | 'lg'
}

/** Large circular check button with a 44px+ tap target. */
export function Checkbox({ checked, onChange, label, size = 'md' }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check check-${size}${checked ? ' is-checked' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="check-circle">
        <CheckIcon size={size === 'lg' ? 20 : 16} strokeWidth={3} />
      </span>
    </button>
  )
}
