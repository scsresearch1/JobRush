/**
 * Groq LLM service - explanations and recommendations
 * Calls server API (requires API server running with GROQ_API_KEY)
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

async function fetchApi(path, body) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error('API server unreachable. Run "npm run server" in a separate terminal and add GROQ_API_KEY to .env')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error || `API error: ${res.status}`
    if (res.status === 404) {
      throw new Error('API server not found. Run "npm run server" in a separate terminal, or use "npm run dev:full" to run both.')
    }
    if (res.status === 500 && msg.includes('GROQ_API_KEY')) {
      throw new Error('Groq API key not configured. Add GROQ_API_KEY to your .env file.')
    }
    if (res.status === 500) {
      throw new Error(msg + ' (Ensure API server is running: npm run server)')
    }
    throw new Error(msg)
  }
  return res.json()
}

/**
 * Get AI explanation for an entity's ATS score
 * @param {Object} params
 * @returns {Promise<{ explanation: string }>}
 */
export async function getExplainAts(params) {
  const { entity, score, matchedMandatory, missingMandatory, matchedPreferred, missingPreferred, breakdown } = params
  return fetchApi('/api/explain-ats', {
    entity,
    score,
    matchedMandatory: matchedMandatory || [],
    missingMandatory: missingMandatory || [],
    matchedPreferred: matchedPreferred || [],
    missingPreferred: missingPreferred || [],
    breakdown: breakdown || {},
  })
}

/**
 * Get AI resume improvement recommendations
 * @param {Object} resume - Parsed resume
 * @param {Object} evaluation - ATS evaluation result
 * @returns {Promise<{ recommendations: Array<{ section, current, suggestion, impact }> }>}
 */
export async function getRecommendations(resume, evaluation) {
  return fetchApi('/api/recommendations', { resume, evaluation })
}

/**
 * Apply a single AI correction to the resume
 * @param {Object} resume - Current parsed resume
 * @param {Object} recommendation - { section, current, suggestion, impact }
 * @returns {Promise<{ resume: Object }>} Modified resume
 */
export async function applyCorrection(resume, recommendation) {
  return fetchApi('/api/apply-correction', { resume, recommendation })
}

/**
 * Generate Statement of Purpose for university applications
 * @param {Object} resume - Parsed resume
 * @param {string} targetProgram - Target program/degree
 * @param {string} targetUniversity - Target university
 * @returns {Promise<{ content: string }>}
 */
export async function generateSOP(resume, targetProgram, targetUniversity) {
  return fetchApi('/api/generate-sop', { resume, targetProgram, targetUniversity })
}

/**
 * Generate cover letter for job applications
 * @param {Object} resume - Parsed resume
 * @param {string} targetRole - Target job role
 * @param {string} targetCompany - Target company
 * @returns {Promise<{ content: string }>}
 */
export async function generateCoverLetter(resume, targetRole, targetCompany) {
  return fetchApi('/api/generate-cover-letter', { resume, targetRole, targetCompany })
}

/**
 * Get LLM-generated interview correction recommendations from behavioral report
 * @param {Object} report - Behavioral report (overall + questionTimelines)
 * @returns {Promise<{ recommendations: Array<{ tip, area, priority }> }>}
 */
export async function getInterviewRecommendations(report) {
  return fetchApi('/api/interview-recommendations', { report })
}
