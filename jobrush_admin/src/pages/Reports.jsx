import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon, TrashIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline'
import {
  listUsers,
  listInterviewReports,
  listAtsReports,
  deleteAllReportsForUser,
} from '../services/adminDb'
import { USERDB_FIELDS, INTERVIEW_REPORTS_FIELDS, ATS_REPORT_FIELDS } from '../config/schema'
import UserReportsModal from '../components/UserReportsModal'

const SLOT_MAX = 5

function buildUserReportRows(users, interviews, atsList) {
  const map = new Map()

  const ensure = (uid) => {
    if (!map.has(uid)) {
      map.set(uid, { userId: uid, email: '—', mock: [], ats: [] })
    }
    return map.get(uid)
  }

  for (const u of users) {
    const row = ensure(u.id)
    row.email = u[USERDB_FIELDS.EMAIL_ID] || '—'
  }

  for (const r of interviews) {
    const uid = r[INTERVIEW_REPORTS_FIELDS.USER_ID] || 'anonymous'
    ensure(uid).mock.push(r)
  }
  for (const r of atsList) {
    const uid = r[ATS_REPORT_FIELDS.USER_ID] || 'anonymous'
    ensure(uid).ats.push(r)
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.email).localeCompare(String(b.email))
  )
}

export default function Reports() {
  const [userRows, setUserRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [busyUserId, setBusyUserId] = useState(null)
  const [modal, setModal] = useState({ open: false, row: null })

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [users, interviews, atsList] = await Promise.all([
        listUsers(),
        listInterviewReports(),
        listAtsReports(),
      ])
      setUserRows(buildUserReportRows(users, interviews, atsList))
    } catch (e) {
      setError(e?.message || 'Failed to load data')
      setUserRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return userRows
    return userRows.filter((r) => {
      const id = String(r.userId).toLowerCase()
      const em = String(r.email).toLowerCase()
      return id.includes(q) || em.includes(q)
    })
  }, [userRows, query])

  const openView = (row) => setModal({ open: true, row })

  const deleteAll = async (row) => {
    if (
      !window.confirm(
        `Delete all ATS and mock interview reports for this user? Usage counters will be reset to 0/${SLOT_MAX}. This cannot be undone.`
      )
    ) {
      return
    }
    setBusyUserId(row.userId)
    try {
      await deleteAllReportsForUser(row.userId)
      await load()
    } catch (e) {
      alert(e?.message || 'Delete failed')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="max-w-[100vw]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Report management</h1>
          <p className="text-admin-400 text-sm mt-1 leading-relaxed">
            Per-user view of saved reports in{' '}
            <code className="text-admin-500 text-xs">atsReports</code> and{' '}
            <code className="text-admin-500 text-xs">interviewReports</code> (up to {SLOT_MAX} of each per plan).
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

      <div className="relative max-w-xl mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by user ID or email…"
          className="w-full px-4 py-2.5 rounded-xl bg-admin-900 border border-admin-700 text-white text-sm"
        />
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="rounded-xl border border-admin-700 overflow-hidden bg-admin-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-admin-700 bg-admin-900">
                <th className="py-3 px-3 font-medium text-admin-300">Unique ID</th>
                <th className="py-3 px-3 font-medium text-admin-300">Email</th>
                <th className="py-3 px-3 font-medium text-admin-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-admin-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-admin-500">
                    No rows match
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const nAts = Math.min(SLOT_MAX, row.ats.length)
                  const nMock = Math.min(SLOT_MAX, row.mock.length)
                  const busy = busyUserId === row.userId
                  return (
                    <tr key={row.userId} className="hover:bg-admin-800/40 align-top">
                      <td className="py-3 px-3 font-mono text-xs text-admin-100 max-w-[160px]">
                        <span className="break-all line-clamp-2" title={row.userId}>
                          {row.userId}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white break-all max-w-[200px]">{row.email}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 items-stretch sm:items-center">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openView(row)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-admin-800 text-admin-100 text-xs font-medium hover:bg-admin-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <DocumentMagnifyingGlassIcon className="w-4 h-4 shrink-0" />
                            View reports · ATS {nAts}/{SLOT_MAX} · Mock {nMock}/{SLOT_MAX}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => deleteAll(row)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-red-400 text-xs font-medium hover:bg-red-950/40 disabled:opacity-50 whitespace-nowrap"
                          >
                            <TrashIcon className="w-4 h-4 shrink-0" />
                            Delete all reports
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

      <UserReportsModal
        open={modal.open}
        onClose={() => setModal({ open: false, row: null })}
        userId={modal.row?.userId}
        email={modal.row?.email}
        mockReports={modal.row?.mock}
        atsReports={modal.row?.ats}
      />
    </div>
  )
}
