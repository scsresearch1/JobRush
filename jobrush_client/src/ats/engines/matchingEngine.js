/**
 * Deterministic Matching Engine
 * Compares resume features with requirement profiles
 * Match types: exact, synonym, context, absent
 */

import { canonicalizeSkill } from '../config/skillCanonicalization.js'

/**
 * Match resume against a company/university profile
 * @param {Object} evidence - Evidence from extractEvidence
 * @param {Object} profile - Company/university profile
 * @returns {Object} Match results with matched/missing skills
 */
export function matchResumeToProfile(evidence, profile) {
  const mandatorySkills = profile.mandatory_skills || []
  const preferredSkills = profile.preferred_skills || []

  const evidenceSkills = new Map()
  evidence.forEach(e => {
    evidenceSkills.set(e.skill.toLowerCase(), e)
    e.occurrences.forEach(occ => {
      const key = e.skill.toLowerCase()
      if (!evidenceSkills.has(key) || occ.confidence > evidenceSkills.get(key).maxConfidence) {
        evidenceSkills.set(key, { ...e, maxConfidence: occ.confidence })
      }
    })
  })

  const normalizeForMatch = (s) => canonicalizeSkill(s)?.toLowerCase() || s.toLowerCase()

  const mandatoryResults = mandatorySkills.map(req => {
    const reqNorm = normalizeForMatch(req)
    for (const [skill, ev] of evidenceSkills) {
      if (skill === reqNorm || skill.includes(reqNorm) || reqNorm.includes(skill)) {
        return { skill: req, matchType: 'exact', confidence: ev.maxConfidence || 0.9, present: true }
      }
    }
    return { skill: req, matchType: 'absent', confidence: 0, present: false }
  })

  const preferredResults = preferredSkills.map(req => {
    const reqNorm = normalizeForMatch(req)
    for (const [skill, ev] of evidenceSkills) {
      if (skill === reqNorm || skill.includes(reqNorm) || reqNorm.includes(skill)) {
        return { skill: req, matchType: 'exact', confidence: ev.maxConfidence || 0.8, present: true }
      }
    }
    return { skill: req, matchType: 'absent', confidence: 0, present: false }
  })

  return {
    mandatory: mandatoryResults,
    preferred: preferredResults,
    matchedMandatory: mandatoryResults.filter(r => r.present),
    missingMandatory: mandatoryResults.filter(r => !r.present),
    matchedPreferred: preferredResults.filter(r => r.present),
    missingPreferred: preferredResults.filter(r => !r.present),
  }
}
