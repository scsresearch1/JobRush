import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { listInterviewReports, deleteInterviewReport } from '../services/adminDb'
import { INTERVIEW_REPORTS_FIELDS } from '../config/schema'

export default function Reports() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState({})

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await listInterviewReports()
      setRows(data.sort((a, b) => String(b[INTERVIEW_REPORTS_FIELDS.GENERATED_AT] || '').localeCompare(String(a[INTERVIEW_REPORTS_FIELDS.GENERATED_AT] || ''))))
    } catch (e) {
      setError(e?.message || 'Failed to load reports')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete report ${id}?`)) return
    setDeleting(id)
    try {
      await deleteInterviewReport(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      alert(e?.message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const previewJson = (obj) => {
    if (obj == null) return '—'
    try {
      const s = JSON.stringify(obj, null, 0)
      return s.length > 120 ? `${s.slice(0, 120)}…` : s
    } catch {
      return String(obj)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Interview reports</h1>
          <p className="text-admin-400 text-sm mt-1">Firebase path: interviewReports</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-admin-800 text-admin-100 hover:bg-admin-700 disabled:opacity-50 text-sm font-medium"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {loading ? (
          <p className="text-admin-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-admin-500">No reports yet</p>
        ) : (
          rows.map((r) => {
            const isOpen = expanded[r.id]
            const userId = r[INTERVIEW_REPORTS_FIELDS.USER_ID] || '—'
            const genAt = r[INTERVIEW_REPORTS_FIELDS.GENERATED_AT] || '—'
            const recCount = Array.isArray(r[INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS])
              ? r[INTERVIEW_REPORTS_FIELDS.RECOMMENDATIONS].length
              : 0
            return (
              <div
                key={r.id}
                className="rounded-xl border border-admin-700 bg-admin-900/50 overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    className="p-1 rounded text-admin-400 hover:text-white"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-admin-500 break-all">{r.id}</p>
                    <p className="text-sm text-white mt-1">
                      User: <span className="text-admin-300">{userId}</span>
                      {' · '}
                      <span className="text-admin-400">{genAt}</span>
                      {' · '}
                      <span className="text-admin-500">{recCount} recommendations</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-admin-800 pt-4">
                    <p className="text-xs font-semibold text-admin-400 mb-2">Report (preview)</p>
                    <pre className="text-xs text-admin-200 bg-admin-950 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                      {previewJson(r[INTERVIEW_REPORTS_FIELDS.REPORT])}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
