/**
 * ATS Evaluation Platform - Type Definitions
 * Deterministic, reproducible, explainable evaluation system
 */

/** @typedef {Object} ParsedResume
 * @property {string} name
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string[]} skills
 * @property {Array<{company: string, role: string, start_date?: string, end_date?: string, description?: string}>} experience
 * @property {Array<{degree: string, institution: string, year?: string}>} education
 * @property {Array<{name: string, description?: string, technologies?: string[]}>} projects
 */

/** @typedef {Object} SkillEvidence
 * @property {string} skill
 * @property {Array<{section: string, confidence: number, context?: string}>} occurrences
 */

/** @typedef {'exact'|'synonym'|'context'|'absent'} MatchType */

/** @typedef {Object} CompanyProfile
 * @property {string} entity
 * @property {string} type - 'company' | 'university'
 * @property {string[]} mandatory_skills
 * @property {string[]} preferred_skills
 * @property {string[]} education
 * @property {Object} weights
 */

/** @typedef {Object} MatchResult
 * @property {string} skill
 * @property {MatchType} matchType
 * @property {number} confidence
 * @property {string} [evidenceSection]
 */

/** @typedef {Object} ScoreBreakdown
 * @property {number} mandatory_skill_score
 * @property {number} preferred_skill_score
 * @property {number} project_relevance
 * @property {number} education_match
 * @property {number} formatting_score
 * @property {number} raw_score
 * @property {number} calibrated_score
 * @property {string[]} penalties
 * @property {string[]} boosts
 */

export const SECTION_STANDARD = {
  SKILLS: 'skills',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  PROJECTS: 'projects',
}
