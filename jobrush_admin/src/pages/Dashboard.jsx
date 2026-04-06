import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  SignalIcon,
  ServerStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  subscribeUserDashboardMetrics,
  subscribeInterviewReportCount,
  ONLINE_PRESENCE_WINDOW_MS,
} from '../services/adminDb'
import { fetchJobRushApiHealth } from '../services/apiHealth'

const onlineMinutes = Math.round(ONLINE_PRESENCE_WINDOW_MS / 60_000)

function StatCard({ to, icon: Icon, title, value, hint, loading }) {
  const inner = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-admin-400 text-sm font-medium leading-snug">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold text-white mt-2 tabular-nums tracking-tight">
          {loading ? '—' : value}
        </p>
        {hint && <p className="text-admin-500 text-xs mt-2 leading-relaxed">{hint}</p>}
      </div>
      <div className="p-3 rounded-xl bg-admin-800/90 ring-1 ring-admin-700/50 shrink-0">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-admin-400" />
      </div>
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-2xl border border-admin-700/80 bg-admin-900/70 p-5 sm:p-6 hover:border-admin-500 hover:bg-admin-900/90 transition shadow-sm"
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className="rounded-2xl border border-admin-700/80 bg-admin-900/70 p-5 sm:p-6 shadow-sm">{inner}</div>
  )
}

function statusLabel(reachable, ok) {
  if (!reachable) return 'Unavailable'
  return ok ? 'Operational' : 'Degraded'
}

export default function Dashboard() {
  const [userMetrics, setUserMetrics] = useState({
    registered: null,
    paymentPendingReview: null,
    onlineNow: null,
  })
  const [reportCount, setReportCount] = useState(null)
  const [loadingFirebase, setLoadingFirebase] = useState(true)
  const [apiHealth, setApiHealth] = useState(null)
  const [apiChecking, setApiChecking] = useState(false)

  const refreshApiHealth = useCallback(async () => {
    setApiChecking(true)
    try {
      const result = await fetchJobRushApiHealth()
      setApiHealth(result)
    } catch (e) {
      setApiHealth({ reachable: false, ok: false, status: 0, ms: 0, error: e?.message })
    } finally {
      setApiChecking(false)
    }
  }, [])

  useEffect(() => {
    setLoadingFirebase(true)
    const unsubUsers = subscribeUserDashboardMetrics((m) => {
      setUserMetrics(m)
      setLoadingFirebase(false)
    })
    const unsubReports = subscribeInterviewReportCount((n) => {
      setReportCount(n)
      setLoadingFirebase(false)
    })
    return () => {
      unsubUsers()
      unsubReports()
    }
  }, [])

  useEffect(() => {
    refreshApiHealth()
    const id = window.setInterval(refreshApiHealth, 120_000)
    return () => window.clearInterval(id)
  }, [refreshApiHealth])

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-admin-400 text-sm sm:text-base leading-relaxed max-w-3xl">
          Live overview from Firebase Realtime Database and your JobRush API. Counts update automatically when data
          changes.
        </p>
      </div>

      <section aria-label="Key metrics">
        <h2 className="sr-only">Key metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <StatCard
            to="/users"
            icon={UsersIcon}
            title="Registered users"
            value={userMetrics.registered}
            hint="Total records in userdb"
            loading={loadingFirebase && userMetrics.registered == null}
          />
          <StatCard
            to="/users?filter=awaitingVerification"
            icon={ClipboardDocumentCheckIcon}
            title="Payments pending verification"
            value={userMetrics.paymentPendingReview}
            hint="Users who submitted a payment reference and are awaiting review"
            loading={loadingFirebase && userMetrics.paymentPendingReview == null}
          />
          <StatCard
            to="/reports"
            icon={DocumentTextIcon}
            title="Interview reports"
            value={reportCount}
            hint="Saved mock interview reports"
            loading={loadingFirebase && reportCount == null}
          />
          <StatCard
            icon={SignalIcon}
            title="Users online now"
            value={userMetrics.onlineNow}
            hint={`Approximate count: last activity within ${onlineMinutes} minutes (requires app heartbeat)`}
            loading={loadingFirebase && userMetrics.onlineNow == null}
          />
        </div>
      </section>

      <section
        aria-label="API status"
        className="rounded-2xl border border-admin-700/80 bg-admin-900/50 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 sm:px-6 border-b border-admin-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-admin-800 shrink-0">
              <ServerStackIcon className="w-6 h-6 text-admin-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-sm sm:text-base">Service health</h2>
              <p className="text-xs text-admin-500 truncate">
                JobRush API — set <code className="text-admin-400">VITE_JOBRUSH_API_BASE</code> if not using production
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshApiHealth}
            disabled={apiChecking}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-admin-600 text-admin-200 text-sm font-medium hover:bg-admin-800 disabled:opacity-50 w-full sm:w-auto shrink-0"
          >
            <ArrowPathIcon className={`w-4 h-4 ${apiChecking ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        </div>
        <div className="p-5 sm:p-6">
          {!apiHealth ? (
            <p className="text-admin-500 text-sm">Checking services…</p>
          ) : (
            <ul className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-admin-800/80">
              <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 sm:py-3 first:sm:pt-0">
                <span className="text-admin-300 text-sm font-medium">JobRush API</span>
                <span className="flex items-center gap-2 text-sm">
                  {apiHealth.reachable && apiHealth.ok ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <span className={apiHealth.reachable && apiHealth.ok ? 'text-emerald-300' : 'text-red-300'}>
                    {statusLabel(apiHealth.reachable, apiHealth.ok)}
                  </span>
                  {apiHealth.reachable && (
                    <span className="text-admin-500 tabular-nums">· {apiHealth.ms} ms</span>
                  )}
                  {!apiHealth.reachable && apiHealth.error && (
                    <span className="text-admin-500 text-xs">({apiHealth.error})</span>
                  )}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 sm:py-3">
                <span className="text-admin-300 text-sm font-medium">AI (Groq)</span>
                <span className="text-sm text-admin-200">
                  {!apiHealth.reachable
                    ? '—'
                    : apiHealth.llm
                      ? 'Ready'
                      : 'Not configured'}
                </span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 sm:py-3 last:sm:pb-0">
                <span className="text-admin-300 text-sm font-medium">Text-to-speech</span>
                <span className="text-sm text-admin-200">
                  {!apiHealth.reachable
                    ? '—'
                    : apiHealth.tts
                      ? 'Ready'
                      : 'Not configured'}
                </span>
              </li>
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-admin-800 bg-admin-900/40 px-5 py-5 sm:px-6">
        <h2 className="text-sm font-semibold text-white mb-3">Quick links</h2>
        <ul className="text-sm text-admin-300 space-y-2">
          <li className="break-all">
            <span className="text-admin-500">Main app · </span>
            <a
              href="https://jbrush.netlify.app"
              className="text-admin-400 hover:text-white underline"
              target="_blank"
              rel="noreferrer"
            >
              jbrush.netlify.app
            </a>
          </li>
          <li className="break-all">
            <span className="text-admin-500">API health (direct) · </span>
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
      </section>
    </div>
  )
}
