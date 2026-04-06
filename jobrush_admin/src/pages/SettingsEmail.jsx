import React, { useState, useEffect } from 'react'
import { EnvelopeIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { getAdminCredentials, getEmailOutboundSettings, getEmailOutboundDraftForApi } from '../services/adminDb'
import { sendTestEmail } from '../services/sendTestEmail'

/** Standard Gmail / Google SMTP (app password flow). Addresses are yours — not preset. */
const GMAIL_SMTP_DEFAULTS = {
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
}

const PLACEHOLDER_GMAIL_ADDRESS = 'you@gmail.com'

/** Avoid stuck "Saving…" when Firebase never resolves (wrong DB URL, rules, offline). */
function withTimeout(promise, ms, actionLabel) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `${actionLabel} timed out after ${Math.round(ms / 1000)}s. Check Firebase RTDB rules, firebaseJobbrushDefaults.js matches your project, and your network is OK.`
          )
        )
      }, ms)
    }),
  ])
}

function emptyGmailOutboundForm() {
  return {
    mailFrom: '',
    smtpHost: GMAIL_SMTP_DEFAULTS.smtpHost,
    smtpPort: GMAIL_SMTP_DEFAULTS.smtpPort,
    smtpSecure: GMAIL_SMTP_DEFAULTS.smtpSecure,
    smtpUser: '',
    hasPass: false,
  }
}

export default function SettingsEmail() {
  const { changeAdminUsername, saveEmailOutbound } = useAuth()
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpMessage, setSmtpMessage] = useState({ type: '', text: '' })
  const [smtpSubmitting, setSmtpSubmitting] = useState(false)
  const [smtpAdminPassword, setSmtpAdminPassword] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testMsg, setTestMsg] = useState({ type: '', text: '' })
  const [outbound, setOutbound] = useState(() => emptyGmailOutboundForm())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const creds = await getAdminCredentials()
        if (!cancelled && creds?.username) setCurrentUsername(creds.username)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await getEmailOutboundSettings()
        if (cancelled) return
        if (!s) {
          setOutbound(emptyGmailOutboundForm())
          return
        }
        setOutbound({
          mailFrom: s.mailFrom || '',
          smtpHost: (s.smtpHost || '').trim() || GMAIL_SMTP_DEFAULTS.smtpHost,
          smtpPort: Number(s.smtpPort) || GMAIL_SMTP_DEFAULTS.smtpPort,
          smtpSecure: s.smtpSecure === true,
          smtpUser: s.smtpUser || '',
          hasPass: s.hasPass,
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setTestTo((prev) => (prev === '' && outbound.mailFrom ? outbound.mailFrom : prev))
  }, [outbound.mailFrom])

  const testRecipient = () => (testTo.trim() || outbound.mailFrom.trim())
  const testRecipientLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient())

  const handleSendTest = async () => {
    const to = testRecipient()
    if (!testRecipientLooksValid) {
      setTestMsg({ type: 'error', text: 'Enter a valid destination email (or fill Mail From above).' })
      return
    }
    setTestBusy(true)
    setTestMsg({ type: '', text: '' })
    try {
      const passTrim = smtpPassword.replace(/\s+/g, '').trim()
      let draft =
        passTrim &&
        outbound.mailFrom.trim() &&
        outbound.smtpHost.trim() &&
        outbound.smtpUser.trim()
          ? {
              mailFrom: outbound.mailFrom.trim(),
              smtpHost: outbound.smtpHost.trim(),
              smtpPort: outbound.smtpPort,
              smtpSecure: outbound.smtpSecure,
              smtpUser: outbound.smtpUser.trim(),
              smtpPass: passTrim,
            }
          : undefined
      if (!draft) {
        draft = (await getEmailOutboundDraftForApi()) ?? undefined
      }
      await sendTestEmail({ toEmail: to, draft })
      setTestMsg({ type: 'ok', text: `Test email sent to ${to}. Check inbox and spam.` })
    } catch (e) {
      setTestMsg({ type: 'error', text: e?.message || 'Failed to send test email.' })
    } finally {
      setTestBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setSubmitting(true)
    try {
      const result = await withTimeout(changeAdminUsername(currentPassword, newEmail), 25000, 'Update admin login')
      if (result.ok) {
        setCurrentPassword('')
        setCurrentUsername(newEmail.trim())
        setNewEmail('')
        setMessage({
          type: 'ok',
          text: 'Admin login updated. Use the new username next time you sign in.',
        })
      } else {
        setMessage({ type: 'error', text: result.error || 'Could not update admin login.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Could not update admin login.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSmtpSubmit = async (e) => {
    e.preventDefault()
    setSmtpMessage({ type: '', text: '' })
    setSmtpSubmitting(true)
    try {
      const result = await withTimeout(
        saveEmailOutbound(smtpAdminPassword, {
          mailFrom: outbound.mailFrom,
          smtpHost: outbound.smtpHost,
          smtpPort: outbound.smtpPort,
          smtpSecure: outbound.smtpSecure,
          smtpUser: outbound.smtpUser,
          smtpPass: smtpPassword,
        }),
        25000,
        'Save outbound email'
      )
      if (result.ok) {
        setSmtpAdminPassword('')
        setSmtpPassword('')
        setOutbound((o) => ({ ...o, hasPass: true }))
        setSmtpMessage({
          type: 'ok',
          text: 'Outbound email settings saved.',
        })
      } else {
        setSmtpMessage({ type: 'error', text: result.error || 'Could not save email settings.' })
      }
    } catch (err) {
      setSmtpMessage({ type: 'error', text: err?.message || 'Could not save email settings.' })
    } finally {
      setSmtpSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-admin-300 text-sm mb-8">Change your admin sign-in or outbound mail (SMTP).</p>

        <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-admin-800">
              <EnvelopeIcon className="w-6 h-6 text-admin-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Admin sign-in</h2>
              <p className="text-xs text-admin-400">Username: {currentUsername || '—'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-admin-200 mb-1.5">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-admin-200 mb-1.5">New username</label>
              <input
                type="text"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. you@gmail.com or jadm"
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
                autoComplete="username"
              />
            </div>

            {message.text && (
              <p
                className={`text-sm ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
                role="alert"
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !currentPassword || !newEmail.trim()}
              className="w-full py-3 rounded-xl bg-admin-600 hover:bg-admin-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? 'Saving…' : 'Update username'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-admin-800">
            <PaperAirplaneIcon className="w-6 h-6 text-admin-300" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Outbound email (SMTP)</h2>
            <p className="text-xs text-admin-400">
              Used by the JobRush API for payment decisions and “email user” actions.{' '}
              {outbound.hasPass ? (
                <span className="text-emerald-400/90">App password saved in Firebase.</span>
              ) : (
                <span className="text-amber-400/90">No app password saved yet.</span>
              )}
            </p>
          </div>
        </div>

        <p className="text-xs text-admin-500 mb-4 leading-relaxed">
          For Gmail: use an <strong className="text-admin-400">app password</strong> (Google Account → Security → App
          passwords), not your normal password. Defaults below match Gmail on port 587.
        </p>

        <form onSubmit={handleSmtpSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-admin-200 mb-1.5">Mail “From” address</label>
            <input
              type="email"
              value={outbound.mailFrom}
              onChange={(e) => setOutbound((o) => ({ ...o, mailFrom: e.target.value }))}
              placeholder={PLACEHOLDER_GMAIL_ADDRESS}
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              autoComplete="off"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-sm font-medium text-admin-200">SMTP host</label>
                <button
                  type="button"
                  onClick={() =>
                    setOutbound((o) => ({
                      ...o,
                      smtpHost: GMAIL_SMTP_DEFAULTS.smtpHost,
                      smtpPort: GMAIL_SMTP_DEFAULTS.smtpPort,
                      smtpSecure: GMAIL_SMTP_DEFAULTS.smtpSecure,
                    }))
                  }
                  className="text-xs font-medium text-admin-400 hover:text-admin-200 underline underline-offset-2"
                >
                  Reset Gmail SMTP defaults
                </button>
              </div>
              <input
                type="text"
                value={outbound.smtpHost}
                onChange={(e) => setOutbound((o) => ({ ...o, smtpHost: e.target.value }))}
                placeholder={GMAIL_SMTP_DEFAULTS.smtpHost}
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-admin-200 mb-1.5">SMTP port</label>
              <input
                type="number"
                value={outbound.smtpPort}
                onChange={(e) =>
                  setOutbound((o) => ({ ...o, smtpPort: Number(e.target.value) || GMAIL_SMTP_DEFAULTS.smtpPort }))
                }
                placeholder={String(GMAIL_SMTP_DEFAULTS.smtpPort)}
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-200 cursor-pointer">
            <input
              type="checkbox"
              checked={outbound.smtpSecure}
              onChange={(e) => setOutbound((o) => ({ ...o, smtpSecure: e.target.checked }))}
              className="rounded border-admin-600 bg-admin-950 text-admin-600 focus:ring-admin-500"
            />
            SMTP secure (SSL) — <span className="text-admin-400">off</span> for Gmail on port 587 (default)
          </label>
          <div>
            <label className="block text-sm font-medium text-admin-200 mb-1.5">SMTP username</label>
            <input
              type="text"
              value={outbound.smtpUser}
              onChange={(e) => setOutbound((o) => ({ ...o, smtpUser: e.target.value }))}
              placeholder={PLACEHOLDER_GMAIL_ADDRESS}
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-admin-500">Usually the same full Gmail address as “From”.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-200 mb-1.5">SMTP app password</label>
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder={outbound.hasPass ? 'Leave blank to keep the saved password' : '16-character Gmail app password'}
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-200 mb-1.5">Password</label>
            <input
              type="password"
              value={smtpAdminPassword}
              onChange={(e) => setSmtpAdminPassword(e.target.value)}
              placeholder="Your admin sign-in password"
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
              autoComplete="current-password"
            />
          </div>

          {smtpMessage.text && (
            <p
              className={`text-sm ${smtpMessage.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              role="alert"
            >
              {smtpMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={
              smtpSubmitting ||
              !smtpAdminPassword ||
              (!outbound.hasPass && !smtpPassword) ||
              !outbound.mailFrom.trim() ||
              !outbound.smtpHost.trim() ||
              !outbound.smtpUser.trim()
            }
            className="w-full py-3 rounded-xl bg-admin-600 hover:bg-admin-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {smtpSubmitting ? 'Saving…' : 'Save outbound email settings'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-admin-800">
          <h3 className="text-sm font-semibold text-white mb-1">Send test email</h3>
          <p className="text-xs text-admin-500 mb-4 leading-relaxed">
            Sends through the JobRush API using saved SMTP settings (or the app password field above if you just typed
            it and have not saved yet).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-admin-200 mb-1.5">Send test to</label>
              <input
                type="email"
                value={testTo}
                onChange={(e) => {
                  setTestTo(e.target.value)
                  setTestMsg({ type: '', text: '' })
                }}
                placeholder={outbound.mailFrom.trim() || PLACEHOLDER_GMAIL_ADDRESS}
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testBusy || !testRecipientLooksValid}
              className="shrink-0 px-5 py-2.5 rounded-xl border border-admin-500 text-admin-100 font-semibold hover:bg-admin-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {testBusy ? 'Sending…' : 'Send test email'}
            </button>
          </div>
          {testMsg.text && (
            <p
              className={`mt-3 text-sm ${testMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              role="status"
            >
              {testMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
