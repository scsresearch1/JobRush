import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LockClosedIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/24/outline'
import { isFirebaseWebConfigReady } from '../config/firebase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { ready, authenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!ready) {
    return (
      <div className="min-h-screen bg-admin-950 flex items-center justify-center text-admin-300">
        Loading…
      </div>
    )
  }

  if (authenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) {
      setError('Please enter your admin username.')
      return
    }
    if (!password) {
      setError('Please enter your admin password.')
      return
    }
    setSubmitting(true)
    const result = await login(username, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-admin-950 via-admin-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-admin-600 mb-4">
            <ShieldCheckIcon className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">JobRush Admin</h1>
          <p className="text-admin-300 text-sm mt-2">Sign in with admin username and password from Firebase</p>
        </div>
        {!isFirebaseWebConfigReady() && (
          <div className="mb-4 rounded-xl border border-amber-700/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
            This build has no <code className="text-amber-100">VITE_FIREBASE_API_KEY</code>. Add your Firebase web
            variables to Netlify (or root <code className="text-amber-100">.env.local</code> locally) and redeploy.
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="bg-admin-900/90 border border-admin-700 rounded-2xl p-8 shadow-xl"
        >
          <label className="block text-sm font-medium text-admin-200 mb-2">Username</label>
          <div className="relative mb-4">
            <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-admin-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-admin-950 border border-admin-600 text-white placeholder-admin-600 focus:ring-2 focus:ring-admin-500 focus:border-transparent"
              placeholder="Username"
              autoComplete="username"
            />
          </div>
          <label className="block text-sm font-medium text-admin-200 mb-2">Password</label>
          <div className="relative">
            <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-admin-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-admin-950 border border-admin-600 text-white placeholder-admin-600 focus:ring-2 focus:ring-admin-500 focus:border-transparent"
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="w-full mt-6 py-3 rounded-xl bg-admin-600 hover:bg-admin-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Sign in
          </button>
        </form>
        <p className="text-center text-xs text-admin-500 mt-6">
          Credentials live in Firebase at <code className="text-admin-400">adminPortal/credentials</code>.
        </p>
      </div>
    </div>
  )
}
