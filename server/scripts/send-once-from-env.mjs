/**
 * One-off real SMTP send. Usage (PowerShell):
 *   $env:SMTP_HOST="smtp.gmail.com"; $env:SMTP_USER="you@gmail.com"; $env:SMTP_PASS="xxxx"; node scripts/send-once-from-env.mjs
 * Optional: TEST_TO (default = SMTP_USER), MAIL_FROM, SMTP_PORT
 */
import { createSmtpTransport } from '../lib/smtpMailer.js'

const host = String(process.env.SMTP_HOST || '').trim()
const user = String(process.env.SMTP_USER || '').trim()
const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
const port = Number(process.env.SMTP_PORT || 587)
const from = String(process.env.MAIL_FROM || user).trim()
const to = String(process.env.TEST_TO || user).trim()

if (!host || !user || !pass) {
  console.error('Set SMTP_HOST, SMTP_USER, SMTP_PASS')
  process.exit(1)
}

const transport = createSmtpTransport({ host, port, secure: false, auth: { user, pass } })
await transport.sendMail({
  from,
  to,
  subject: 'JobRush — real SMTP test',
  text: `This is a live test from JobRush server code (send-once-from-env.mjs).\n\nTime: ${new Date().toISOString()}\n`,
})
console.log('Sent OK to', to)
process.exit(0)
