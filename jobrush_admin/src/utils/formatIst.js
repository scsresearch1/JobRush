/** Format stored timestamps for admin tables (India Standard Time). */
export function formatTimestampIST(value) {
  if (value == null || value === '') return '—'
  const s = String(value)
  const d = Date.parse(s)
  if (Number.isNaN(d)) return s
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}
