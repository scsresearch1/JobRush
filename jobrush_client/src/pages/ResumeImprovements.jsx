import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import DownloadResumeModal from '../components/DownloadResumeModal.jsx'
import { getRecommendations, applyCorrection, pingHealth } from '../services/groqService.js'
import { evaluateResume } from '../ats/index.js'
import { getDisplayLines } from '../utils/cleanAiText.js'
import { buildStorableAtsReport, getUser, incrementAtsCheckUsage, saveAtsReport } from '../services/database.js'
import { USERDB_FIELDS } from '../config/databaseSchema.js'

const FALLBACK_RECOMMENDATIONS = [
  { section: 'Skills', current: 'Review your skills section', suggestion: 'Add ATS-targeted keywords from job descriptions', impact: 'High' },
  { section: 'Projects', current: 'Add project details', suggestion: 'Quantify impact with metrics (users, %, time saved)', impact: 'High' },
  { section: 'Experience', current: 'Use action verbs', suggestion: 'Rewrite bullet points with verbs like "Led", "Built", "Reduced"', impact: 'Medium' },
  { section: 'Keywords', current: 'Missing common terms', suggestion: 'Incorporate Agile, CI/CD, or role-specific keywords', impact: 'High' },
]

const STORAGE_KEY = 'jobRush_parsed_resume'

const ResumeImprovements = () => {
  const [resume, setResume] = useState(null)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [applied, setApplied] = useState({})
  const [recommendations, setRecommendations] = useState(FALLBACK_RECOMMENDATIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(null) // index | 'all' | null
  /** When Apply All runs, show "2 / 4" so users know it is sequential LLM calls (can take minutes on cold API). */
  const [applyAllProgress, setApplyAllProgress] = useState(null) // { done, total } | null
  const [applyError, setApplyError] = useState(null)

  const fetchRecommendations = React.useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    if (!parsed) return
    setResume(parsed)
    setLoading(true)
    setError(null)
    const evaluation = evaluateResume(parsed)
    try {
      console.log('[ResumeImprovements] Fetching recommendations')
      // Pre-warm: wait for server to be ready (retries every 10s, up to 90s)
      await pingHealth(9, 10000)
      const { recommendations: recs } = await getRecommendations(parsed, evaluation)
      if (recs?.length > 0) setRecommendations(recs)
      setError(null)
      console.log('[ResumeImprovements] Success', { count: recs?.length })
    } catch (err) {
      console.error('[ResumeImprovements] Error', { message: err.message, name: err.name, stack: err.stack })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const saveResume = (modified) => {
    setResume(modified)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modified))
  }

  const consumePendingAtsUsage = async (resumeForUsage) => {
    let user = {}
    try {
      user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
    } catch {
      user = {}
    }
    const uid = user?.uniqueId
    if (!uid || String(uid).startsWith('local_')) return

    let pending = null
    try {
      pending = JSON.parse(sessionStorage.getItem('_jrush_ats_pending') || 'null')
    } catch {
      pending = null
    }
    if (!pending || pending.uid !== uid) return

    const evaluation = evaluateResume(resumeForUsage)
    const payload = buildStorableAtsReport(evaluation)
    if (payload) {
      await saveAtsReport(uid, payload)
    }
    await incrementAtsCheckUsage(uid)
    try {
      const latest = await getUser(uid)
      if (latest) {
        const raw = localStorage.getItem('jobRush_user')
        const prior = raw ? JSON.parse(raw) : {}
        localStorage.setItem(
          'jobRush_user',
          JSON.stringify({
            ...prior,
            accessStatus: latest[USERDB_FIELDS.ACCESS_STATUS] || prior.accessStatus,
            atsChecksUsed: Number(latest[USERDB_FIELDS.ATS_CHECKS_USED]) || prior.atsChecksUsed || 0,
            mockInterviewsUsed:
              Number(latest[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || prior.mockInterviewsUsed || 0,
          })
        )
      }
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem('_jrush_ats_pending')
    } catch {
      /* ignore */
    }
  }

  const handleApply = async (index) => {
    if (!resume || applied[index] || applying != null) return
    setApplying(index)
    setApplyError(null)
    try {
      await pingHealth(3, 4000)
      const { resume: modified } = await applyCorrection(resume, recommendations[index])
      saveResume(modified)
      setApplied((prev) => ({ ...prev, [index]: true }))
      await consumePendingAtsUsage(modified)
    } catch (err) {
      setApplyError(err.message)
    } finally {
      setApplying(null)
    }
  }

  const handleApplyAll = async () => {
    if (!resume || applying != null) return
    const toApply = recommendations.map((_, i) => i).filter((i) => !applied[i])
    if (toApply.length === 0) return
    setApplying('all')
    setApplyAllProgress({ done: 0, total: toApply.length })
    setApplyError(null)
    let current = resume
    try {
      await pingHealth(3, 4000)
      for (let step = 0; step < toApply.length; step++) {
        const index = toApply[step]
        setApplyAllProgress({ done: step, total: toApply.length })
        const { resume: modified } = await applyCorrection(current, recommendations[index])
        current = modified
        setApplied((prev) => ({ ...prev, [index]: true }))
      }
      saveResume(current)
      await consumePendingAtsUsage(current)
    } catch (err) {
      setApplyError(err.message)
    } finally {
      setApplying(null)
      setApplyAllProgress(null)
    }
  }

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
              {Object.keys(applied).length > 0 && (
                <Link
                  to="/resume-upload"
                  className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                  View updated resume
                </Link>
              )}
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <p className="text-amber-600 text-sm">Using default suggestions. ({error})</p>
            <button
              type="button"
              onClick={fetchRecommendations}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium underline"
            >
              Retry
            </button>
          </div>
        )}
        {applyError && (
          <p className="text-red-600 text-sm mb-4">Could not apply correction: {applyError}</p>
        )}

        <p className="text-xs text-gray-500 mb-4 max-w-xl">
          Each Apply calls the AI with your full resume. &quot;Apply All&quot; runs one request per suggestion in order and can take several minutes if the API was idle (cold start).
        </p>

        <div className="flex flex-col items-end gap-1 mb-6">
          <button
            onClick={handleApplyAll}
            disabled={
              !resume ||
              applying != null ||
              Object.keys(applied).length === recommendations.length
            }
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying === 'all' ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying
                {applyAllProgress
                  ? ` (${applyAllProgress.done + 1}/${applyAllProgress.total})`
                  : '...'}
              </>
            ) : (
              <>
                <ArrowPathIcon className="w-5 h-5" />
                Apply All Corrections
              </>
            )}
          </button>
          {applying === 'all' && applyAllProgress && (
            <span className="text-xs text-gray-500">
              Step {applyAllProgress.done + 1} of {applyAllProgress.total} — please wait
            </span>
          )}
        </div>

        <div className="space-y-6">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-4 sm:p-6 rounded-xl border-2 ${
                applied[index] ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
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
                </div>
                <button
                  onClick={() => handleApply(index)}
                  disabled={applied[index] || applying != null || !resume}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium shrink-0 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${
                    applied[index]
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {applied[index] ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      Applied
                    </>
                  ) : applying === index ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Applying...
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
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
