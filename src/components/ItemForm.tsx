import { useState, type FormEvent } from 'react'
import type { Item, ItemInput } from '../db'
import { normaliseUrl, parsePriceToPence, penceToInput } from '../format'
import { Checkbox } from './Checkbox'
import { TrashIcon } from './icons'

interface Props {
  item?: Item
  onSubmit: (input: ItemInput) => void
  onCancel: () => void
  onDelete?: () => void
}

export function ItemForm({ item, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item ? penceToInput(item.pricePence) : '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [bought, setBought] = useState(item?.bought ?? false)

  const pricePence = parsePriceToPence(price)
  const priceInvalid = pricePence === null
  const canSave = name.trim() !== '' && !priceInvalid

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    onSubmit({ name: name.trim(), pricePence: pricePence ?? 0, url: normaliseUrl(url), bought })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Gift</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cosy jumper"
          autoFocus={!item}
          autoComplete="off"
          maxLength={120}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Price</span>
        <div className={`input-prefix${priceInvalid ? ' is-invalid' : ''}`}>
          <span aria-hidden="true">£</span>
          <input
            className="input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={priceInvalid}
          />
        </div>
        {priceInvalid && <span className="field-error">Enter a price like 12.99</span>}
      </label>

      <label className="field">
        <span className="field-label">
          Link <span className="field-optional">optional</span>
        </span>
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="amazon.co.uk/…"
          inputMode="url"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>

      <div className="toggle-row" onClick={() => setBought(!bought)}>
        <Checkbox checked={bought} onChange={setBought} label="Bought" />
        <span className="toggle-label">Bought</span>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>
          {item ? 'Save' : 'Add gift'}
        </button>
      </div>

      {onDelete && (
        <button type="button" className="btn btn-danger-text" onClick={onDelete}>
          <TrashIcon size={18} /> Delete gift
        </button>
      )}
    </form>
  )
}
