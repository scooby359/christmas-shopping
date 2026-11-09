import { useState, type FormEvent } from 'react'

interface Props {
  initialName?: string
  submitLabel: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function PersonForm({ initialName = '', submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onSubmit(name.trim())
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mum"
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={80}
          required
        />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
