/**
 * Stage 6 — Time-Series Aggregation
 * Stage 7 — Visual Confidence Score Computation
 * Stage 8 — Question-Level Analysis
 * Stage 9 — Behavioral Graph Generation
 * Aggregates frame-level features into behavioral timelines per question.
 */

import { getISTTimestamp } from './timestamp.js'

const EMOTION_KEYS = ['neutral', 'happy', 'fear', 'surprise', 'anger', 'sadness', 'disgust']

// Stage 7: Confidence composite weights (EC, HS, FV, ES, ER)
const CONFIDENCE_WEIGHTS = { EC: 0.2, HS: 0.2, FV: 0.2, ES: 0.2, ER: 0.2 }
const WINDOW_SIZE_FRAMES = 8 // ~2s at 250ms sampling
const SAMPLE_INTERVAL_MS = 250

/**
 * Compute running-window ratio for a boolean series
 */
function runningRatio(frames, key, windowSize = WINDOW_SIZE_FRAMES) {
  return frames.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const slice = frames.slice(start, i + 1)
    const count = slice.filter((f) => f && f[key] === true).length
    return count / slice.length
  })
}

/**
 * Extract raw time series for a numeric field
 */
function rawSeries(frames, key, defaultValue = 0) {
  return frames.map((f) => (f && typeof f[key] === 'number' ? f[key] : defaultValue))
}

/**
 * Extract emotion probability series
 */
function emotionSeries(frames, emotionKey) {
  return frames.map((f) => {
    const probs = f?.facialEmotionProbabilities
    return probs && typeof probs[emotionKey] === 'number' ? probs[emotionKey] : 0
  })
}

/**
 * Normalize timestamps to elapsed seconds from first frame
 */
function normalizeTimestamps(frames) {
  const t0 = frames[0]?.timestamp ?? 0
  return frames.map((f) => ((f?.timestamp ?? 0) - t0) / 1000)
}

/**
 * Aggregate frame-level metrics into time-series for a single question response
 * @param {Array} frameMetrics - Array of frame-level features from Stage 5
 * @returns {Object} Behavioral timeline
 */
export function aggregateBehavioralTimeline(frameMetrics) {
  const frames = Array.isArray(frameMetrics) ? frameMetrics : []
  if (frames.length === 0) {
    const emptyDist = EMOTION_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
    emptyDist.neutral = 1
    return {
      durationSec: 0,
      timeAxis: [],
      eyeContactRatio: [],
      faceVisibilityRatio: [],
      headPoseStabilityCurve: [],
      emotionCurves: {},
      blinkRateCurve: [],
      engagementCurve: [],
      confidenceTrendCurve: [],
      summary: {
        confidence: 0,
        emotionalStability: 1,
        engagementRatio: 0,
        questionAnalysis: { confidenceScore: 0, engagementScore: 0, stabilityScore: 0, emotionalProbabilityDistribution: emptyDist },
      },
    }
  }

  const timeAxis = normalizeTimestamps(frames)

  const eyeContactRatio = runningRatio(frames, 'eyeDirectionProxy')
  const faceVisibilityRatio = runningRatio(frames, 'facePresence')
  const headPoseStabilityCurve = rawSeries(frames, 'facialStability', 1)
  const blinkRateCurve = rawSeries(frames, 'blinkFrequency', 0)

  const emotionCurves = {}
  for (const key of EMOTION_KEYS) {
    emotionCurves[key] = emotionSeries(frames, key)
  }

  // Stage 9: Behavioral graph data (computed locally)
  const emotionalStabilityCurveData = emotionalStabilityCurve(frames)
  const engagementCurve = eyeContactRatio.map((ec, i) => (ec + faceVisibilityRatio[i]) / 2)
  const confidenceTrendCurveData = confidenceTrendCurve(eyeContactRatio, faceVisibilityRatio, headPoseStabilityCurve, emotionalStabilityCurveData)

  const durationSec = timeAxis[timeAxis.length - 1] - timeAxis[0] || 0.25

  const meanEC = mean(eyeContactRatio)
  const meanFV = mean(faceVisibilityRatio)
  const meanHS = mean(headPoseStabilityCurve)
  const emotionalStability = computeEmotionalStability(frames)
  const engagementRatio = (meanEC + meanFV) / 2

  const confidence = computeConfidenceScore(meanEC, meanHS, meanFV, emotionalStability, engagementRatio)
  const engagementScore = Math.round(clamp(engagementRatio, 0, 1) * 100)
  const stabilityScore = Math.round(clamp((meanHS + emotionalStability) / 2, 0, 1) * 100)
  const emotionalProbabilityDistribution = EMOTION_KEYS.reduce((acc, k) => {
    acc[k] = mean(emotionCurves[k] || [])
    return acc
  }, {})

  const summary = {
    meanEyeContactRatio: meanEC,
    meanFaceVisibility: meanFV,
    meanHeadStability: meanHS,
    meanBlinkRate: mean(blinkRateCurve),
    emotionalStability,
    engagementRatio,
    dominantEmotion: getDominantEmotion(frames),
    frameCount: frames.length,
    durationSec,
    confidence,
    // Stage 8: Question-level analysis
    questionAnalysis: {
      confidenceScore: confidence,
      engagementScore,
      stabilityScore,
      emotionalProbabilityDistribution,
    },
  }

  return {
    durationSec,
    timeAxis,
    eyeContactRatio,
    faceVisibilityRatio,
    headPoseStabilityCurve,
    emotionCurves,
    blinkRateCurve,
    engagementCurve,
    confidenceTrendCurve: confidenceTrendCurveData,
    summary,
  }
}

function mean(arr) {
  if (!arr?.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function getDominantEmotion(frames) {
  const totals = EMOTION_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
  for (const f of frames) {
    const p = f?.facialEmotionProbabilities
    if (p) for (const k of EMOTION_KEYS) totals[k] += p[k] ?? 0
  }
  let maxKey = 'neutral'
  let maxVal = 0
  for (const k of EMOTION_KEYS) {
    if (totals[k] > maxVal) {
      maxVal = totals[k]
      maxKey = k
    }
  }
  return maxKey
}

/**
 * Stage 7: Emotional stability — inverse of emotion transitions over time
 * Lower variance in dominant emotion = higher stability (0–1)
 */
function computeEmotionalStability(frames) {
  if (!frames?.length) return 1
  let transitions = 0
  let prevDominant = null
  for (const f of frames) {
    const p = f?.facialEmotionProbabilities
    if (!p) continue
    let maxKey = 'neutral'
    let maxVal = 0
    for (const k of EMOTION_KEYS) {
      if ((p[k] ?? 0) > maxVal) {
        maxVal = p[k]
        maxKey = k
      }
    }
    if (prevDominant != null && prevDominant !== maxKey) transitions++
    prevDominant = maxKey
  }
  const maxTransitions = Math.max(1, frames.length - 1)
  return Math.max(0, 1 - transitions / maxTransitions)
}

/**
 * Stage 9: Per-frame emotional stability curve (running window)
 */
function emotionalStabilityCurve(frames, windowSize = WINDOW_SIZE_FRAMES) {
  return frames.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const slice = frames.slice(start, i + 1)
    return computeEmotionalStability(slice)
  })
}

/**
 * Stage 9: Per-frame confidence trend (0–100)
 */
function confidenceTrendCurve(eyeContact, faceVisibility, headStability, emotionalStabilityCurve) {
  const engagement = eyeContact.map((ec, i) => (ec + faceVisibility[i]) / 2)
  return eyeContact.map((ec, i) => {
    const hs = headStability[i] ?? 1
    const fv = faceVisibility[i] ?? 0
    const es = emotionalStabilityCurve[i] ?? 1
    const er = engagement[i] ?? 0
    return computeConfidenceScore(ec, hs, fv, es, er)
  })
}

/**
 * Stage 7: Confidence = w₁EC + w₂HS + w₃FV + w₄ES + w₅ER
 * All components normalized 0–1, result scaled to 0–100
 */
function computeConfidenceScore(EC, HS, FV, ES, ER) {
  const { EC: w1, HS: w2, FV: w3, ES: w4, ER: w5 } = CONFIDENCE_WEIGHTS
  const raw = w1 * clamp(EC, 0, 1) + w2 * clamp(HS, 0, 1) + w3 * clamp(FV, 0, 1) + w4 * clamp(ES, 0, 1) + w5 * clamp(ER, 0, 1)
  return Math.round(Math.min(100, Math.max(0, raw * 100)))
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Aggregate all question responses into a full behavioral report
 * @param {Array} responses - Array of { question, type, frameMetrics }
 * @returns {Object} Full report with per-question timelines and overall stats
 */
export function buildBehavioralReport(responses) {
  const questionTimelines = (responses || []).map((r) => ({
    question: r?.question ?? 'Unknown',
    type: r?.type ?? 'unknown',
    timeline: aggregateBehavioralTimeline(r?.frameMetrics ?? []),
  }))

  const avgEC = mean(questionTimelines.map((q) => q.timeline.summary.meanEyeContactRatio))
  const avgFV = mean(questionTimelines.map((q) => q.timeline.summary.meanFaceVisibility))
  const avgHS = mean(questionTimelines.map((q) => q.timeline.summary.meanHeadStability))
  const avgES = mean(questionTimelines.map((q) => q.timeline.summary.emotionalStability ?? 1))
  const avgER = mean(questionTimelines.map((q) => q.timeline.summary.engagementRatio ?? (avgEC + avgFV) / 2))

  const overall = {
    totalQuestions: questionTimelines.length,
    totalDurationSec: questionTimelines.reduce((s, q) => s + q.timeline.durationSec, 0),
    avgEyeContact: avgEC,
    avgFaceVisibility: avgFV,
    avgHeadStability: avgHS,
    avgBlinkRate: mean(questionTimelines.map((q) => q.timeline.summary.meanBlinkRate)),
    avgEmotionalStability: avgES,
    avgEngagementRatio: avgER,
    confidence: computeConfidenceScore(avgEC, avgHS, avgFV, avgES, avgER),
    confidenceComponents: { EC: avgEC, HS: avgHS, FV: avgFV, ES: avgES, ER: avgER },
  }

  return {
    questionTimelines,
    overall,
    generatedAt: getISTTimestamp(),
  }
}

/**
 * Generate local Interview Edge tips when API is unavailable
 * @param {Object} report - Behavioral report with overall
 * @returns {Array<{ tip: string, area: string, priority: number }>}
 */
export function generateLocalInterviewTips(report) {
  const overall = report?.overall ?? {}
  const ec = overall.avgEyeContact ?? 0
  const fv = overall.avgFaceVisibility ?? 0
  const hs = overall.avgHeadStability ?? 0
  const es = overall.avgEmotionalStability ?? 1
  const br = overall.avgBlinkRate ?? 0
  const confidence = overall.confidence ?? 0
  const tips = []

  if (ec < 0.5) tips.push({ tip: 'Look at the camera more often—aim for at least 50% eye contact during your answers.', area: 'eye-contact', priority: 1 })
  if (fv < 0.7) tips.push({ tip: 'Keep your face centered in the frame. Avoid turning away or moving out of view.', area: 'visibility', priority: 2 })
  if (hs < 0.6) tips.push({ tip: 'Try to keep your head steadier. Excessive nodding or movement can distract the interviewer.', area: 'stability', priority: 3 })
  if (es < 0.7) tips.push({ tip: 'Maintain a calm, consistent expression. Avoid sudden shifts in facial expression mid-answer.', area: 'expression', priority: 4 })
  if (br > 0.5) tips.push({ tip: 'Your blink rate is elevated—take a breath before answering to help you relax.', area: 'general', priority: 5 })
  if (confidence < 50) tips.push({ tip: 'Practice your answers beforehand. Confidence grows with preparation.', area: 'general', priority: 6 })

  if (tips.length === 0) {
    tips.push(
      { tip: 'Keep practicing! Maintain eye contact and a steady posture for your next interview.', area: 'general', priority: 1 },
      { tip: 'Record yourself answering common questions to spot areas for improvement.', area: 'general', priority: 2 },
    )
  }

  return tips.slice(0, 6)
}
