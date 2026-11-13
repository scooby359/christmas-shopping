import { useEffect, useRef, useState } from 'react'
import { exportData, readBackup } from '../backup'
import { plural } from '../format'
import { importBackup, useStore } from '../store'
import { useToast } from './Toast'
import { DownloadIcon, LogOutIcon, MoreIcon, UploadIcon } from './icons'

export function Menu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { data, email } = useStore()
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

  const onExport = () => {
    setOpen(false)
    exportData(data)
    toast('Exported your list')
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const backup = await readBackup(file)
      const ok = window.confirm(
        `Import ${plural(backup.people.length, 'person', 'people')} and ${plural(backup.items.length, 'gift')}?\n\nThis replaces everything currently in your list, on all your devices.`,
      )
      if (!ok) return
      const result = await importBackup(backup)
      toast(`Imported ${plural(result.people, 'person', 'people')}`)
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
          {email && (
            <div className="menu-account">
              <span className="menu-account-label">Signed in as</span>
              <span className="menu-account-email">{email}</span>
            </div>
          )}
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
          <div className="menu-divider" />
          {/* Cloudflare Access's built-in logout endpoint. */}
          <a role="menuitem" className="menu-item" href="/cdn-cgi/access/logout">
            <LogOutIcon size={18} /> Sign out
          </a>
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
