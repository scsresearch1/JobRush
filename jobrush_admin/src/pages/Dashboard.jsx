import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  SignalIcon,
  ServerStackIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  subscribeUserDashboardMetrics,
  subscribeInterviewReportCount,
  ONLINE_PRESENCE_WINDOW_MS,
  listCouponStatuses,
} from '../services/adminDb'
import { fetchJobRushApiHealth } from '../services/apiHealth'

const onlineMinutes = Math.round(ONLINE_PRESENCE_WINDOW_MS / 60_000)
const moneyFormat = new Intl.NumberFormat('en-IN')

function formatInr(amount) {
  const n = Number(amount) || 0
  return `Rs ${moneyFormat.format(Math.round(n))}`
}

function formatProcessUptime(seconds) {
  const t = Number(seconds) || 0
  const s = Math.floor(t % 60)
  const m = Math.floor((t / 60) % 60)
  const h = Math.floor((t / 3600) % 24)
  const d = Math.floor(t / 86400)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function groqQuotaCells(g) {
  if (!g || g.reason === 'no_key') {
    return { quota: '—', remaining: '—', reset: '—' }
  }
  if (!g.ok) {
    return {
      quota: 'Probe failed',
      remaining: String(g.error || g.reason || '—'),
      reset: '—',
    }
  }
  const quota = []
  if (g.limitRequests != null) quota.push(`${g.limitRequests} req/day (max)`)
  if (g.limitTokens != null) quota.push(`${g.limitTokens} tok/min (max)`)
  const rem = []
  if (g.remainingRequests != null) rem.push(`${g.remainingRequests} req left (day)`)
  if (g.remainingTokens != null) rem.push(`${g.remainingTokens} tok left (min)`)
  const reset = []
  if (g.resetRequests) reset.push(`Day: ${g.resetRequests}`)
  if (g.resetTokens) reset.push(`Min: ${g.resetTokens}`)
  if (g.httpStatus != null && g.httpStatus !== 200) reset.push(`HTTP ${g.httpStatus}`)
  return {
    quota: quota.join(' · ') || '—',
    remaining: rem.join(' · ') || '—',
    reset: reset.join(' · ') || '—',
  }
}

function resendQuotaCells(r) {
  if (!r || r.reason === 'no_key') {
    return { quota: '—', remaining: '—', reset: '—' }
  }
  if (!r.ok) {
    return {
      quota: 'Probe failed',
      remaining: String(r.error || r.reason || '—'),
      reset: '—',
    }
  }
  const quota = []
  if (r.ratelimitLimit != null) quota.push(`${r.ratelimitLimit} API req/window (max)`)
  const rem = []
  if (r.ratelimitRemaining != null) rem.push(`${r.ratelimitRemaining} API req left`)
  if (r.dailyQuotaUsed != null) rem.push(`Daily send used: ${r.dailyQuotaUsed}`)
  if (r.monthlyQuotaUsed != null) rem.push(`Monthly send used: ${r.monthlyQuotaUsed}`)
  const reset = []
  if (r.ratelimitReset != null) reset.push(`API resets in ${r.ratelimitReset}s`)
  return {
    quota: quota.join(' · ') || '—',
    remaining: rem.join(' · ') || '—',
    reset: reset.join(' · ') || '—',
  }
}

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

/** @typedef {'ok' | 'warn' | 'bad' | 'muted'} StatusTone */

/**
 * @param {object | null} apiHealth
 * @param {{ firebaseOk: boolean, firebaseChecking: boolean }} fb
 * @param {{ registered: number | null, reportCount: number | null }} counts
 */
function buildServiceHealthRows(apiHealth, { firebaseOk, firebaseChecking }, counts) {
  const unreachable = !apiHealth?.reachable
  const jrOk = apiHealth?.reachable && apiHealth?.ok
  const proc = apiHealth?.process
  const gq = groqQuotaCells(apiHealth?.groqUsage)
  const rs = resendQuotaCells(apiHealth?.resendUsage)

  return [
    {
      key: 'jobrush',
      name: 'JobRush API (Node)',
      status: jrOk
        ? `Operational · ${apiHealth.ms} ms`
        : unreachable
          ? `Unreachable${apiHealth.error ? ` (${apiHealth.error})` : ''}`
          : 'Degraded',
      tone: /** @type {StatusTone} */ (jrOk ? 'ok' : 'bad'),
      quota:
        jrOk && proc
          ? `RSS ${proc.rssMb} MB · heap ${proc.heapUsedMb} MB`
          : '—',
      remaining: jrOk && proc ? `Uptime ${formatProcessUptime(proc.uptimeSeconds)}` : '—',
      reset: jrOk && proc?.node ? proc.node : '—',
    },
    {
      key: 'firebase',
      name: 'Firebase Realtime Database',
      status: firebaseChecking ? 'Checking…' : firebaseOk ? 'Connected' : 'No data yet',
      tone: /** @type {StatusTone} */ (firebaseChecking ? 'muted' : firebaseOk ? 'ok' : 'bad'),
      quota:
        counts.registered != null
          ? `${counts.registered} user rows (userdb)`
          : '—',
      remaining:
        counts.reportCount != null
          ? `${counts.reportCount} interview reports stored`
          : '—',
      reset: firebaseOk ? 'Live subscription' : '—',
    },
    {
      key: 'groq',
      name: 'AI (Groq)',
      status: unreachable
        ? '—'
        : apiHealth?.llm
          ? 'Ready (SDK)'
          : 'Key missing on server',
      tone: /** @type {StatusTone} */ (unreachable ? 'muted' : apiHealth?.llm ? 'ok' : 'warn'),
      quota: unreachable ? '—' : gq.quota,
      remaining: unreachable ? '—' : gq.remaining,
      reset: unreachable ? '—' : gq.reset,
    },
    {
      key: 'tts',
      name: 'Google Cloud Text-to-Speech',
      status: unreachable ? '—' : apiHealth?.tts ? 'Credentials OK' : 'Not configured',
      tone: /** @type {StatusTone} */ (unreachable ? 'muted' : apiHealth?.tts ? 'ok' : 'warn'),
      quota: 'Usage not returned by API',
      remaining: '—',
      reset: 'See GCP → APIs & Services → Cloud Text-to-Speech → Quotas',
    },
    {
      key: 'resend',
      name: 'Resend (transactional email)',
      status: unreachable
        ? '—'
        : apiHealth?.email
          ? 'API key on server'
          : 'Not configured',
      tone: /** @type {StatusTone} */ (unreachable ? 'muted' : apiHealth?.email ? 'ok' : 'warn'),
      quota: unreachable ? '—' : rs.quota,
      remaining: unreachable ? '—' : rs.remaining,
      reset: unreachable ? '—' : rs.reset,
    },
  ]
}

function toneClass(tone) {
  switch (tone) {
    case 'ok':
      return 'text-emerald-300'
    case 'warn':
      return 'text-amber-300'
    case 'bad':
      return 'text-red-300'
    default:
      return 'text-admin-500'
  }
}

export default function Dashboard() {
  const [userMetrics, setUserMetrics] = useState({
    registered: null,
    paymentPendingReview: null,
    onlineNow: null,
    legacyUnknown: null,
  })
  const [reportCount, setReportCount] = useState(null)
  const [loadingFirebase, setLoadingFirebase] = useState(true)
  const [apiHealth, setApiHealth] = useState(null)
  const [apiChecking, setApiChecking] = useState(false)
  const [financeTotals, setFinanceTotals] = useState({
    collected: null,
    payout: null,
    turnover: null,
  })
  const [loadingFinance, setLoadingFinance] = useState(true)

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

  const refreshFinanceTotals = useCallback(async () => {
    setLoadingFinance(true)
    try {
      const rows = await listCouponStatuses()
      let collected = 0
      let payout = 0
      for (const row of rows) {
        collected += Number(row?.totalAmountCollected) || 0
        payout += Number(row?.totalContractPayout) || 0
      }
      setFinanceTotals({
        collected,
        payout,
        turnover: collected - payout,
      })
    } catch {
      setFinanceTotals({
        collected: 0,
        payout: 0,
        turnover: 0,
      })
    } finally {
      setLoadingFinance(false)
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

  useEffect(() => {
    refreshFinanceTotals()
    const id = window.setInterval(refreshFinanceTotals, 120_000)
    return () => window.clearInterval(id)
  }, [refreshFinanceTotals])

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
            hint="Real users only (has email + explicit access status)"
            loading={loadingFirebase && userMetrics.registered == null}
          />
          <StatCard
            to="/users?filter=unknownLegacy"
            icon={ExclamationTriangleIcon}
            title="Unknown / legacy rows"
            value={userMetrics.legacyUnknown}
            hint="Rows missing email or access status; review/clean up in User management"
            loading={loadingFirebase && userMetrics.legacyUnknown == null}
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
          <StatCard
            icon={BanknotesIcon}
            to="/coupons"
            title="Coupon finance summary"
            value={
              financeTotals.turnover == null
                ? '—'
                : `Collected ${formatInr(financeTotals.collected)} | Payout ${formatInr(financeTotals.payout)} | Turnover ${formatInr(financeTotals.turnover)}`
            }
            hint="All coupon codes combined: turnover = money collected minus payouts"
            loading={loadingFinance}
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
              <p className="text-xs text-admin-500 leading-relaxed">
                Live numbers: Node process stats and Firebase row counts from this dashboard; Groq/Resend from provider
                HTTP headers (one tiny Groq completion per refresh). Google TTS usage is only in Google Cloud Console.
                Set <code className="text-admin-400">VITE_JOBRUSH_API_BASE</code> to point at a staging API if needed.
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
            <>
              <div className="sm:hidden space-y-4">
                {buildServiceHealthRows(
                  apiHealth,
                  {
                    firebaseOk: userMetrics.registered != null || reportCount != null,
                    firebaseChecking: loadingFirebase,
                  },
                  { registered: userMetrics.registered, reportCount }
                ).map((row) => (
                  <div
                    key={row.key}
                    className="rounded-xl border border-admin-800/90 bg-admin-950/40 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-admin-200 text-sm font-medium">{row.name}</span>
                      {row.tone === 'ok' ? (
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : row.tone === 'bad' ? (
                        <XCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
                      ) : row.tone === 'warn' ? (
                        <SignalIcon className="w-5 h-5 text-amber-400 shrink-0" />
                      ) : null}
                    </div>
                    <p className={`text-sm ${toneClass(row.tone)}`}>{row.status}</p>
                    <dl className="grid grid-cols-1 gap-1.5 text-xs pt-1 border-t border-admin-800/60">
                      <div>
                        <dt className="text-admin-500">Quota</dt>
                        <dd className="text-admin-300 leading-snug">{row.quota}</dd>
                      </div>
                      <div>
                        <dt className="text-admin-500">Remaining</dt>
                        <dd className="text-admin-300 leading-snug">{row.remaining}</dd>
                      </div>
                      <div>
                        <dt className="text-admin-500">Resets</dt>
                        <dd className="text-admin-300 leading-snug">{row.reset}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto -mx-1">
                <table className="w-full text-sm text-left min-w-[640px]">
                  <thead>
                    <tr className="border-b border-admin-800/80 text-admin-500 text-xs uppercase tracking-wide">
                      <th className="py-2 pr-4 font-medium">Service</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Quota</th>
                      <th className="py-2 pr-4 font-medium">Remaining</th>
                      <th className="py-2 font-medium">Resets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-800/70">
                    {buildServiceHealthRows(
                      apiHealth,
                      {
                        firebaseOk: userMetrics.registered != null || reportCount != null,
                        firebaseChecking: loadingFirebase,
                      },
                      { registered: userMetrics.registered, reportCount }
                    ).map((row) => (
                      <tr key={row.key} className="align-top">
                        <td className="py-3 pr-4 text-admin-200 font-medium whitespace-nowrap">{row.name}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 ${toneClass(row.tone)}`}>
                            {row.tone === 'ok' ? (
                              <CheckCircleIcon className="w-4 h-4 shrink-0" />
                            ) : row.tone === 'bad' ? (
                              <XCircleIcon className="w-4 h-4 shrink-0" />
                            ) : row.tone === 'warn' ? (
                              <SignalIcon className="w-4 h-4 shrink-0" />
                            ) : null}
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-admin-400 max-w-[14rem] leading-snug">{row.quota}</td>
                        <td className="py-3 pr-4 text-admin-400 max-w-[14rem] leading-snug">{row.remaining}</td>
                        <td className="py-3 text-admin-400 max-w-[14rem] leading-snug">{row.reset}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
