/**
 * Evidence Extraction Layer
 * For each skill detected, record where it appears with confidence
 */

import { canonicalizeSkill } from '../config/skillCanonicalization.js'

/**
 * Extract skill evidence from normalized resume
 * @param {Object} resume - Normalized resume
 * @returns {Array<{skill: string, occurrences: Array<{section: string, confidence: number}>}>}
 */
export function extractEvidence(resume) {
  if (!resume) return []

  const evidenceMap = new Map()

  const addEvidence = (skill, section, confidence) => {
    const canonical = canonicalizeSkill(skill) || skill
    const key = canonical.toLowerCase()
    if (!evidenceMap.has(key)) {
      evidenceMap.set(key, { skill: canonical, occurrences: [], maxConfidence: 0 })
    }
    const entry = evidenceMap.get(key)
    const existing = entry.occurrences.find(o => o.section === section)
    if (!existing) {
      entry.occurrences.push({ section, confidence })
      entry.maxConfidence = Math.max(entry.maxConfidence, confidence)
    } else if (confidence > existing.confidence) {
      existing.confidence = confidence
      entry.maxConfidence = Math.max(entry.maxConfidence, confidence)
    }
  }

  // Skills section - highest confidence
  ;(resume.skills || []).forEach(s => addEvidence(s, 'skills', 0.95))

  // Experience - medium-high
  ;(resume.experience || []).forEach(exp => {
    const text = [exp.role, exp.description].filter(Boolean).join(' ')
    extractSkillsFromText(text).forEach(s => addEvidence(s, 'experience', 0.85))
  })

  // Projects - medium
  ;(resume.projects || []).forEach(proj => {
    const text = [proj.name, proj.description, (proj.technologies || []).join(' ')].filter(Boolean).join(' ')
    extractSkillsFromText(text).forEach(s => addEvidence(s, 'projects', 0.75))
  })

  return Array.from(evidenceMap.values()).map(({ skill, occurrences }) => ({ skill, occurrences }))
}

const SKILL_PATTERNS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Git', 'Agile', 'Scrum',
  'Data Structures', 'Algorithms', 'Machine Learning', 'AWS', 'Docker', 'Kubernetes', 'MongoDB',
  'PostgreSQL', 'C++', 'C#', 'Go', 'Ruby', 'PHP', 'Django', 'Flask', 'Express', 'Redux',
  'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Excel', 'REST API', 'Cloud', 'Linux',
]

function extractSkillsFromText(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter(s => lower.includes(s.toLowerCase()))
}
