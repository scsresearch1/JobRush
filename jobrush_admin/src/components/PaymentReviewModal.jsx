import React, { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export default function PaymentReviewModal({ open, row, email, paymentReference, onClose, onDecision }) {
  const [busy, setBusy] = useState(false)
  if (!open || !row) return null

  const run = async (decision) => {
    setBusy(true)
    try {
      await onDecision(decision)
      onClose()
    } catch (e) {
      window.alert(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-admin-700 bg-admin-900 shadow-xl p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-white">Verify payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-admin-400 hover:text-white hover:bg-admin-800"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-admin-300 mb-4">
          User <span className="text-white font-medium">{email}</span> submitted the reference below. Choose an outcome.
          A confirmation email will be sent in both cases.
        </p>
        <div className="rounded-xl bg-admin-950 border border-admin-800 p-4 mb-6">
          <p className="text-xs text-admin-500 mb-1">Payment reference</p>
          <p className="font-mono text-sm text-admin-100 break-all">{paymentReference || '—'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => run('rejected')}
            className="flex-1 py-3 rounded-xl border border-red-800/80 text-red-300 font-medium hover:bg-red-950/40 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('approved')}
            className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
