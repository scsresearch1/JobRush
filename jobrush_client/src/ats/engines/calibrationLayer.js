/**
 * Score Calibration Layer
 * Penalties and boosts for deterministic score adjustment
 */

/**
 * Apply calibration rules to raw score
 * @param {Object} scoreBreakdown - From scoreCalculator
 * @param {Object} matchResult - From matchingEngine
 * @param {Object} evidence - From evidenceExtractor
 * @returns {Object} Calibrated score with penalties and boosts
 */
export function calibrateScore(scoreBreakdown, matchResult, evidence) {
  let score = scoreBreakdown.raw_score
  const penalties = []
  const boosts = []

  // Penalty: missing mandatory skill (-10 per missing)
  const missingMandatory = matchResult.missingMandatory?.length || 0
  if (missingMandatory > 0) {
    const penalty = Math.min(30, missingMandatory * 10)
    score -= penalty
    penalties.push(`Missing ${missingMandatory} mandatory skill(s): -${penalty} pts`)
  }

  // Penalty: low parser confidence
  const avgConfidence = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + Math.max(...e.occurrences.map(o => o.confidence)), 0) / evidence.length
    : 1
  if (avgConfidence < 0.7) {
    const penalty = 5
    score -= penalty
    penalties.push(`Low evidence confidence (<70%): -${penalty} pts`)
  }

  // Boost: repeated skill evidence
  const multiEvidence = evidence.filter(e => e.occurrences.length > 1)
  if (multiEvidence.length >= 2) {
    const boost = Math.min(5, multiEvidence.length * 2)
    score += boost
    boosts.push(`${multiEvidence.length} skills with multiple evidence: +${boost} pts`)
  }

  // Boost: project relevance
  if (scoreBreakdown.project_relevance >= 0.8) {
    const boost = 4
    score += boost
    boosts.push('Strong project relevance: +4 pts')
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))

  return {
    ...scoreBreakdown,
    calibrated_score: finalScore,
    penalties,
    boosts,
  }
}
