import React, { useState } from 'react'
import { KeyIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    setSubmitting(true)
    const result = await changePassword(currentPassword, newPassword)
    setSubmitting(false)
    if (result.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage({ type: 'ok', text: 'Password updated in Firebase. Use it next time you sign in.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Could not update password.' })
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-2">Account</h1>
      <p className="text-admin-300 text-sm mb-8">Change the admin password stored in Realtime Database.</p>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-admin-800">
            <KeyIcon className="w-6 h-6 text-admin-300" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Reset password</h2>
            <p className="text-xs text-admin-400">Requires your current password</p>
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
            <label className="block text-sm font-medium text-admin-200 mb-1.5">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-admin-200 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white focus:ring-2 focus:ring-admin-500 focus:border-transparent"
              autoComplete="new-password"
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
            disabled={
              submitting || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword
            }
            className="w-full py-3 rounded-xl bg-admin-600 hover:bg-admin-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
