import React, { useState, useEffect } from 'react'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { getAdminCredentials } from '../services/adminDb'

export default function SettingsEmail() {
  const { changeAdminUsername } = useAuth()
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setSubmitting(true)
    const result = await changeAdminUsername(currentPassword, newEmail)
    setSubmitting(false)
    if (result.ok) {
      setCurrentPassword('')
      setCurrentUsername(newEmail.trim())
      setNewEmail('')
      setMessage({
        type: 'ok',
        text: 'Admin login email (username) updated. Sign in with the new value next time.',
      })
    } else {
      setMessage({ type: 'error', text: result.error || 'Could not update admin email.' })
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-2">Change admin email</h1>
      <p className="text-admin-300 text-sm mb-8">
        Updates the login username in <code className="text-admin-400 text-xs">adminPortal/credentials</code> in Firebase — permanent until changed again.
      </p>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-admin-800">
            <EnvelopeIcon className="w-6 h-6 text-admin-300" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Change admin email</h2>
            <p className="text-xs text-admin-400">Current: {currentUsername || '—'}</p>
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
            <label className="block text-sm font-medium text-admin-200 mb-1.5">New admin email / username</label>
            <input
              type="text"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. admin@yourcompany.com"
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
            {submitting ? 'Saving…' : 'Update admin email'}
          </button>
        </form>
      </div>
    </div>
  )
}
