import React, { useState } from 'react'
import { XMarkIcon, EnvelopeIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { saveUser, getUserByEmail, touchUserLastSeen } from '../services/database'
import { USERDB_FIELDS } from '../config/databaseSchema'
import { getISTTimestamp } from '../utils/timestamp.js'
import { mapFirebaseUserToLocal, computePostEmailFlow } from '../utils/journeyState.js'

const EmailCaptureModal = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    setIsLoading(true)

    try {
      let existing = null
      try {
        existing = await getUserByEmail(normalizedEmail)
      } catch (lookupErr) {
        console.error('Firebase lookup failed:', lookupErr)
        setError('Could not reach Firebase. Check .env.local (see .env.example).')
        setIsLoading(false)
        return
      }

      if (existing) {
        const { uniqueId, data } = existing
        const flow = computePostEmailFlow(data)
        if (flow.kind === 'blocked_suspended') {
          setError('This account is suspended. Please contact support.')
          setIsLoading(false)
          return
        }
        try {
          await touchUserLastSeen(uniqueId)
        } catch {
          /* non-fatal */
        }
        const userData = {
          ...mapFirebaseUserToLocal(data, uniqueId, {}),
          loginTime: getISTTimestamp(),
        }
        localStorage.setItem('jobRush_user', JSON.stringify(userData))
        onSuccess({ user: userData, flow })
        onClose()
        setIsLoading(false)
        return
      }

      const uniqueId = crypto.randomUUID?.() || `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
      try {
        await saveUser(uniqueId, normalizedEmail, {
          [USERDB_FIELDS.ACCESS_STATUS]: 'pending_payment',
          [USERDB_FIELDS.LAST_SEEN_AT]: new Date().toISOString(),
        })
      } catch (firebaseErr) {
        console.error('Firebase save failed:', firebaseErr)
        setError('Could not save to Firebase. Add your web config to .env.local (see .env.example)')
        setIsLoading(false)
        return
      }
      const userData = {
        uniqueId,
        email: normalizedEmail,
        isAuthenticated: false,
        accessStatus: 'pending_payment',
        atsChecksUsed: 0,
        mockInterviewsUsed: 0,
        loginTime: getISTTimestamp(),
      }
      localStorage.setItem('jobRush_user', JSON.stringify(userData))
      onSuccess({ user: userData, flow: { kind: 'payment_offer' } })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in">
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/90 hover:text-white transition p-2 hover:bg-white/20 rounded-lg"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
              <EnvelopeIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Start Your Journey</h2>
              <p className="text-primary-100 text-sm">Enter your email to get started</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="your.email@example.com"
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition outline-none"
                disabled={isLoading}
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-4 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving to Firebase...</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRightIcon className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmailCaptureModal
