import nodemailer from 'nodemailer'

/**
 * Gmail (and others) from cloud hosts (e.g. Render) often time out on IPv6; IPv4 is reliable.
 * Override with SMTP_CONNECT_TIMEOUT_MS (ms) or SMTP_FORCE_IPV4=0 to skip family: 4.
 */
/** Fail fast when SMTP is used (no long hangs). Override with SMTP_CONNECT_TIMEOUT_MS. */
export const SMTP_SOCKET_MS = Number(process.env.SMTP_CONNECT_TIMEOUT_MS || 15_000)

export function createSmtpTransport(opts) {
  const port = Number(opts.port ?? 587)
  const useIpv4 = String(process.env.SMTP_FORCE_IPV4 || '1').toLowerCase() !== '0'
  return nodemailer.createTransport({
    ...opts,
    connectionTimeout: SMTP_SOCKET_MS,
    greetingTimeout: SMTP_SOCKET_MS,
    socketTimeout: SMTP_SOCKET_MS,
    ...(useIpv4 ? { family: 4 } : {}),
    ...(port === 587 && !opts.secure ? { requireTLS: true } : {}),
    tls: { minVersion: 'TLSv1.2', ...(typeof opts.tls === 'object' ? opts.tls : {}) },
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
