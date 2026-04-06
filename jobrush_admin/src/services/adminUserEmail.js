import { getEmailOutboundDraftForApi } from './adminDb'

const apiBase = () => String(import.meta.env.VITE_JOBRUSH_API_BASE || 'https://jobrush.onrender.com').replace(/\/$/, '')

/**
 * @param {{ toEmail: string, subject: string, text: string }} params
 */
export async function sendAdminUserEmail({ toEmail, subject, text }) {
  const secret = import.meta.env.VITE_ADMIN_API_SECRET
  if (!secret) {
    throw new Error(
      'Missing VITE_ADMIN_API_SECRET. Add it to the admin build environment (must match ADMIN_API_SECRET on the API server).'
    )
  }
  const outbound = await getEmailOutboundDraftForApi()
  const res = await fetch(`${apiBase()}/api/admin/send-user-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      toEmail,
      subject,
      text,
      ...(outbound ? { outbound } : {}),
    }),
  })
  const raw = await res.text()
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    body = { error: raw || res.statusText }
  }
  if (!res.ok) {
    throw new Error(body.error || res.statusText || 'Request failed')
  }
  return body
}
