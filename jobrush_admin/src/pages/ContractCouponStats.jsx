import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { listCouponStatuses } from '../services/adminDb'
import { useAuth } from '../context/AuthContext'

export default function ContractCouponStats() {
  const { contractSession } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const allowed = useMemo(
    () => new Set((contractSession?.assignedCouponCodes || []).map((c) => String(c || '').trim().toUpperCase())),
    [contractSession?.assignedCouponCodes]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listCouponStatuses()
      const filtered = data.filter((r) => allowed.has(String(r.couponCode || '').toUpperCase()))
      setRows(filtered)
    } catch (e) {
      setError(e?.message || 'Could not load coupon statistics.')
    } finally {
      setLoading(false)
    }
  }, [allowed])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Your coupon statistics</h1>
          <p className="text-admin-300 text-sm leading-relaxed max-w-2xl">
            Verified usage and amounts for the coupon codes assigned to your account. Only these codes are shown.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-admin-600 text-admin-200 text-sm font-medium hover:bg-admin-800 disabled:opacity-50 shrink-0"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-admin-400 text-sm">
            No statistics yet for your assigned coupons, or codes are not yet in use.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-admin-700 text-admin-300">
                  <th className="text-left py-2 pr-4">Coupon code</th>
                  <th className="text-left py-2 pr-4">Contract name</th>
                  <th className="text-left py-2 pr-4">Verified uses</th>
                  <th className="text-left py-2 pr-4">Total collected</th>
                  <th className="text-left py-2 pr-4">Contract payout (total)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-800 text-admin-100">
                {rows.map((r) => (
                  <tr key={r.couponCode}>
                    <td className="py-2 pr-4 font-medium text-white">{r.couponCode}</td>
                    <td className="py-2 pr-4">{r.contractName || '—'}</td>
                    <td className="py-2 pr-4 tabular-nums">{Number(r.timesUsedVerified || 0)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      Rs {Number(r.totalAmountCollected || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      Rs {Number(r.totalContractPayout || 0).toLocaleString('en-IN')}
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
