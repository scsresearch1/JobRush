/**
 * Single source for parsed resume JSON shared across ATS, Mock Interview, etc.
 * Parsed once on Resume Upload and reused until replaced by a new upload + parse.
 */

export const PARSED_RESUME_STORAGE_KEY = 'jobRush_parsed_resume'

function hasMeaningfulParsedFields(parsed) {
  return Boolean(
    parsed &&
      (parsed.name || (parsed.skills?.length ?? 0) > 0 || (parsed.experience?.length ?? 0) > 0)
  )
}

/** @returns {object | null} Parsed resume object or null if missing / invalid */
export function readStoredParsedResume() {
  try {
    const stored = localStorage.getItem(PARSED_RESUME_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return hasMeaningfulParsedFields(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** @param {object} parsed */
export function writeStoredParsedResume(parsed) {
  localStorage.setItem(PARSED_RESUME_STORAGE_KEY, JSON.stringify(parsed))
}

export function clearStoredParsedResume() {
  localStorage.removeItem(PARSED_RESUME_STORAGE_KEY)
}
