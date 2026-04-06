/**
 * Section Normalization - Maps inconsistent resume section titles to standard categories
 * Deterministic mapping for reproducible parsing
 */

import { SECTION_STANDARD } from '../types.js'

export const SECTION_MAPPINGS = {
  // Skills variants
  'technical skills': SECTION_STANDARD.SKILLS,
  'core competencies': SECTION_STANDARD.SKILLS,
  'skills': SECTION_STANDARD.SKILLS,
  'key skills': SECTION_STANDARD.SKILLS,
  'technical competencies': SECTION_STANDARD.SKILLS,
  'expertise': SECTION_STANDARD.SKILLS,
  'technologies': SECTION_STANDARD.SKILLS,

  // Experience variants
  'professional experience': SECTION_STANDARD.EXPERIENCE,
  'work experience': SECTION_STANDARD.EXPERIENCE,
  'experience': SECTION_STANDARD.EXPERIENCE,
  'employment': SECTION_STANDARD.EXPERIENCE,
  'career': SECTION_STANDARD.EXPERIENCE,
  'work history': SECTION_STANDARD.EXPERIENCE,

  // Education variants
  'education': SECTION_STANDARD.EDUCATION,
  'academic': SECTION_STANDARD.EDUCATION,
  'qualifications': SECTION_STANDARD.EDUCATION,
  'academic background': SECTION_STANDARD.EDUCATION,

  // Projects variants
  'projects': SECTION_STANDARD.PROJECTS,
  'academic projects': SECTION_STANDARD.PROJECTS,
  'personal projects': SECTION_STANDARD.PROJECTS,
  'key projects': SECTION_STANDARD.PROJECTS,
}

export function normalizeSectionTitle(title) {
  if (!title || typeof title !== 'string') return null
  const normalized = title.toLowerCase().trim()
  return SECTION_MAPPINGS[normalized] || null
}
