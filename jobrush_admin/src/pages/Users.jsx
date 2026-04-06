import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline'
import { listUsers, deleteUser, updateUserRecord } from '../services/adminDb'
import { USERDB_FIELDS } from '../config/schema'
import { formatTimestampIST } from '../utils/formatIst'
import { sendPaymentDecisionEmail } from '../services/paymentDecisionMail'
import PaymentReviewModal from '../components/PaymentReviewModal'

const QUOTA_ATS = 5
const QUOTA_MOCK = 5

function deriveStatus(row) {
  if (row[USERDB_FIELDS.SUSPENDED] === true) {
    return { key: 'suspended', label: 'Suspended', tone: 'text-red-300 bg-red-950/40 ring-red-800/50' }
  }
  const a = row[USERDB_FIELDS.ACCESS_STATUS]
  if (a === 'awaiting_activation') {
    return {
      key: 'awaiting_verification',
      label: 'Awaiting verification',
      tone: 'text-amber-200 bg-amber-950/35 ring-amber-800/40',
    }
  }
  if (a === 'pending_payment') {
    return {
      key: 'payment_pending',
      label: 'Payment pending',
      tone: 'text-sky-200 bg-sky-950/30 ring-sky-800/40',
    }
  }
  if (a === 'active') {
    return { key: 'active', label: 'Active', tone: 'text-emerald-200 bg-emerald-950/35 ring-emerald-800/40' }
  }
  return { key: 'active', label: 'Active', tone: 'text-emerald-200 bg-emerald-950/35 ring-emerald-800/40' }
}

export default function Users() {
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [statusFilter, setStatusFilter] = useState(() =>
    searchParams.get('filter') === 'awaitingVerification' ? 'awaiting_verification' : 'all'
  )
  const [paymentModal, setPaymentModal] = useState({ open: false, row: null })

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await listUsers()
      setRows(data)
    } catch (e) {
      setError(e?.message || 'Failed to load users')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows
    if (statusFilter !== 'all') {
      list = list.filter((r) => deriveStatus(r).key === statusFilter)
    }
    if (!q) return list
    return list.filter((r) => {
      const email = String(r[USERDB_FIELDS.EMAIL_ID] || '').toLowerCase()
      const id = String(r.id || r[USERDB_FIELDS.UNIQUE_ID] || '').toLowerCase()
      return email.includes(q) || id.includes(q)
    })
  }, [rows, query, statusFilter])

  const handleDelete = async (uniqueId) => {
    if (!window.confirm(`Delete user ${uniqueId}? This cannot be undone.`)) return
    setDeleting(uniqueId)
    try {
      await deleteUser(uniqueId)
      setRows((prev) => prev.filter((r) => r.id !== uniqueId))
    } catch (e) {
      alert(e?.message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const toggleSuspend = async (row) => {
    const uid = row.id
    const next = !(row[USERDB_FIELDS.SUSPENDED] === true)
    if (!window.confirm(next ? 'Suspend this user? They will be blocked from the app.' : 'Restore this user?')) return
    setBusyId(uid)
    try {
      await updateUserRecord(uid, { [USERDB_FIELDS.SUSPENDED]: next })
      await load()
    } catch (e) {
      alert(e?.message || 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const handlePaymentDecision = async (decision) => {
    const row = paymentModal.row
    if (!row) return
    const uid = row.id
    const email = row[USERDB_FIELDS.EMAIL_ID]
    const ref = row[USERDB_FIELDS.PAYMENT_REFERENCE]
    if (!email) throw new Error('User has no email on file.')

    if (decision === 'approved') {
      await updateUserRecord(uid, {
        [USERDB_FIELDS.ACCESS_STATUS]: 'active',
        [USERDB_FIELDS.SUSPENDED]: false,
      })
    } else {
      await updateUserRecord(uid, {
        [USERDB_FIELDS.ACCESS_STATUS]: 'pending_payment',
        [USERDB_FIELDS.PAYMENT_REFERENCE]: null,
        [USERDB_FIELDS.ACCESS_REQUESTED_AT]: null,
      })
    }

    try {
      await sendPaymentDecisionEmail({
        toEmail: email,
        decision,
        paymentReference: ref,
        userLabel: String(email).split('@')[0],
      })
    } catch (e) {
      await load()
      throw new Error(
        `${decision === 'approved' ? 'Access updated' : 'Record updated'}, but email failed: ${e.message || e}`
      )
    }
    await load()
  }

  const colCount = 6

  return (
    <div className="max-w-[100vw]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">User management</h1>
          <p className="text-admin-400 text-sm mt-1 leading-relaxed">
            Firebase <code className="text-admin-500 text-xs">userdb</code> — status, quotas, and payment verification.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-admin-800 text-admin-100 hover:bg-admin-700 disabled:opacity-50 text-sm font-medium shrink-0"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
        <div className="relative flex-1 max-w-xl">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-admin-500 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or ID…"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-admin-900 border border-admin-700 text-white text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-admin-300 shrink-0">
          <span className="hidden sm:inline">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-admin-900 border border-admin-700 text-white text-sm py-2.5 px-3 min-w-[11rem]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="payment_pending">Payment pending</option>
            <option value="awaiting_verification">Awaiting verification</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="rounded-xl border border-admin-700 overflow-hidden bg-admin-900/50">
        <div className="overflow-x-auto -mx-px">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead>
              <tr className="border-b border-admin-700 bg-admin-900">
                <th className="py-3 px-3 font-medium text-admin-300 whitespace-nowrap">Unique ID</th>
                <th className="py-3 px-3 font-medium text-admin-300 whitespace-nowrap">Email</th>
                <th className="py-3 px-3 font-medium text-admin-300 whitespace-nowrap">Registered (IST)</th>
                <th className="py-3 px-3 font-medium text-admin-300 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 font-medium text-admin-300 whitespace-nowrap">Quota</th>
                <th className="py-3 px-3 font-medium text-admin-300 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-admin-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-10 text-center text-admin-500">
                    No users match
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const uid = r.id
                  const email = r[USERDB_FIELDS.EMAIL_ID] || '—'
                  const ts = formatTimestampIST(r[USERDB_FIELDS.TIMESTAMP])
                  const st = deriveStatus(r)
                  const ats = Math.min(QUOTA_ATS, Number(r[USERDB_FIELDS.ATS_CHECKS_USED]) || 0)
                  const mock = Math.min(QUOTA_MOCK, Number(r[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0)
                  const canReviewPayment = r[USERDB_FIELDS.ACCESS_STATUS] === 'awaiting_activation'
                  const isBusy = busyId === uid

                  return (
                    <tr key={uid} className="hover:bg-admin-800/40 align-top">
                      <td className="py-3 px-3 font-mono text-xs text-admin-100 max-w-[140px]">
                        <span className="break-all line-clamp-2" title={uid}>
                          {uid}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white break-all max-w-[180px]">{email}</td>
                      <td className="py-3 px-3 text-admin-300 text-xs whitespace-nowrap">{ts}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${st.tone}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-admin-200 text-xs leading-relaxed">
                        <div>ATS {ats}/{QUOTA_ATS}</div>
                        <div>Mock {mock}/{QUOTA_MOCK}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 items-stretch sm:items-center">
                          {canReviewPayment && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setPaymentModal({ open: true, row: r })}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-900/50 text-emerald-200 text-xs font-medium ring-1 ring-emerald-800/60 hover:bg-emerald-900/70 disabled:opacity-50 whitespace-nowrap"
                            >
                              <CheckBadgeIcon className="w-4 h-4 shrink-0" />
                              Approve payment
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(uid)}
                            disabled={deleting === uid || isBusy}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                            title="Delete user"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleSuspend(r)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-admin-800 text-admin-200 text-xs font-medium hover:bg-admin-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <NoSymbolIcon className="w-4 h-4 shrink-0" />
                            {r[USERDB_FIELDS.SUSPENDED] === true ? 'Restore' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentReviewModal
        open={paymentModal.open}
        row={paymentModal.row}
        email={paymentModal.row?.[USERDB_FIELDS.EMAIL_ID]}
        paymentReference={paymentModal.row?.[USERDB_FIELDS.PAYMENT_REFERENCE]}
        onClose={() => setPaymentModal({ open: false, row: null })}
        onDecision={handlePaymentDecision}
      />
    </div>
  )
}
