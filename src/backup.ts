import type { AppData, BackupFile } from '../shared/types'

/** Download the current data as a JSON file. */
export function exportData(data: AppData): void {
  const file: BackupFile = {
    app: 'christmas-shopping',
    version: 1,
    exportedAt: new Date().toISOString(),
    people: data.people,
    items: data.items,
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `christmas-shopping-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Read a backup file and do a quick shape check (the server validates it fully). */
export async function readBackup(file: File): Promise<BackupFile> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  const f = json as Partial<BackupFile> | null
  if (!f || f.app !== 'christmas-shopping' || !Array.isArray(f.people) || !Array.isArray(f.items)) {
    throw new Error("That doesn't look like a Christmas Shopping export.")
  }
  return f as BackupFile
}
