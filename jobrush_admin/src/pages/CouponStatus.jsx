import React, { useCallback, useEffect, useState } from 'react'
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  listCouponStatuses,
  resetCouponRedemptionStats,
  deleteCouponAndRedemptions,
} from '../services/adminDb'

export default function CouponStatus() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busyCode, setBusyCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listCouponStatuses()
      setRows(data)
    } catch (e) {
      setError(e?.message || 'Could not load coupon status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onReset = async (code) => {
    const ok = window.confirm(
      `Reset verified usage, collected amounts, and contract payout totals for ${code}?\n\n` +
        'The coupon contract stays active. Users previously counted as verified can be counted again if they are approved with this coupon.'
    )
    if (!ok) return
    setBusyCode(code)
    setMessage({ type: '', text: '' })
    try {
      await resetCouponRedemptionStats(code)
      setMessage({ type: 'ok', text: `Reset redemption stats for ${code}.` })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not reset coupon stats.' })
    } finally {
      setBusyCode('')
    }
  }

  const onDelete = async (code) => {
    const ok = window.confirm(
      `Delete coupon ${code} and all redemption history?\n\n` +
        'This removes the contract from Coupon management and cannot be undone.'
    )
    if (!ok) return
    setBusyCode(code)
    setMessage({ type: '', text: '' })
    try {
      await deleteCouponAndRedemptions(code)
      setMessage({ type: 'ok', text: `Deleted ${code}.` })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not delete coupon.' })
    } finally {
      setBusyCode('')
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Coupon status</h1>
        <p className="text-admin-300 text-sm">
          Verified coupon usage, collections, and contract payout summary.
        </p>
      </div>

      {message.text && (
        <p
          className={`text-sm rounded-xl px-4 py-3 border ${
            message.type === 'ok'
              ? 'text-emerald-200 border-emerald-800/80 bg-emerald-950/40'
              : 'text-red-300 border-red-900/60 bg-red-950/30'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-admin-400 text-sm">No coupon data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b border-admin-700 text-admin-300">
                  <th className="text-left py-2 pr-4">Coupon code</th>
                  <th className="text-left py-2 pr-4">Contract name</th>
                  <th className="text-left py-2 pr-4">Number of times used (verified)</th>
                  <th className="text-left py-2 pr-4">Total amount collected</th>
                  <th className="text-left py-2 pr-4">Contract payment (total payout)</th>
                  <th className="text-left py-2 pr-2 w-[1%] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-800 text-admin-100">
                {rows.map((r) => (
                  <tr key={r.couponCode}>
                    <td className="py-2 pr-4">{r.couponCode}</td>
                    <td className="py-2 pr-4">{r.contractName || '—'}</td>
                    <td className="py-2 pr-4">{Number(r.timesUsedVerified || 0)}</td>
                    <td className="py-2 pr-4">
                      Rs {Number(r.totalAmountCollected || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-4">
                      Rs {Number(r.totalContractPayout || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          type="button"
                          title="Reset verified usage and totals"
                          disabled={busyCode === r.couponCode}
                          onClick={() => onReset(r.couponCode)}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-admin-600 text-admin-200 hover:bg-admin-800 disabled:opacity-40"
                        >
                          <ArrowPathIcon
                            className={`w-4 h-4 ${busyCode === r.couponCode ? 'animate-spin' : ''}`}
                          />
                          <span className="sr-only">Reset stats</span>
                        </button>
                        <button
                          type="button"
                          title="Delete coupon and redemption data"
                          disabled={busyCode === r.couponCode}
                          onClick={() => onDelete(r.couponCode)}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-red-900/60 text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span className="sr-only">Delete coupon</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
