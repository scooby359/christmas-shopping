const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatGBP(pence: number): string {
  return gbp.format(pence / 100)
}

/** Value to show in a price input, e.g. 1250 -> "12.50", 0 -> "". */
export function penceToInput(pence: number): string {
  return pence ? (pence / 100).toFixed(2) : ''
}

/** Parse user input like "12", "12.5", "£12.50", "1,200" into pence. Returns null if invalid. */
export function parsePriceToPence(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '')
  if (cleaned === '') return 0
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '.') return null
  return Math.round(parseFloat(cleaned) * 100)
}

/** Add https:// when the user types "amazon.co.uk/thing". Returns undefined for empty input. */
export function normaliseUrl(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Only allow http(s) links to be opened. */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined
  } catch {
    return undefined
  }
}

/** "https://www.amazon.co.uk/dp/123" -> "amazon.co.uk" */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

export function daysUntilChristmas(now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let xmas = new Date(now.getFullYear(), 11, 25)
  if (today > xmas) xmas = new Date(now.getFullYear() + 1, 11, 25)
  return Math.round((xmas.getTime() - today.getTime()) / 86_400_000)
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`
}
