const API_BASE =
  import.meta.env.VITE_JOBRUSH_API_BASE || (import.meta.env.PROD ? 'https://jobrush.onrender.com' : 'http://localhost:3001')

const ADMIN_API_SECRET = String(import.meta.env.VITE_ADMIN_API_SECRET || '').trim()

function makeUrl(path) {
  return `${API_BASE}${path}`
}

async function postAdmin(path, body) {
  if (!ADMIN_API_SECRET) {
    throw new Error('VITE_ADMIN_API_SECRET is missing in admin environment.')
  }
  const res = await fetch(makeUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_API_SECRET}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || `API error: ${res.status}`)
  }
  return payload
}

export function sendPaymentDecisionEmail({ email, decision, paymentReference }) {
  return postAdmin('/api/admin/notify-payment-decision', {
    email,
    decision,
    paymentReference: paymentReference || null,
    approvedAt: new Date().toISOString(),
  })
}

/** Reminder for users in pending_payment — complete payment and submit valid transaction ID. */
export function sendPaymentPendingReminderEmail({ email }) {
  return postAdmin('/api/admin/notify-payment-pending', { email })
}

export function sendAdminUserEmail({ to, subject, message }) {
  return postAdmin('/api/admin/send-user-email', { to, subject, message })
}
