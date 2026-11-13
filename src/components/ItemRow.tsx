import type { Item } from '../../shared/types'
import { updateItem } from '../store'
import { displayDomain, formatGBP, safeHref } from '../format'
import { Checkbox } from './Checkbox'
import { ExternalIcon } from './icons'

interface Props {
  item: Item
  onEdit: () => void
}

export function ItemRow({ item, onEdit }: Props) {
  const href = safeHref(item.url)
  return (
    <li className={`item-row${item.bought ? ' is-bought' : ''}`}>
      <Checkbox
        checked={item.bought}
        onChange={(bought) => updateItem(item.id, { bought })}
        label={`Bought ${item.name}`}
      />
      <button type="button" className="item-body" onClick={onEdit} aria-label={`Edit ${item.name}`}>
        <span className="item-name">{item.name}</span>
        <span className="item-price money">{formatGBP(item.pricePence)}</span>
      </button>
      {href && (
        <a
          className="link-pill"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open link for ${item.name}`}
        >
          <span className="link-domain">{displayDomain(href)}</span>
          <ExternalIcon size={14} />
        </a>
      )}
    </li>
  )
}
