import React, { useMemo, useState } from 'react'
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { formatTimestampIST } from '../utils/formatIst'
import { INTERVIEW_REPORTS_FIELDS, ATS_REPORT_FIELDS } from '../config/schema'

function sortByDateDesc(rows, field) {
  return [...rows].sort((a, b) =>
    String(b[field] || '').localeCompare(String(a[field] || ''))
  )
}

export default function UserReportsModal({
  open,
  onClose,
  userId,
  email,
  mockReports,
  atsReports,
}) {
  const [openMock, setOpenMock] = useState({})
  const [openAts, setOpenAts] = useState({})

  const mockSorted = useMemo(
    () => sortByDateDesc(mockReports || [], INTERVIEW_REPORTS_FIELDS.GENERATED_AT),
    [mockReports]
  )
  const atsSorted = useMemo(
    () => sortByDateDesc(atsReports || [], ATS_REPORT_FIELDS.GENERATED_AT),
    [atsReports]
  )

  if (!open) return null

  const preview = (obj) => {
    try {
      const s = JSON.stringify(obj, null, 2)
      return s.length > 8000 ? `${s.slice(0, 8000)}\n…` : s
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-admin-700 bg-admin-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-admin-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Saved reports</h2>
            <p className="text-xs text-admin-400 font-mono break-all mt-1">{userId}</p>
            <p className="text-sm text-admin-300 mt-0.5 break-all">{email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-admin-400 hover:text-white hover:bg-admin-800 shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          <section>
            <h3 className="text-sm font-semibold text-admin-200 mb-3">Mock interview reports</h3>
            {mockSorted.length === 0 ? (
              <p className="text-sm text-admin-500">None saved yet.</p>
            ) : (
              <ul className="space-y-2">
                {mockSorted.map((r) => {
                  const isO = openMock[r.id]
                  const gen = r[INTERVIEW_REPORTS_FIELDS.GENERATED_AT]
                  return (
                    <li key={r.id} className="rounded-xl border border-admin-800 bg-admin-950/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenMock((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        className="flex items-center gap-2 w-full px-4 py-3 text-left text-sm text-admin-200 hover:bg-admin-800/50"
                      >
                        {isO ? <ChevronUpIcon className="w-4 h-4 shrink-0" /> : <ChevronDownIcon className="w-4 h-4 shrink-0" />}
                        <span className="font-mono text-xs text-admin-500 shrink-0">{r.id.slice(0, 8)}…</span>
                        <span className="text-admin-400">{formatTimestampIST(gen)}</span>
                      </button>
                      {isO && (
                        <pre className="text-xs text-admin-200 bg-admin-950 p-3 overflow-x-auto max-h-56 overflow-y-auto border-t border-admin-800">
                          {preview(r[INTERVIEW_REPORTS_FIELDS.REPORT])}
                        </pre>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-admin-200 mb-3">ATS compatibility reports</h3>
            {atsSorted.length === 0 ? (
              <p className="text-sm text-admin-500">None saved yet.</p>
            ) : (
              <ul className="space-y-2">
                {atsSorted.map((r) => {
                  const isO = openAts[r.id]
                  const gen = r[ATS_REPORT_FIELDS.GENERATED_AT]
                  return (
                    <li key={r.id} className="rounded-xl border border-admin-800 bg-admin-950/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenAts((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        className="flex items-center gap-2 w-full px-4 py-3 text-left text-sm text-admin-200 hover:bg-admin-800/50"
                      >
                        {isO ? <ChevronUpIcon className="w-4 h-4 shrink-0" /> : <ChevronDownIcon className="w-4 h-4 shrink-0" />}
                        <span className="font-mono text-xs text-admin-500 shrink-0">{r.id.slice(0, 8)}…</span>
                        <span className="text-admin-400">{formatTimestampIST(gen)}</span>
                      </button>
                      {isO && (
                        <pre className="text-xs text-admin-200 bg-admin-950 p-3 overflow-x-auto max-h-56 overflow-y-auto border-t border-admin-800">
                          {preview(r[ATS_REPORT_FIELDS.REPORT])}
                        </pre>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
