import React, { useState, useEffect } from 'react'
import { fetchPaymentQrImageUrlFromFirebase } from '../services/paymentQrFirebase.js'
import { resolvePaymentQrFallbackSrc } from '../config/paymentQr.js'
import { syncUserFieldsToFirebase } from '../services/database.js'
import {
  XMarkIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

const PLAN_AMOUNT_INR = 500
const RESUME_CORRECTIONS = 5
const MOCK_INTERVIEWS = 5

/**
 * Plan summary, coupon field (logic TBD), QR payment, payment reference capture,
 * and access request confirmation (Firebase + local state; outbound email disabled).
 */
const PaymentAccessModal = ({ isOpen, onClose, email, initialStep = 'offer', mode = 'activation' }) => {
  const isRenewal = mode === 'repayment'
  const [step, setStep] = useState('offer')
  const [couponCode, setCouponCode] = useState('')
  const [couponNotice, setCouponNotice] = useState('')
  const [upiReference, setUpiReference] = useState('')
  const [refError, setRefError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [qrSrc, setQrSrc] = useState(() => resolvePaymentQrFallbackSrc())

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const fromDb = await fetchPaymentQrImageUrlFromFirebase()
        if (!cancelled) setQrSrc(fromDb || resolvePaymentQrFallbackSrc())
      } catch {
        if (!cancelled) setQrSrc(resolvePaymentQrFallbackSrc())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setStep(initialStep)
    setCouponNotice('')
    setRefError('')
    setSubmitting(false)
    if (initialStep === 'offer') {
      setCouponCode('')
      setUpiReference('')
    }
  }, [isOpen, initialStep])

  if (!isOpen) return null

  const persistUserPatch = (patch) => {
    try {
      const raw = localStorage.getItem('jobRush_user')
      const prev = raw ? JSON.parse(raw) : {}
      const next = { ...prev, ...patch }
      localStorage.setItem('jobRush_user', JSON.stringify(next))
      const uid = next.uniqueId
      syncUserFieldsToFirebase(uid, patch).catch(() => {})
    } catch {
      /* ignore */
    }
  }

  const appendAccessRequestLog = (entry) => {
    try {
      const key = 'jobRush_access_requests'
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      prev.push({ ...entry, at: new Date().toISOString() })
      localStorage.setItem(key, JSON.stringify(prev))
    } catch {
      /* ignore */
    }
  }

  const handleApplyCoupon = () => {
    setCouponNotice(
      couponCode.trim()
        ? 'Coupon validation will be applied when your billing integration is connected. You may continue with payment.'
        : 'Enter a code above, or continue without a coupon.'
    )
  }

  const handlePaymentDone = () => {
    setStep('reference')
  }

  const handleRequestAccess = async (e) => {
    e?.preventDefault?.()
    const ref = upiReference.trim()
    if (ref.length < 6) {
      setRefError('Please enter a valid UPI or bank reference number (at least 6 characters).')
      return
    }
    setRefError('')
    setSubmitting(true)
    try {
      const patch = {
        accessStatus: 'awaiting_activation',
        paymentReference: ref,
        couponCodePending: couponCode.trim() || null,
        accessRequestedAt: new Date().toISOString(),
        isAuthenticated: false,
      }
      persistUserPatch(patch)
      appendAccessRequestLog({
        email,
        upiReference: ref,
        couponCode: couponCode.trim() || null,
      })
      setStep('confirmation')
    } catch (err) {
      setRefError(
        err?.message ||
          'We could not save your request. Check your connection and try again, or contact support with your payment reference.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetryPayment = () => {
    persistUserPatch({
      accessStatus: 'pending_payment',
      paymentReference: null,
      accessRequestedAt: null,
      couponCodePending: null,
    })
    setUpiReference('')
    setCouponCode('')
    setCouponNotice('')
    setRefError('')
    setStep('offer')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-access-title"
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-200"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="payment-access-title" className="text-lg font-semibold text-slate-900 tracking-tight">
                {isRenewal ? 'Renew JobRush access' : 'Activate JobRush access'}
              </h2>
              <p className="text-sm text-slate-500 truncate" title={email}>
                {email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {step !== 'confirmation' && (
            <ol className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <li className={step === 'offer' ? 'text-primary-600' : ''}>1. Payment</li>
              <span className="text-slate-300">/</span>
              <li className={step === 'reference' ? 'text-primary-600' : ''}>2. Reference</li>
              <span className="text-slate-300">/</span>
              <li>3. Confirmation</li>
            </ol>
          )}

          {step === 'offer' && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
                  <BanknotesIcon className="w-5 h-5 text-primary-600" />
                  {isRenewal
                    ? 'Included sessions used — renew your plan'
                    : 'Professional plan — one-time activation'}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  {isRenewal ? (
                    <>
                      You have used all included resume checks and mock interviews. A payment of{' '}
                      <span className="font-semibold text-slate-900">₹{PLAN_AMOUNT_INR.toLocaleString('en-IN')}</span>{' '}
                      starts a new cycle with the same allowances:
                    </>
                  ) : (
                    <>
                      A single payment of{' '}
                      <span className="font-semibold text-slate-900">₹{PLAN_AMOUNT_INR.toLocaleString('en-IN')}</span>{' '}
                      unlocks the following on your account:
                    </>
                  )}
                </p>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside marker:text-primary-500">
                  <li>
                    <span className="font-medium text-slate-900">{RESUME_CORRECTIONS}</span> AI-assisted resume
                    correction sessions
                  </li>
                  <li>
                    <span className="font-medium text-slate-900">{MOCK_INTERVIEWS}</span> AI mock interview
                    sessions
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  All features are subject to fair use and our terms of service. You will receive written confirmation
                  by email once payment is verified.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coupon code (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value)
                      setCouponNotice('')
                    }}
                    placeholder="Enter code if you have one"
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-200 focus:border-primary-500 outline-none text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="shrink-0 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Apply
                  </button>
                </div>
                {couponNotice && <p className="mt-2 text-xs text-slate-600">{couponNotice}</p>}
              </div>

              <div className="rounded-xl border border-slate-200 p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-800 font-medium text-sm mb-4">
                  <QrCodeIcon className="w-5 h-5 text-primary-600" />
                  Scan to pay with UPI
                </div>
                <div className="inline-block p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <img
                    src={qrSrc}
                    alt="UPI QR code — scan with PhonePe or any UPI app"
                    className="w-[220px] h-[220px] object-contain"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-4 max-w-xs mx-auto leading-relaxed">
                  Open PhonePe or any UPI app, scan the code, and pay exactly ₹
                  {PLAN_AMOUNT_INR.toLocaleString('en-IN')}. Enter the amount manually if your app does not pre-fill it.
                  Keep your transaction reference for the next step.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePaymentDone}
                className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-primary-700 transition shadow-md"
              >
                I have completed the payment
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'reference' && (
            <form onSubmit={handleRequestAccess} className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter the UPI transaction ID or bank reference number from your payment confirmation. Our team uses this
                to match your payment to your account.
              </p>
              <div>
                <label htmlFor="upi-ref" className="block text-sm font-medium text-slate-700 mb-2">
                  Payment reference number
                </label>
                <input
                  id="upi-ref"
                  type="text"
                  inputMode="text"
                  value={upiReference}
                  onChange={(e) => {
                    setUpiReference(e.target.value)
                    setRefError('')
                  }}
                  placeholder="e.g. UPI transaction ID or bank reference"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-200 focus:border-primary-500 outline-none text-sm font-mono"
                  autoComplete="off"
                />
                {refError && <p className="mt-2 text-sm text-red-600">{refError}</p>}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep('offer')}
                  className="sm:flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="sm:flex-[2] flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Request access'
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 'confirmation' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
                <p className="text-sm font-medium text-emerald-900 mb-2">Request received</p>
                <p className="text-sm text-emerald-900/90 leading-relaxed">
                  Thank you. Please check the email address you provided (
                  <span className="font-medium">{email}</span>) within approximately{' '}
                  <span className="font-semibold">30 minutes</span> for activation instructions.
                </p>
                <p className="text-sm text-emerald-900/85 leading-relaxed mt-3">
                  <span className="font-semibold">Important:</span> If we cannot match your payment using the reference
                  you submitted, access will not be granted. In that case, complete payment again and submit a new
                  reference, or contact support with proof of payment.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  Retry payment
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaymentAccessModal
