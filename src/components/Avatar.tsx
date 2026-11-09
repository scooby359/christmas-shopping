const HUES = [352, 150, 40, 200, 12, 280, 170, 320]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const hue = HUES[hash(name.toLowerCase()) % HUES.length]
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, ['--hue' as string]: hue }}
    >
      {initial}
    </span>
  )
}
