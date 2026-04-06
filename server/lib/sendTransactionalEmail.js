/** One HTTPS round-trip; no retries. */
const RESEND_TIMEOUT_MS = Number(process.env.RESEND_TIMEOUT_MS || 12_000)

/**
 * Sends mail via Resend (HTTPS) when RESEND_API_KEY is set — reliable from Render and other PaaS.
 * Otherwise uses Nodemailer SMTP (mailer must be non-null).
 *
 * @param {{
 *   to: string
 *   subject: string
 *   text: string
 *   replyTo?: string
 *   mailer?: { transport: import('nodemailer').Transporter, from: string } | null
 *   fallbackFrom?: string
 * }} p
 */
export async function sendTransactionalEmail({ to, subject, text, replyTo, mailer, fallbackFrom }) {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (resendKey) {
    const fromRaw =
      process.env.RESEND_FROM?.trim() ||
      (mailer && String(mailer.from || '').trim()) ||
      (fallbackFrom && String(fallbackFrom).includes('@') ? String(fallbackFrom).trim() : '') ||
      'onboarding@resend.dev'
    const fromHeader = fromRaw.includes('<') ? fromRaw : `JobRush <${fromRaw}>`

    const body = {
      from: fromHeader,
      to: [to],
      subject,
      text,
    }
    if (replyTo && String(replyTo).includes('@')) {
      body.reply_to = [String(replyTo).trim()]
    }

    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), RESEND_TIMEOUT_MS)
    let r
    try {
      r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error(`Resend request timed out after ${RESEND_TIMEOUT_MS / 1000}s`)
      }
      throw e
    } finally {
      clearTimeout(t)
    }
    const raw = await r.text()
    let json
    try {
      json = JSON.parse(raw)
    } catch {
      json = { message: raw }
    }
    if (!r.ok) {
      const msg =
        json.message ||
        (Array.isArray(json.errors) && json.errors.map((e) => e.message).join('; ')) ||
        json.error ||
        `Resend HTTP ${r.status}`
      throw new Error(msg)
    }
    return
  }

  if (!mailer?.transport) {
    const err = new Error(
      'Email is not configured. Set RESEND_API_KEY on the API (recommended for Render), or configure SMTP in admin Settings / env.'
    )
    err.code = 'EMAIL_NOT_CONFIGURED'
    throw err
  }

  await mailer.transport.sendMail({
    from: mailer.from,
    to,
    subject,
    text,
    ...(replyTo && String(replyTo).includes('@') ? { replyTo: String(replyTo).trim() } : {}),
  })
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}
