import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  SparklesIcon,
  DocumentMagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import DownloadResumeModal from '../components/DownloadResumeModal.jsx'
import { getRecommendations, pingHealth } from '../services/groqService.js'
import { evaluateResume } from '../ats/index.js'
import { getDisplayLines } from '../utils/cleanAiText.js'

const FALLBACK_RECOMMENDATIONS = [
  { section: 'Skills', current: 'Review your skills section', suggestion: 'Add ATS-targeted keywords from job descriptions', impact: 'High' },
  { section: 'Projects', current: 'Add project details', suggestion: 'Quantify impact with metrics (users, %, time saved)', impact: 'High' },
  { section: 'Experience', current: 'Use action verbs', suggestion: 'Rewrite bullet points with verbs like "Led", "Built", "Reduced"', impact: 'Medium' },
  { section: 'Keywords', current: 'Missing common terms', suggestion: 'Incorporate Agile, CI/CD, or role-specific keywords', impact: 'High' },
]

const STORAGE_KEY = 'jobRush_parsed_resume'
const RECOMMENDATION_COOLDOWN_MS = 45000

const ResumeImprovements = () => {
  const [resume, setResume] = useState(null)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [recommendations, setRecommendations] = useState(FALLBACK_RECOMMENDATIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [nowTs, setNowTs] = useState(Date.now())
  const [iterationIndex, setIterationIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const cooldownRemainingMs = Math.max(0, cooldownUntil - nowTs)
  const cooldownRemainingSec = Math.ceil(cooldownRemainingMs / 1000)
  const isCooldownActive = cooldownRemainingMs > 0
  const groupedRecommendations = React.useMemo(() => {
    const out = []
    for (let i = 0; i < recommendations.length; i += 3) out.push(recommendations.slice(i, i + 3))
    return out
  }, [recommendations])
  const totalIterations = groupedRecommendations.length || 1
  const activeIteration = Math.min(iterationIndex, totalIterations - 1)
  const visibleRecommendations = groupedRecommendations[activeIteration] || []

  const fetchRecommendations = React.useCallback(async () => {
    const now = Date.now()
    if (cooldownUntil > now) return
    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    if (!parsed) return
    setResume(parsed)
    setLoading(true)
    setError(null)
    setCooldownUntil(now + RECOMMENDATION_COOLDOWN_MS)
    const evaluation = evaluateResume(parsed)
    try {
      console.log('[ResumeImprovements] Fetching recommendations')
      const reachable = await pingHealth(9, 10000)
      if (!reachable) {
        setError(
          'The JobRush API did not respond to health checks (about 90s). On Render free tier the service sleeps—wait 1–2 minutes and tap Retry. The app calls https://jobrush.onrender.com directly; confirm that service is running in the Render dashboard.'
        )
        setLoading(false)
        return
      }
      const { recommendations: recs } = await getRecommendations(parsed, evaluation)
      if (recs?.length > 0) {
        setRecommendations(recs)
        setIterationIndex(0)
      }
      setError(null)
      console.log('[ResumeImprovements] Success', { count: recs?.length })
    } catch (err) {
      console.error('[ResumeImprovements] Error', { message: err.message, name: err.name, stack: err.stack })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [cooldownUntil])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  return (
    <div>
      <Link
        to="/ats-analysis"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to ATS Analysis
      </Link>

      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2 flex-wrap">
              <SparklesIcon className="w-8 h-8 text-primary-600" />
              AI Resume Improvement Recommendations
            </h1>
            <p className="text-gray-600">
              Targeted suggestions from AI based on your resume and ATS evaluation.
            </p>
          </div>
          {resume && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowDownloadModal(true)}
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download PDF
              </button>
              <Link
                to="/resume-upload"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
              >
                <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                View resume
              </Link>
            </div>
          )}
        </div>

        {!resume && !loading && (
          <p className="text-amber-600 mb-6">Upload and parse a resume on the ATS Analysis page first.</p>
        )}
        {loading && (
          <div className="flex flex-col gap-3 text-primary-600 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Crafting your personalized recommendations...</span>
            </div>
            <p className="text-sm text-gray-600 italic">
              Our AI is analyzing your resume against top ATS standards—almost there!
            </p>
            <p className="text-xs text-gray-500">
              💡 Tip: Strong resumes use action verbs and quantify impact. We're finding the best ways to highlight yours.
            </p>
          </div>
        )}
        {error && (
          <div className="mb-4 max-w-3xl rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
            <p className="font-semibold text-amber-900">Using built-in suggestions</p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-amber-900/90">{error}</p>
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={isCooldownActive || loading}
              className="mt-3 text-sm font-medium text-primary-700 hover:text-primary-800 underline"
            >
              {isCooldownActive ? `Retry available in ${cooldownRemainingSec}s` : 'Retry'}
            </button>
          </div>
        )}
        {isCooldownActive && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span>Please wait {cooldownRemainingSec}s before refreshing recommendations.</span>
          </div>
        )}
        <div className="space-y-6">
          {recommendations.length > 0 && (
            <div className="mb-2 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Iteration {activeIteration + 1}</span> of {totalIterations}
                {' '}({visibleRecommendations.length} recommendations)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIterationIndex((v) => Math.max(0, v - 1))}
                  disabled={activeIteration === 0}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setIterationIndex((v) => Math.min(totalIterations - 1, v + 1))}
                  disabled={activeIteration >= totalIterations - 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {visibleRecommendations.map((rec, index) => (
            <div
              key={`${activeIteration}-${index}-${rec.section}`}
              className="p-4 sm:p-6 rounded-xl border-2 border-gray-200 bg-gray-50"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-900">{rec.section}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    rec.impact === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {rec.impact} impact
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Current:</span> {rec.current}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Where to apply:</span> {rec.where || rec.section}
                </p>
                <p className="text-sm text-primary-700">
                  <span className="font-medium">Suggestion:</span>{' '}
                  {typeof rec.suggestion === 'string' ? (
                    (() => {
                      const lines = getDisplayLines(rec.suggestion)
                      return lines.length > 0 ? (
                        <span className="block mt-1 space-y-1">
                          {lines.map((line, i) => (
                            <span key={i} className="flex gap-2">
                              <span className="text-primary-500 shrink-0">•</span>
                              <span>{line}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        rec.suggestion.trim() || '—'
                      )
                    })()
                  ) : (
                    rec.suggestion ?? '—'
                  )}
                </p>
                {Array.isArray(rec.steps) && rec.steps.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-sm font-medium text-gray-900">Step-by-step</p>
                    <div className="mt-2 space-y-1">
                      {rec.steps.map((step, i) => (
                        <p key={i} className="text-sm text-gray-700">
                          {i + 1}. {step}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DownloadResumeModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        resume={resume}
      />
    </div>
  )
}

export default ResumeImprovements
