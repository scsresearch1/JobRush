/**
 * Weighted ATS Score Calculator
 * Deterministic formula: (mandatory×W1) + (preferred×W2) + (projects×W3) + (education×W4) + (formatting×W5)
 */

/**
 * Calculate raw ATS score from match results and resume
 * @param {Object} matchResult - From matchingEngine
 * @param {Object} resume - Normalized resume
 * @param {Object} profile - Company profile with weights
 * @returns {Object} Score breakdown
 */
export function calculateWeightedScore(matchResult, resume, profile) {
  const weights = profile.weights || {
    mandatory: 0.40,
    preferred: 0.20,
    projects: 0.20,
    education: 0.10,
    formatting: 0.10,
  }

  const mandatoryTotal = matchResult.mandatory.length
  const mandatoryMatched = matchResult.matchedMandatory.length
  const mandatoryScore = mandatoryTotal > 0 ? (mandatoryMatched / mandatoryTotal) * 100 : 100

  const preferredTotal = matchResult.preferred.length
  const preferredMatched = matchResult.matchedPreferred.length
  const preferredScore = preferredTotal > 0 ? (preferredMatched / preferredTotal) * 100 : 100

  const projectScore = calculateProjectRelevance(resume, profile)
  const educationScore = calculateEducationMatch(resume, profile)
  const formattingScore = calculateFormattingScore(resume)

  // mandatoryScore & preferredScore are 0-100; project/education/formatting are 0-1
  const rawScore =
    mandatoryScore * weights.mandatory +
    preferredScore * weights.preferred +
    projectScore * weights.projects * 100 +
    educationScore * weights.education * 100 +
    formattingScore * weights.formatting * 100

  return {
    mandatory_skill_score: Math.round(mandatoryScore * 100) / 100,
    preferred_skill_score: Math.round(preferredScore * 100) / 100,
    project_relevance: Math.round(projectScore * 100) / 100,
    education_match: Math.round(educationScore * 100) / 100,
    formatting_score: Math.round(formattingScore * 100) / 100,
    raw_score: Math.round(rawScore * 100) / 100,
    weights,
  }
}

function calculateProjectRelevance(resume, profile) {
  const projects = resume.projects || []
  if (projects.length === 0) return 0.5
  const requiredSkills = [...(profile.mandatory_skills || []), ...(profile.preferred_skills || [])]
  const projectText = projects.map(p => [p.name, p.description, (p.technologies || []).join(' ')].join(' ')).join(' ')
  const lower = projectText.toLowerCase()
  const matches = requiredSkills.filter(s => lower.includes(s.toLowerCase())).length
  return Math.min(1, 0.5 + (matches / Math.max(1, requiredSkills.length)) * 0.5)
}

function calculateEducationMatch(resume, profile) {
  const education = resume.education || []
  const accepted = education.map(e => (e.degree || '').toLowerCase())
  const profileEdu = (profile.education || []).map(e => e.toLowerCase())
  for (const deg of accepted) {
    if (profileEdu.some(p => deg.includes(p) || p.includes(deg))) return 1
  }
  return education.length > 0 ? 0.5 : 0
}

function calculateFormattingScore(resume) {
  let score = 0.8
  if (resume.skills?.length > 0) score += 0.05
  if (resume.experience?.length > 0) score += 0.05
  if (resume.education?.length > 0) score += 0.05
  if (resume.projects?.length > 0) score += 0.05
  return Math.min(1, score)
}
