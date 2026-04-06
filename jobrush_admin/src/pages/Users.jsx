import React, { useEffect, useState, useMemo } from 'react'
import { MagnifyingGlassIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { listUsers, deleteUser } from '../services/adminDb'
import { USERDB_FIELDS } from '../config/schema'

export default function Users() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState(null)

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
    if (!q) return rows
    return rows.filter((r) => {
      const email = String(r[USERDB_FIELDS.EMAIL_ID] || '').toLowerCase()
      const id = String(r.id || r[USERDB_FIELDS.UNIQUE_ID] || '').toLowerCase()
      return email.includes(q) || id.includes(q)
    })
  }, [rows, query])

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-admin-400 text-sm mt-1">Firebase path: userdb</p>
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

      <div className="relative max-w-xl mb-6">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-admin-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or ID…"
          className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-admin-900 border border-admin-700 text-white text-sm"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      <div className="rounded-xl border border-admin-700 overflow-hidden bg-admin-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-admin-700 bg-admin-900">
                <th className="py-3 px-4 font-medium text-admin-300">Unique ID</th>
                <th className="py-3 px-4 font-medium text-admin-300">Email</th>
                <th className="py-3 px-4 font-medium text-admin-300">Timestamp</th>
                <th className="py-3 px-4 font-medium text-admin-300 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-admin-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-admin-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const uid = r.id
                  const email = r[USERDB_FIELDS.EMAIL_ID] || '—'
                  const ts = r[USERDB_FIELDS.TIMESTAMP] || '—'
                  return (
                    <tr key={uid} className="hover:bg-admin-800/40">
                      <td className="py-3 px-4 font-mono text-xs text-admin-100 break-all max-w-[200px]">
                        {uid}
                      </td>
                      <td className="py-3 px-4 text-white">{email}</td>
                      <td className="py-3 px-4 text-admin-400 text-xs">{ts}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleDelete(uid)}
                          disabled={deleting === uid}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                          title="Delete user"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
