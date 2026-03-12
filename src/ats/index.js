/**
 * Scientific ATS Evaluation Platform - Main Orchestrator
 * Deterministic, reproducible, explainable evaluation
 */

import { normalizeResume } from './engines/sectionNormalizer.js'
import { extractEvidence } from './engines/evidenceExtractor.js'
import { matchResumeToProfile } from './engines/matchingEngine.js'
import { calculateWeightedScore } from './engines/scoreCalculator.js'
import { calibrateScore } from './engines/calibrationLayer.js'
import {
  MASS_HIRING_PROFILES,
  MAANG_PROFILES,
  IVY_LEAGUE_PROFILES,
} from './config/companyProfiles.js'

const ALL_PROFILES = [
  ...MASS_HIRING_PROFILES,
  ...MAANG_PROFILES,
  ...IVY_LEAGUE_PROFILES,
]

/**
 * Run full ATS evaluation pipeline
 * @param {Object} parsedResume - Raw parsed resume (from parser or mock)
 * @returns {Object} Complete evaluation result
 */
export function evaluateResume(parsedResume) {
  if (!parsedResume) return null

  const normalized = normalizeResume(parsedResume)
  const evidence = extractEvidence(normalized)

  const companyScores = []
  const details = {}

  for (const profile of ALL_PROFILES) {
    const matchResult = matchResumeToProfile(evidence, profile)
    const scoreBreakdown = calculateWeightedScore(matchResult, normalized, profile)
    const calibrated = calibrateScore(scoreBreakdown, matchResult, evidence)

    companyScores.push({
      entity: profile.entity,
      type: profile.type,
      score: calibrated.calibrated_score,
      raw_score: calibrated.raw_score,
      breakdown: scoreBreakdown,
      matched_mandatory: matchResult.matchedMandatory.map(m => m.skill),
      missing_mandatory: matchResult.missingMandatory.map(m => m.skill),
      matched_preferred: matchResult.matchedPreferred.map(m => m.skill),
      missing_preferred: matchResult.missingPreferred.map(m => m.skill),
      penalties: calibrated.penalties,
      boosts: calibrated.boosts,
    })

    details[profile.entity] = {
      matchResult,
      calibrated,
    }
  }

  const massHiring = companyScores.filter(s => MASS_HIRING_PROFILES.some(p => p.entity === s.entity))
  const maang = companyScores.filter(s => MAANG_PROFILES.some(p => p.entity === s.entity))
  const ivyLeague = companyScores.filter(s => IVY_LEAGUE_PROFILES.some(p => p.entity === s.entity))

  return {
    normalizedResume: normalized,
    evidence,
    scores: {
      massHiring,
      maang,
      ivyLeague,
      all: companyScores,
    },
    details,
    summary: {
      avgMassHiring: Math.round(massHiring.reduce((s, c) => s + c.score, 0) / massHiring.length) || 0,
      avgMaang: Math.round(maang.reduce((s, c) => s + c.score, 0) / maang.length) || 0,
      avgIvyLeague: Math.round(ivyLeague.reduce((s, c) => s + c.score, 0) / ivyLeague.length) || 0,
    },
  }
}

/**
 * Get score for a specific entity
 */
export function getScoreForEntity(evaluationResult, entity) {
  return evaluationResult?.scores?.all?.find(s => s.entity === entity) || null
}
