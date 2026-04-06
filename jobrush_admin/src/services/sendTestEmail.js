const apiBase = () => String(import.meta.env.VITE_JOBRUSH_API_BASE || 'https://jobrush.onrender.com').replace(/\/$/, '')

/**
 * @param {{
 *   toEmail: string
 *   draft?: { mailFrom: string, smtpHost: string, smtpPort: number, smtpSecure: boolean, smtpUser: string, smtpPass: string }
 * }} params — pass `draft` to test the current form (including a newly typed app password) before saving to Firebase
 */
export async function sendTestEmail({ toEmail, draft }) {
  const secret = import.meta.env.VITE_ADMIN_API_SECRET
  if (!secret) {
    throw new Error(
      'Missing VITE_ADMIN_API_SECRET. Add it to the admin build environment (must match ADMIN_API_SECRET on the API server).'
    )
  }

  const controller = new AbortController()
  /** One request, no client-side retries. Allow Render cold start + single send path. */
  const timeoutMs = 55000
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${apiBase()}/api/admin/send-test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ toEmail, draft }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${timeoutMs / 1000}s. Open ${apiBase()}/api/health first to wake the API, then send again. For fastest delivery, set RESEND_API_KEY on the server.`
      )
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
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
