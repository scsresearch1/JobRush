import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UsersIcon, DocumentTextIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { listUsers, listInterviewReports } from '../services/adminDb'

export default function Dashboard() {
  const [userCount, setUserCount] = useState(null)
  const [reportCount, setReportCount] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      setLoading(true)
      try {
        const [users, reports] = await Promise.all([listUsers(), listInterviewReports()])
        if (!cancelled) {
          setUserCount(users.length)
          setReportCount(reports.length)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not load Firebase data. Check rules and env config.')
          setUserCount(0)
          setReportCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const Card = ({ to, icon: Icon, title, value, sub }) => (
    <Link
      to={to}
      className="block bg-admin-900/80 border border-admin-700 rounded-2xl p-6 hover:border-admin-500 transition group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-admin-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-2 tabular-nums">
            {loading ? '…' : value}
          </p>
          {sub && <p className="text-admin-500 text-xs mt-2">{sub}</p>}
        </div>
        <div className="p-3 rounded-xl bg-admin-800 group-hover:bg-admin-700 transition">
          <Icon className="w-8 h-8 text-admin-400" />
        </div>
      </div>
    </Link>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-admin-400 mb-8">Overview of JobRush Firebase Realtime Database</p>

      {error && (
        <div className="mb-6 flex gap-3 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-sm">
          <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl">
        <Card
          to="/users"
          icon={UsersIcon}
          title="Registered users"
          value={userCount}
          sub="userdb collection"
        />
        <Card
          to="/reports"
          icon={DocumentTextIcon}
          title="Interview reports"
          value={reportCount}
          sub="interviewReports collection"
        />
      </div>

      <div className="mt-10 max-w-2xl rounded-xl border border-admin-800 bg-admin-900/50 p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Quick links</h2>
        <ul className="text-sm text-admin-300 space-y-2">
          <li>
            • Main app:{' '}
            <a href="https://jbrush.netlify.app" className="text-admin-400 hover:text-white underline" target="_blank" rel="noreferrer">
              jbrush.netlify.app
            </a>
          </li>
          <li>
            • API health:{' '}
            <a
              href="https://jobrush.onrender.com/api/health"
              className="text-admin-400 hover:text-white underline"
              target="_blank"
              rel="noreferrer"
            >
              jobrush.onrender.com/api/health
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
