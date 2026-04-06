import { getEmailOutboundDraftForApi } from './adminDb'

const apiBase = () => String(import.meta.env.VITE_JOBRUSH_API_BASE || 'https://jobrush.onrender.com').replace(/\/$/, '')

/**
 * @param {{ toEmail: string, decision: 'approved' | 'rejected', paymentReference?: string, userLabel?: string }} params
 */
export async function sendPaymentDecisionEmail({ toEmail, decision, paymentReference, userLabel }) {
  const secret = import.meta.env.VITE_ADMIN_API_SECRET
  if (!secret) {
    throw new Error(
      'Missing VITE_ADMIN_API_SECRET. Add it to the admin build environment (must match ADMIN_API_SECRET on the API server).'
    )
  }
  const outbound = await getEmailOutboundDraftForApi()
  const res = await fetch(`${apiBase()}/api/admin/notify-payment-decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      toEmail,
      decision,
      paymentReference: paymentReference || '',
      userLabel: userLabel || '',
      ...(outbound ? { outbound } : {}),
    }),
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { error: text || res.statusText }
  }
  if (!res.ok) {
    throw new Error(body.error || res.statusText || 'Request failed')
  }
  return body
}
