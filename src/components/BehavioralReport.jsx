/**
 * Stage 6 — Behavioral Report
 * Scientific-style presentation of time-series behavioral metrics.
 */

import React, { useMemo, useState } from 'react'
import { buildBehavioralReport, generateLocalInterviewTips } from '../utils/behavioralTimeSeries.js'
import { getInterviewRecommendations } from '../services/groqService.js'
import { saveInterviewReport } from '../services/database.js'

const CHART_HEIGHT = 80
const CHART_PADDING = { top: 8, right: 8, bottom: 20, left: 36 }

function MiniLineChart({ data, color, yLabel, yMax = 1, width = 280, height, fullWidth }) {
  if (!data?.length) return null
  const h = height ?? CHART_HEIGHT
  const padding = { ...CHART_PADDING }
  if (!yLabel) padding.left = 8
  const { top, right, bottom, left } = padding
  const innerW = width - left - right
  const innerH = h - top - bottom
  const svgWidth = fullWidth ? '100%' : width
  const svgHeight = h
  const maxX = Math.max(...data.map((_, i) => i))
  const scaleX = maxX > 0 ? innerW / maxX : 1
  const scaleY = (yMax > 0 ? innerH / yMax : innerH) * 0.9
  const pts = data
    .map((v, i) => {
      const x = left + i * scaleX
      const clamped = Math.max(0, Math.min(Number(v), yMax))
      const y = top + innerH - clamped * scaleY
      return `${x},${y}`
    })
    .join(' ')
  const pathD = data.length ? `M ${pts.replace(/\s+/g, ' L ')}` : ''

  return (
    <div className={`chart-mini ${fullWidth ? 'chart-mini-full' : ''}`}>
      {yLabel && <div className="chart-y-label">{yLabel}</div>}
      <svg width={svgWidth} height={svgHeight} viewBox={fullWidth ? `0 0 ${width} ${h}` : undefined} preserveAspectRatio={fullWidth ? 'xMidYMid meet' : undefined} className="chart-svg" style={{ overflow: 'hidden' }}>
        <defs>
          <clipPath id={`clip-${color.replace(/[^a-z0-9]/gi, '')}-${data.length}`}>
            <rect x={0} y={0} width={width} height={h} />
          </clipPath>
          <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, '')}-${data.length}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#clip-${color.replace(/[^a-z0-9]/gi, '')}-${data.length})`}>
          {/* Grid */}
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={left}
              y1={top + innerH - p * innerH}
              x2={left + innerW}
              y2={top + innerH - p * innerH}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
            />
          ))}
          {/* Area fill */}
          <path
            d={`${pathD} L ${left + innerW},${top + innerH} L ${left},${top + innerH} Z`}
            fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, '')}-${data.length})`}
          />
          {/* Line */}
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}

const BEHAVIORAL_GRAPH_HEIGHT = 100

function QuestionTimelineSection({ question, type, timeline, index }) {
  const { timeAxis, eyeContactRatio, faceVisibilityRatio, headPoseStabilityCurve, emotionCurves, blinkRateCurve, engagementCurve, confidenceTrendCurve, summary } = timeline

  if (!timeAxis?.length) {
    return (
      <article className="report-question-section">
        <header className="report-question-header">
          <span className="report-question-response-id">Response {index + 1}</span>
          <span className="report-question-type-badge">{type?.replace(/-/g, ' ')}</span>
        </header>
        <blockquote className="report-question-prompt">{question}</blockquote>
        <p className="report-no-data">No frame-level data (question skipped or recording not started).</p>
      </article>
    )
  }

  const blinkVals = (blinkRateCurve || []).filter((v) => v != null && Number.isFinite(Number(v)))
  const maxBlink = blinkVals.length ? Math.max(0.1, ...blinkVals) : 0.1
  const emotionColors = {
    neutral: '#64748b',
    happy: '#22c55e',
    fear: '#a855f7',
    surprise: '#f59e0b',
    anger: '#ef4444',
    sadness: '#3b82f6',
    disgust: '#84cc16',
  }

  return (
    <article className="report-question-section">
      <header className="report-question-header">
        <span className="report-question-response-id">Response {index + 1}</span>
        <span className="report-question-type-badge">{type?.replace(/-/g, ' ')}</span>
      </header>
      <blockquote className="report-question-prompt">{question}</blockquote>

      {/* Stage 8: Question-Level Analysis */}
      {summary.questionAnalysis && (
        <div className="report-question-analysis">
          <div className="report-qa-title">Table {index + 1}. Summary metrics</div>
          <div className="report-qa-scores">
            <div className="report-qa-score">
              <span className="report-qa-label">Confidence</span>
              <span className="report-qa-value">{summary.questionAnalysis.confidenceScore ?? summary.confidence ?? 0}</span>
            </div>
            <div className="report-qa-score">
              <span className="report-qa-label">Engagement</span>
              <span className="report-qa-value">{summary.questionAnalysis.engagementScore ?? 0}</span>
            </div>
            <div className="report-qa-score">
              <span className="report-qa-label">Stability</span>
              <span className="report-qa-value">{summary.questionAnalysis.stabilityScore ?? 0}</span>
            </div>
          </div>
          <div className="report-qa-emotions">
            <span className="report-qa-emotions-label">Fig. {index + 1}a. Emotional probability distribution</span>
            <div className="report-qa-emotions-bars">
              {Object.entries(summary.questionAnalysis.emotionalProbabilityDistribution || {}).map(([key, prob]) => (
                <div key={key} className="report-qa-emotion-row">
                  <span className="report-qa-emotion-name" style={{ color: emotionColors[key] || '#64748b' }}>{key}</span>
                  <div className="report-qa-emotion-bar-bg">
                    <div
                      className="report-qa-emotion-bar"
                      style={{ width: `${safeToFixed((prob ?? 0) * 100, 0)}%`, backgroundColor: emotionColors[key] || '#64748b' }}
                    />
                  </div>
                  <span className="report-qa-emotion-pct">{safeToFixed((prob ?? 0) * 100, 0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="report-metrics-grid">
        <div className="report-metric-cell report-metric-confidence">
          <span className="report-metric-label">Confidence</span>
          <span className="report-metric-value">{summary.confidence ?? 0}/100</span>
        </div>
        <div className="report-metric-cell">
          <span className="report-metric-label">Eye-contact ratio</span>
          <span className="report-metric-value">{safeToFixed((summary.meanEyeContactRatio ?? 0) * 100, 1)}%</span>
        </div>
        <div className="report-metric-cell">
          <span className="report-metric-label">Face visibility</span>
          <span className="report-metric-value">{safeToFixed((summary.meanFaceVisibility ?? 0) * 100, 1)}%</span>
        </div>
        <div className="report-metric-cell">
          <span className="report-metric-label">Head stability</span>
          <span className="report-metric-value">{safeToFixed((summary.meanHeadStability ?? 0) * 100, 1)}%</span>
        </div>
        <div className="report-metric-cell">
          <span className="report-metric-label">Blink rate</span>
          <span className="report-metric-value">{safeToFixed(summary.meanBlinkRate ?? 0, 2)} /s</span>
        </div>
        <div className="report-metric-cell">
          <span className="report-metric-label">Dominant affect</span>
          <span className="report-metric-value report-affect">{summary.dominantEmotion}</span>
        </div>
      </div>

      {/* Stage 9: Behavioral Graph Generation — computed locally */}
      <div className="report-behavioral-graphs">
        <div className="report-graphs-title">Fig. {index + 1}b. Time-series visualizations</div>

        <figure className="report-graph-emotion-full">
          <figcaption className="report-graph-card-title">Emotion probability (P)</figcaption>
          <div className="report-graph-emotion-stack">
            {Object.entries(emotionCurves || {}).map(([key, data]) => (
              <div key={key} className="report-graph-emotion-line">
                <span className="report-graph-emotion-legend" style={{ color: emotionColors[key] || '#64748b' }}>{key}</span>
                <MiniLineChart data={data} color={emotionColors[key] || '#64748b'} yLabel="" yMax={1} width={560} height={BEHAVIORAL_GRAPH_HEIGHT} />
              </div>
            ))}
          </div>
        </figure>

        <div className="report-graph-grid-2col">
          <figure className="report-graph-card">
            <figcaption className="report-graph-card-title">Eye contact ratio (EC)</figcaption>
            <MiniLineChart data={eyeContactRatio} color="#0ea5e9" yLabel="%" yMax={1} width={280} height={BEHAVIORAL_GRAPH_HEIGHT} fullWidth />
          </figure>
          <figure className="report-graph-card">
            <figcaption className="report-graph-card-title">Head stability (HS)</figcaption>
            <MiniLineChart data={headPoseStabilityCurve} color="#10b981" yLabel="HS" yMax={1} width={280} height={BEHAVIORAL_GRAPH_HEIGHT} fullWidth />
          </figure>
          <figure className="report-graph-card">
            <figcaption className="report-graph-card-title">Engagement ratio (ER)</figcaption>
            <MiniLineChart data={engagementCurve} color="#6366f1" yLabel="ER" yMax={1} width={280} height={BEHAVIORAL_GRAPH_HEIGHT} fullWidth />
          </figure>
          <figure className="report-graph-card">
            <figcaption className="report-graph-card-title">Confidence index (C)</figcaption>
            <MiniLineChart data={confidenceTrendCurve} color="#0284c7" yLabel="C" yMax={100} width={280} height={BEHAVIORAL_GRAPH_HEIGHT} fullWidth />
          </figure>
        </div>
      </div>

      <figure className="report-supplementary-charts">
        <figcaption className="report-chart-title">Fig. {index + 1}c. Blink rate (BR)</figcaption>
        <MiniLineChart data={blinkRateCurve} color="#f97316" yLabel="BR" yMax={maxBlink} fullWidth width={600} />
      </figure>
    </article>
  )
}

const AREA_LABELS = { 'eye-contact': 'Eye Contact', visibility: 'Visibility', stability: 'Stability', expression: 'Expression', general: 'General' }

function safeToFixed(v, digits = 1) {
  const n = Number(v)
  return (Number.isFinite(n) ? n : 0).toFixed(digits)
}

export default function BehavioralReport({ responses }) {
  const report = useMemo(() => buildBehavioralReport(responses || []), [responses])
  const [recommendations, setRecommendations] = useState([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsError, setRecsError] = useState(null)

  const fetchRecommendations = () => {
    if (!report.questionTimelines?.length) return
    setRecsLoading(true)
    setRecsError(null)
    getInterviewRecommendations(report)
      .then(async ({ recommendations: recs }) => {
        setRecommendations(recs || [])
        try {
          const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
          await saveInterviewReport(user?.uniqueId || 'anonymous', report, recs || [])
        } catch (e) {
          console.warn('Could not save report to Firebase:', e)
        }
      })
      .catch(() => {
        setRecommendations(generateLocalInterviewTips(report))
        setRecsError(null)
      })
      .finally(() => setRecsLoading(false))
  }

  if (!report.questionTimelines?.length) {
    return (
      <div className="report-empty">
        <p>No behavioral data available. Record video responses to generate the report.</p>
      </div>
    )
  }

  const { questionTimelines, overall } = report

  return (
    <article className="behavioral-report">
      <header className="report-header">
        <h1 className="report-title">Behavioral Analysis Report</h1>
        <p className="report-subtitle">Frame-level feature aggregation · Time-series metrics</p>
        <div className="report-confidence-badge">
          <span className="report-confidence-label">Visual Confidence</span>
          <span className="report-confidence-value">{overall.confidence ?? 0}</span>
          <span className="report-confidence-unit">/ 100</span>
        </div>
        <div className="report-meta">
          <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
          <span>Session duration: {safeToFixed(overall.totalDurationSec ?? 0, 1)} s</span>
        </div>
      </header>

      <section className="report-edge">
        <h2 className="report-section-title">Interview Edge</h2>
        <p className="report-edge-subtitle">AI-powered tips to sharpen your next performance</p>
        {recommendations.length === 0 && !recsLoading ? (
          <button
            type="button"
            onClick={fetchRecommendations}
            className="report-edge-fetch-btn"
          >
            Click to get recommendations
          </button>
        ) : null}
        {recsLoading && <p className="report-edge-loading">Generating tips...</p>}
        {recsError && <p className="report-edge-error">{recsError}</p>}
        {!recsLoading && !recsError && recommendations.length > 0 && (
          <ul className="report-edge-list">
            {recommendations
              .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
              .map((r, i) => (
                <li key={i} className="report-edge-item">
                  <span className="report-edge-area">{AREA_LABELS[r.area] || r.area}</span>
                  <span className="report-edge-tip">{r.tip}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="report-timelines">
        <div className="report-timelines-header">
          <span className="report-timelines-section-num">§ 2</span>
          <h2 className="report-timelines-title">Behavioral Timeline by Question</h2>
        </div>
        <p className="report-timelines-caption">Per-response frame-level metrics and time-series visualizations</p>
        <div className="report-timelines-list">
          {questionTimelines.map((qt, i) => (
            <QuestionTimelineSection key={i} question={qt.question} type={qt.type} timeline={qt.timeline} index={i} />
          ))}
        </div>
      </section>

      <footer className="report-footer">
        <p>JobRush Mock Interview · Behavioral metrics are computed locally. No video or biometric data is transmitted.</p>
      </footer>
    </article>
  )
}
