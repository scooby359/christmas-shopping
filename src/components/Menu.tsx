import { useEffect, useRef, useState } from 'react'
import { exportData, readBackup, replaceAllData } from '../backup'
import { plural } from '../format'
import { useToast } from './Toast'
import { DownloadIcon, MoreIcon, UploadIcon } from './icons'

export function Menu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onExport = async () => {
    setOpen(false)
    try {
      await exportData()
      toast('Exported your list')
    } catch {
      toast('Export failed')
    }
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = await readBackup(file)
      const ok = window.confirm(
        `Import ${plural(data.people.length, 'person', 'people')} and ${plural(data.items.length, 'gift')}?\n\nThis replaces everything currently in the app.`,
      )
      if (!ok) return
      await replaceAllData(data)
      toast(`Imported ${plural(data.people.length, 'person', 'people')}`)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn icon-btn-on-dark"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={onExport}>
            <DownloadIcon size={18} /> Export as JSON
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
          >
            <UploadIcon size={18} /> Import from JSON
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onImportFile(e.target.files?.[0])}
      />
    </div>
  )
}
