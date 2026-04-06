import nodemailer from 'nodemailer'

/** Avoid hanging forever on blocked outbound SMTP (Render ↔ Gmail). */
export const SMTP_SOCKET_MS = 25_000

export function createSmtpTransport(opts) {
  return nodemailer.createTransport({
    ...opts,
    connectionTimeout: SMTP_SOCKET_MS,
    greetingTimeout: SMTP_SOCKET_MS,
    socketTimeout: SMTP_SOCKET_MS,
  })
}

/**
 * Build transporter from admin "draft" / "outbound" body (optional test-before-save).
 * @param {Record<string, unknown>} d
 * @returns {{ transport: import('nodemailer').Transporter, from: string } | null}
 */
export function buildMailerFromDraft(d) {
  if (!d || typeof d !== 'object') return null
  const host = String(d.smtpHost || '').trim()
  const user = String(d.smtpUser || '').trim()
  const pass = String(d.smtpPass || '').replace(/\s+/g, '').trim()
  if (!host || !user || !pass) return null
  if (pass.length > 256) return null
  const port = Number(d.smtpPort) || 587
  const secure = d.smtpSecure === true
  const from = String(d.mailFrom || '').trim() || user
  const transport = createSmtpTransport({ host, port, secure, auth: { user, pass } })
  return { transport, from }
}
