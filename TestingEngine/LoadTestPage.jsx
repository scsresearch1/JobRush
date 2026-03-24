import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  BoltIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'

const DEFAULT_TOTAL = 10000
const DEFAULT_CONCURRENCY = 100
const TIMEOUT_MS = 15000
const THROUGHPUT_HISTORY_MAX = 30

/** Production targets (load test suite) */
export const NETLIFY_FRONTEND_URL = 'https://jbrush.netlify.app/'
export const RENDER_BACKEND_HEALTH_URL = 'https://jobrush.onrender.com/api/health'

const PRESET_LABELS = {
  backend: 'Render — backend API (/api/health)',
  frontend: 'Netlify — frontend (site root)',
  custom: 'Custom URL',
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function median(sorted) {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildStats(latencies, success, failed, completed, total, errorsMap) {
  const sorted = [...latencies].sort((a, b) => a - b)
  const errObj = Object.fromEntries(errorsMap)
  return {
    completed,
    total,
    success,
    failed,
    p50: median(sorted),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
    errors: errObj,
    successRatePct: completed > 0 ? (success / completed) * 100 : 0,
  }
}

async function runBatchedLoad({
  total,
  concurrency,
  url,
  signal,
  onTick,
}) {
  const latencies = []
  let success = 0
  let failed = 0
  let completed = 0
  const errors = new Map()

  while (completed < total && !signal.aborted) {
    const remaining = total - completed
    const batchSize = Math.min(concurrency, remaining)
    const batchPromises = []

    for (let b = 0; b < batchSize; b++) {
      batchPromises.push(
        (async () => {
          const t0 = performance.now()
          const ctrl = new AbortController()
          const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
          const onParentAbort = () => {
            clearTimeout(tid)
            ctrl.abort()
          }
          signal.addEventListener('abort', onParentAbort)
          try {
            const res = await fetch(url, {
              method: 'GET',
              signal: ctrl.signal,
              cache: 'no-store',
            })
            const t1 = performance.now()
            const ms = t1 - t0
            if (res.ok) {
              success++
              latencies.push(ms)
              return { ok: true, ms }
            }
            failed++
            const key = `HTTP ${res.status}`
            errors.set(key, (errors.get(key) || 0) + 1)
            return { ok: false }
          } catch (e) {
            failed++
            const key = e.name === 'AbortError' ? 'Aborted/timeout' : (e.message || 'Error')
            errors.set(key, (errors.get(key) || 0) + 1)
            return { ok: false }
          } finally {
            clearTimeout(tid)
            signal.removeEventListener('abort', onParentAbort)
          }
        })()
      )
    }

    await Promise.all(batchPromises)
    completed += batchSize

    onTick(buildStats(latencies, success, failed, completed, total, errors))
  }
}

const MetricCard = ({ label, value, sub, accent }) => (
  <div className={`rounded-xl border p-4 ${accent || 'border-slate-600 bg-slate-900/50'}`}>
    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</p>
    <p className="text-xl font-semibold font-mono text-white tabular-nums">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
)

const LoadTestPage = () => {
  const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? 'https://jobrush.onrender.com' : '')
  const fallbackLocalHealth = useMemo(() => {
    if (typeof window === 'undefined') return '/api/health'
    if (apiBase) return `${apiBase.replace(/\/$/, '')}/api/health`
    return `${window.location.origin}/api/health`
  }, [apiBase])

  const [targetPreset, setTargetPreset] = useState('backend')
  const [targetUrl, setTargetUrl] = useState(RENDER_BACKEND_HEALTH_URL)

  const setPreset = useCallback((preset) => {
    setTargetPreset(preset)
    if (preset === 'backend') setTargetUrl(RENDER_BACKEND_HEALTH_URL)
    else if (preset === 'frontend') setTargetUrl(NETLIFY_FRONTEND_URL)
  }, [])
  const [totalRequests, setTotalRequests] = useState(DEFAULT_TOTAL)
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY)
  const [running, setRunning] = useState(false)
  const [liveStats, setLiveStats] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [throughputHistory, setThroughputHistory] = useState([])
  const [finalReport, setFinalReport] = useState(null)
  const startWallRef = useRef(null)
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = setInterval(() => {
      if (startWallRef.current) setElapsedMs(Date.now() - startWallRef.current)
    }, 100)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [running])

  const lastStatsRef = useRef(null)

  const handleStart = useCallback(async () => {
    const total = Math.min(Math.max(1, Number(totalRequests) || DEFAULT_TOTAL), 500000)
    const conc = Math.min(Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY), 500)
    const url = targetUrl.trim() || RENDER_BACKEND_HEALTH_URL

    setRunning(true)
    setLiveStats(null)
    setFinalReport(null)
    setThroughputHistory([])
    setElapsedMs(0)
    lastStatsRef.current = null

    const ac = new AbortController()
    abortRef.current = ac
    const t0 = Date.now()
    startWallRef.current = t0

    const config = {
      targetUrl: url,
      targetPreset,
      targetLabel: PRESET_LABELS[targetPreset] || PRESET_LABELS.custom,
      totalRequests: total,
      concurrency: conc,
      requestTimeoutMs: TIMEOUT_MS,
      method: 'GET',
    }

    let lastSampleAt = t0
    let lastCompleted = 0

    const onTick = (stats) => {
      lastStatsRef.current = stats
      setLiveStats(stats)
      const now = Date.now()
      const dt = (now - lastSampleAt) / 1000
      if (dt >= 0.25) {
        const dCompleted = stats.completed - lastCompleted
        const instRps = dt > 0 ? dCompleted / dt : 0
        setThroughputHistory((h) => [...h, { t: now, rps: instRps, completed: stats.completed }].slice(-THROUGHPUT_HISTORY_MAX))
        lastSampleAt = now
        lastCompleted = stats.completed
      }
    }

    const wasAborted = { current: false }

    try {
      await runBatchedLoad({
        total,
        concurrency: conc,
        url,
        signal: ac.signal,
        onTick,
      })
    } catch {
      // ignore
    } finally {
      wasAborted.current = ac.signal.aborted
      const ended = Date.now()
      const durationMs = ended - t0
      setRunning(false)
      abortRef.current = null
      startWallRef.current = null

      const snap = lastStatsRef.current
      if (snap && snap.completed > 0) {
        const overallRps = durationMs > 0 ? (snap.completed / durationMs) * 1000 : 0
        setFinalReport({
          outcome: wasAborted.current ? 'stopped_early' : 'completed',
          config,
          stats: snap,
          durationMs,
          endedAt: new Date().toISOString(),
          overallRps,
        })
      } else if (wasAborted.current) {
        const empty = {
          completed: 0,
          total,
          success: 0,
          failed: 0,
          errors: {},
          successRatePct: 0,
          min: 0,
          max: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        }
        setFinalReport({
          outcome: 'stopped_early',
          config,
          stats: snap || empty,
          durationMs,
          endedAt: new Date().toISOString(),
          overallRps: snap && durationMs > 0 ? (snap.completed / durationMs) * 1000 : 0,
        })
      }
    }
  }, [targetUrl, targetPreset, totalRequests, concurrency])

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const liveRps = useMemo(() => {
    if (!running || !liveStats || elapsedMs < 100) return null
    return ((liveStats.completed / elapsedMs) * 1000).toFixed(1)
  }, [running, liveStats, elapsedMs])

  const maxHistRps = useMemo(() => {
    if (!throughputHistory.length) return 1
    return Math.max(...throughputHistory.map((x) => x.rps), 1)
  }, [throughputHistory])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <ChartBarIcon className="w-10 h-10 text-amber-400" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Load & concurrency test suite</h1>
            <p className="text-slate-400 text-sm mb-0">TestingEngine · JobRush.ai</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 flex gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90 space-y-2">
            <p>
              <strong className="text-amber-200">Browser limits:</strong> Parallelism is batched per wave. For production-grade
              distributed load, use k6 or Artillery.
            </p>
            <p>
              <strong className="text-amber-200">Presets:</strong> Backend —{' '}
              <code className="bg-slate-800 px-1 rounded">jobrush.onrender.com/api/health</code>
              {' · '}Frontend — <code className="bg-slate-800 px-1 rounded">jbrush.netlify.app</code> (GET site root).
              Hitting the Netlify URL from another origin may fail with CORS; run this page on{' '}
              <code className="bg-slate-800 px-1 rounded">jbrush.netlify.app</code> for accurate frontend tests.
            </p>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-6 mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <SignalIcon className="w-5 h-5 text-cyan-400" />
            Test configuration
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Target</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                disabled={running}
                onClick={() => setPreset('backend')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  targetPreset === 'backend'
                    ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                Backend (Render)
              </button>
              <button
                type="button"
                disabled={running}
                onClick={() => setPreset('frontend')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  targetPreset === 'frontend'
                    ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                Frontend (Netlify)
              </button>
              <button
                type="button"
                disabled={running}
                onClick={() => setTargetPreset('custom')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  targetPreset === 'custom'
                    ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                Custom URL
              </button>
              <button
                type="button"
                disabled={running}
                onClick={() => {
                  setTargetPreset('custom')
                  setTargetUrl(fallbackLocalHealth)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600"
                title="Vite proxy / same-origin API"
              >
                Local dev API
              </button>
            </div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Request URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => {
                setTargetUrl(e.target.value)
                setTargetPreset('custom')
              }}
              disabled={running}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              {PRESET_LABELS[targetPreset]} · <span className="text-slate-400">GET only</span>
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Total requests</label>
              <input
                type="number"
                min={1}
                max={500000}
                value={totalRequests}
                onChange={(e) => setTotalRequests(e.target.value)}
                disabled={running}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Concurrency (parallel per wave)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                disabled={running}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!running ? (
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl"
              >
                <PlayIcon className="w-5 h-5" />
                Start test
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl"
              >
                <StopIcon className="w-5 h-5" />
                Stop test
              </button>
            )}
          </div>
        </div>

        {/* Live dashboard */}
        {running && (
          <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                  <BoltIcon className="w-6 h-6" />
                  Live run
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-mono truncate max-w-xl" title={targetUrl}>
                  {PRESET_LABELS[targetPreset]} · {targetUrl}
                </p>
              </div>
              <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
                <ClockIcon className="w-5 h-5 text-slate-400" />
                <span>{(elapsedMs / 1000).toFixed(1)}s elapsed</span>
              </div>
            </div>

            {liveStats && (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-slate-400 mb-2">
                    <span>
                      Progress: {liveStats.completed.toLocaleString()} / {liveStats.total.toLocaleString()} requests
                    </span>
                    <span>{((liveStats.completed / liveStats.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 transition-all duration-150"
                      style={{ width: `${(liveStats.completed / liveStats.total) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <MetricCard
                    label="Concurrency (configured)"
                    value={String(concurrency)}
                    sub="parallel requests per wave"
                    accent="border-cyan-500/40 bg-cyan-950/20"
                  />
                  <MetricCard
                    label="Success rate"
                    value={`${liveStats.successRatePct.toFixed(1)}%`}
                    sub={`${liveStats.success.toLocaleString()} ok · ${liveStats.failed.toLocaleString()} failed`}
                    accent="border-emerald-500/40 bg-emerald-950/20"
                  />
                  <MetricCard
                    label="Throughput (avg so far)"
                    value={liveRps ? `${liveRps} req/s` : '—'}
                    sub="client-side measured"
                    accent="border-amber-500/40 bg-amber-950/20"
                  />
                  <MetricCard
                    label="Latency (avg)"
                    value={`${liveStats.avg.toFixed(0)} ms`}
                    sub={`p95 ${liveStats.p95.toFixed(0)} ms`}
                    accent="border-violet-500/40 bg-violet-950/20"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl border border-slate-600 p-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Latency distribution (ms)</p>
                    <div className="grid grid-cols-3 gap-2 text-sm font-mono">
                      <span className="text-slate-400">min</span>
                      <span className="text-white">{liveStats.min.toFixed(0)}</span>
                      <span />
                      <span className="text-slate-400">p50</span>
                      <span className="text-white">{liveStats.p50.toFixed(0)}</span>
                      <span />
                      <span className="text-slate-400">p95</span>
                      <span className="text-white">{liveStats.p95.toFixed(0)}</span>
                      <span />
                      <span className="text-slate-400">p99</span>
                      <span className="text-white">{liveStats.p99.toFixed(0)}</span>
                      <span />
                      <span className="text-slate-400">max</span>
                      <span className="text-white">{liveStats.max.toFixed(0)}</span>
                      <span />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-600 p-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Instant throughput (req/s)</p>
                    <div className="flex items-end gap-0.5 h-24">
                      {throughputHistory.map((pt, i) => (
                        <div
                          key={i}
                          className="flex-1 min-w-0 bg-cyan-500/80 rounded-t"
                          style={{ height: `${Math.max(8, (pt.rps / maxHistRps) * 100)}%` }}
                          title={`${pt.rps.toFixed(0)} req/s`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!liveStats && (
              <p className="text-slate-400 text-sm">Warming up first batch…</p>
            )}
          </div>
        )}

        {/* Final report matrix */}
        {finalReport && !running && (
          <div className="bg-slate-800/80 border border-emerald-500/40 rounded-2xl overflow-hidden mb-6">
            <div className="bg-emerald-950/40 px-6 py-4 border-b border-emerald-500/20">
              <h2 className="text-lg font-semibold text-emerald-300">
                Final report — {finalReport.outcome === 'completed' ? 'Run finished successfully' : 'Stopped early (partial)'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Ended at {new Date(finalReport.endedAt).toLocaleString()}
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600 text-left text-slate-400">
                      <th className="py-2 pr-4 font-medium">Parameter</th>
                      <th className="py-2 font-mono text-white">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/80">
                    <tr><td className="py-2 pr-4 text-slate-300">Outcome</td><td className="font-mono">{finalReport.outcome === 'completed' ? 'All planned requests completed' : 'Stopped by user (partial run)'}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Target preset</td><td className="font-mono">{finalReport.config.targetLabel || '—'}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Target URL</td><td className="font-mono break-all">{finalReport.config.targetUrl}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">HTTP method</td><td className="font-mono">{finalReport.config.method}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Planned total requests</td><td className="font-mono">{finalReport.config.totalRequests.toLocaleString()}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Concurrency (per wave)</td><td className="font-mono">{finalReport.config.concurrency}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Request timeout</td><td className="font-mono">{finalReport.config.requestTimeoutMs} ms</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Wall duration</td><td className="font-mono">{(finalReport.durationMs / 1000).toFixed(2)} s</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Requests completed</td><td className="font-mono">{finalReport.stats.completed.toLocaleString()}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Successful</td><td className="font-mono text-emerald-400">{finalReport.stats.success.toLocaleString()}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Failed</td><td className="font-mono text-red-400">{finalReport.stats.failed.toLocaleString()}</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Success rate</td><td className="font-mono">{finalReport.stats.successRatePct.toFixed(2)}%</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Avg throughput</td><td className="font-mono">{finalReport.overallRps.toFixed(1)} req/s</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Latency min / avg / max</td><td className="font-mono">{finalReport.stats.min.toFixed(0)} / {finalReport.stats.avg.toFixed(0)} / {finalReport.stats.max.toFixed(0)} ms</td></tr>
                    <tr><td className="py-2 pr-4 text-slate-300">Latency p50 / p95 / p99</td><td className="font-mono">{finalReport.stats.p50.toFixed(0)} / {finalReport.stats.p95.toFixed(0)} / {finalReport.stats.p99.toFixed(0)} ms</td></tr>
                  </tbody>
                </table>
              </div>

              {Object.keys(finalReport.stats.errors || {}).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Error breakdown</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-600">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-900/80 text-left text-slate-400">
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(finalReport.stats.errors).map(([k, v]) => (
                          <tr key={k} className="border-t border-slate-700">
                            <td className="py-2 px-3 font-mono text-amber-200">{k}</td>
                            <td className="py-2 px-3 font-mono">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoadTestPage
