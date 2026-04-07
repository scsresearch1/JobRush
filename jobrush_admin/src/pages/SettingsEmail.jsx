import React, { useState, useEffect } from 'react'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { getAdminCredentials, getNewUserNotifyEmail, setNewUserNotifyEmail } from '../services/adminDb'

/** Avoid stuck "Saving…" when Firebase never resolves. */
function withTimeout(promise, ms, actionLabel) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${actionLabel} timed out after ${Math.round(ms / 1000)}s.`))
      }, ms)
    }),
  ])
}

export default function SettingsEmail() {
  const { changeAdminUsername } = useAuth()
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newUserNotifyTo, setNewUserNotifyTo] = useState('hirefortune90@gmail.com')
  const [emailSaving, setEmailSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [creds, notifyTo] = await Promise.all([getAdminCredentials(), getNewUserNotifyEmail()])
        if (!cancelled && creds?.username) setCurrentUsername(creds.username)
        if (!cancelled && notifyTo) setNewUserNotifyTo(notifyTo)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const handleSaveNotifyRecipient = async (e) => {
    e.preventDefault()
    const candidate = String(newUserNotifyTo || '').trim().toLowerCase()
    if (!candidate || !candidate.includes('@')) {
      setMessage({ type: 'error', text: 'Enter a valid recipient email for new-user notifications.' })
      return
    }
    setEmailSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await withTimeout(setNewUserNotifyEmail(candidate), 25000, 'Save new-user notification recipient')
      setMessage({
        type: 'ok',
        text: `Saved. New user registration emails will be sent to ${candidate}.`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Could not save notification recipient.' })
    } finally {
      setEmailSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-admin-300 text-sm mb-8">
          Change your admin sign-in. Email workflow is active via Resend with fixed sender identities for onboarding,
          approval, and reports.
        </p>

        <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-admin-800">
              <EnvelopeIcon className="w-6 h-6 text-admin-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Admin sign-in</h2>
              <p className="text-xs text-admin-400">Username: {currentUsername || '—'} (quick update, minimal verification)</p>
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

        <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-admin-800">
              <EnvelopeIcon className="w-6 h-6 text-admin-300" />
            </div>
            <div>
              <h2 className="font-semibold text-white">New user registration notifications</h2>
              <p className="text-xs text-admin-400">From: NewUser@resend.dev · To: configurable admin inbox</p>
            </div>
          </div>

          <form onSubmit={handleSaveNotifyRecipient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-admin-200 mb-1.5">
                Recipient email for new user registration
              </label>
              <input
                type="email"
                value={newUserNotifyTo}
                onChange={(e) => setNewUserNotifyTo(e.target.value)}
                placeholder="e.g. hirefortune90@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent placeholder:text-admin-600"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={emailSaving || !newUserNotifyTo.trim()}
              className="w-full py-3 rounded-xl bg-admin-600 hover:bg-admin-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {emailSaving ? 'Saving…' : 'Save notification recipient'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
