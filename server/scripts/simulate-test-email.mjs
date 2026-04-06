/**
 * Simulates POST /api/admin/send-test-email mail composition using the same
 * buildMailerFromDraft as production, but delivers via jsonTransport (no TCP/SMTP).
 *
 * Run from repo root: node server/scripts/simulate-test-email.mjs
 * Or from server/:    node scripts/simulate-test-email.mjs
 */
import nodemailer from 'nodemailer'
import { buildMailerFromDraft } from '../lib/smtpMailer.js'

const draft = {
  mailFrom: 'sender@example.com',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'sender@example.com',
  smtpPass: 'abcdefghijklmnop',
}

const mailer = buildMailerFromDraft(draft)
if (!mailer) {
  console.error('simulate-test-email: buildMailerFromDraft returned null')
  process.exit(1)
}

mailer.transport.close()

const toEmail = 'recipient@example.com'
const subject = 'JobRush — test email'
const text = `This is a test message from the JobRush API.\n\nIf you received this, outbound SMTP is working.\n\nSent at ${new Date().toISOString()}\n`

const jsonTransport = nodemailer.createTransport({ jsonTransport: true })
const info = await jsonTransport.sendMail({
  from: mailer.from,
  to: toEmail,
  subject,
  text,
})

const envelope = JSON.parse(info.message)
const fromAddr =
  typeof envelope.from === 'string' ? envelope.from : envelope.from?.address || ''
const toAddr = Array.isArray(envelope.to)
  ? envelope.to[0]?.address || ''
  : typeof envelope.to === 'string'
    ? envelope.to
    : envelope.to?.address || ''

const ok =
  fromAddr === mailer.from &&
  toAddr === toEmail &&
  envelope.subject === subject &&
  typeof envelope.text === 'string' &&
  envelope.text.includes('JobRush API')

if (!ok) {
  console.error('simulate-test-email: envelope mismatch', envelope)
  process.exit(1)
}

console.log('simulate-test-email: OK (jsonTransport — no real SMTP)')
console.log('  from:', fromAddr)
console.log('  to:', toAddr)
console.log('  subject:', envelope.subject)
