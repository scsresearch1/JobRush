/**
 * Timestamp utilities - IST (Indian Standard Time, UTC+5:30)
 */

const IST_TZ = 'Asia/Kolkata'

/**
 * Get current timestamp in IST as ISO-8601 string (e.g. 2026-03-14T20:54:40+05:30)
 * @returns {string}
 */
export function getISTTimestamp() {
  const d = new Date()
  const s = d.toLocaleString('en-IN', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  // s = "14/03/2026, 20:54:40"
  const [datePart, timePart] = s.split(', ')
  const [day, month, year] = datePart.split('/')
  return `${year}-${month}-${day}T${timePart}+05:30`
}

/**
 * Format a date for display in IST
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {string}
 */
export function formatDateIST(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleString('en-IN', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}
