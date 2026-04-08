import React, { useEffect, useState } from 'react'
import { PlusCircleIcon } from '@heroicons/react/24/outline'
import { createCoupon, listCoupons, setCouponActiveState } from '../services/adminDb'

const PLAN_AMOUNT_INR = 250

export default function CouponManagement() {
  const [form, setForm] = useState({
    couponCode: '',
    contractName: '',
    discountAmount: '',
    contractPaymentPerUser: '',
    validityDays: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [busyCode, setBusyCode] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await listCoupons()
      setRows(data)
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not load coupons.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const code = String(form.couponCode || '').trim().toUpperCase()
    const contract = String(form.contractName || '').trim()
    const discount = Number(form.discountAmount)
    const payout = Number(form.contractPaymentPerUser)
    const days = Number(form.validityDays)
    if (!code) {
      setMessage({ type: 'error', text: 'Coupon name is required.' })
      return
    }
    if (!contract) {
      setMessage({ type: 'error', text: 'Contract name is required.' })
      return
    }
    if (!Number.isFinite(discount) || discount < 0) {
      setMessage({ type: 'error', text: 'Discount amount must be 0 or more.' })
      return
    }
    if (discount > PLAN_AMOUNT_INR) {
      setMessage({ type: 'error', text: `Discount cannot exceed ₹${PLAN_AMOUNT_INR}.` })
      return
    }
    if (!Number.isFinite(payout) || payout < 0) {
      setMessage({ type: 'error', text: 'Contract payment per user must be 0 or more.' })
      return
    }
    if (!Number.isFinite(days) || days < 1 || Math.floor(days) !== days) {
      setMessage({ type: 'error', text: 'Validity must be a whole number of days (minimum 1).' })
      return
    }
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await createCoupon({
        couponCode: form.couponCode,
        contractName: form.contractName,
        discountAmount: form.discountAmount,
        contractPaymentPerUser: form.contractPaymentPerUser,
        validityDays: form.validityDays,
      })
      setMessage({ type: 'ok', text: 'Coupon created successfully.' })
      setForm({
        couponCode: '',
        contractName: '',
        discountAmount: '',
        contractPaymentPerUser: '',
        validityDays: '',
      })
      await load()
    } catch (e2) {
      setMessage({ type: 'error', text: e2?.message || 'Could not create coupon.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (code, nextState) => {
    setBusyCode(code)
    setMessage({ type: '', text: '' })
    try {
      await setCouponActiveState(code, nextState)
      setMessage({
        type: 'ok',
        text: nextState ? `Coupon ${code} activated.` : `Coupon ${code} deactivated.`,
      })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Could not update coupon status.' })
    } finally {
      setBusyCode('')
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Coupon management</h1>
        <p className="text-admin-300 text-sm">
          Create and maintain coupon contracts for partner campaigns.
        </p>
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircleIcon className="w-5 h-5 text-admin-300" />
          <h2 className="font-semibold text-white">Add new coupon</h2>
        </div>
        <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4">
          <label className="text-sm text-admin-200">
            Coupon name
            <input
              value={form.couponCode}
              onChange={(e) => onChange('couponCode', e.target.value)}
              placeholder="e.g. CAMPUS25"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white"
            />
          </label>
          <label className="text-sm text-admin-200">
            Contract
            <input
              value={form.contractName}
              onChange={(e) => onChange('contractName', e.target.value)}
              placeholder="e.g. Tech Campus Drive"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white"
            />
          </label>
          <label className="text-sm text-admin-200">
            Amount of discount (INR)
            <input
              type="number"
              min="0"
              value={form.discountAmount}
              onChange={(e) => onChange('discountAmount', e.target.value)}
              placeholder="e.g. 100"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white"
            />
          </label>
          <label className="text-sm text-admin-200">
            Contract payment per user (INR)
            <input
              type="number"
              min="0"
              value={form.contractPaymentPerUser}
              onChange={(e) => onChange('contractPaymentPerUser', e.target.value)}
              placeholder="e.g. 50"
              className="mt-1 w-full px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white"
            />
          </label>
          <label className="text-sm text-admin-200 md:col-span-2">
            Validity (days)
            <input
              type="number"
              min="1"
              value={form.validityDays}
              onChange={(e) => onChange('validityDays', e.target.value)}
              placeholder="e.g. 30"
              className="mt-1 w-full md:max-w-xs px-4 py-2.5 rounded-xl bg-admin-950 border border-admin-600 text-white"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-admin-600 text-white text-sm font-medium hover:bg-admin-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create coupon'}
            </button>
          </div>
        </form>
        {message.text && (
          <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="bg-admin-900/80 border border-admin-800 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Active coupon contracts</h2>
        {loading ? (
          <p className="text-admin-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-admin-400 text-sm">No coupons created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-admin-700 text-admin-300">
                  <th className="text-left py-2 pr-4">Coupon code</th>
                  <th className="text-left py-2 pr-4">Contract</th>
                  <th className="text-left py-2 pr-4">Discount</th>
                  <th className="text-left py-2 pr-4">Contract payment/user</th>
                  <th className="text-left py-2 pr-4">Validity</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-right py-2 pr-0">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-800 text-admin-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">{r.couponCode || r.id}</td>
                    <td className="py-2 pr-4">{r.contractName || '—'}</td>
                    <td className="py-2 pr-4">Rs {Number(r.discountAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4">Rs {Number(r.contractPaymentPerUser || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4">{Number(r.validityDays || 0)} days</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${
                          r.isActive === false
                            ? 'text-red-300 bg-red-950/40 ring-red-800/50'
                            : 'text-emerald-200 bg-emerald-950/35 ring-emerald-800/40'
                        }`}
                      >
                        {r.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <button
                        type="button"
                        disabled={busyCode === r.couponCode}
                        onClick={() => toggleActive(r.couponCode, r.isActive === false)}
                        className="px-3 py-1.5 rounded-lg border border-admin-600 text-xs font-medium text-admin-100 hover:bg-admin-800 disabled:opacity-50"
                      >
                        {r.isActive === false ? 'Activate' : 'Deactivate'}
                      </button>
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
