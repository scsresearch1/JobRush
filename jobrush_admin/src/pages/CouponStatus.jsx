import React, { useEffect, useState } from 'react'
import { listCouponStatuses } from '../services/adminDb'

export default function CouponStatus() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await listCouponStatuses()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load coupon status.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Coupon status</h1>
        <p className="text-admin-300 text-sm">
          Verified coupon usage, collections, and contract payout summary.
        </p>
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-admin-400 text-sm">No coupon data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-admin-700 text-admin-300">
                  <th className="text-left py-2 pr-4">Coupon code</th>
                  <th className="text-left py-2 pr-4">Contract name</th>
                  <th className="text-left py-2 pr-4">Number of times used (verified)</th>
                  <th className="text-left py-2 pr-4">Total amount collected</th>
                  <th className="text-left py-2 pr-4">Contract payment (total payout)</th>
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
