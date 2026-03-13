/**
 * LLM service - explanations and recommendations
 * Calls server API (requires API server running)
 */

const API_BASE = import.meta.env.VITE_API_URL || ''
const FETCH_TIMEOUT_MS = 120000 // 120s (Render cold start ~60-90s + LLM ~20s)

function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out. The server may be waking up—try again in a moment.')), ms)
  )
}

async function fetchApi(path, body) {
  const url = `${API_BASE}${path}`
  console.log('[JobRush API]', { url, path, apiBase: API_BASE || '(empty)' })
  if (!API_BASE && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    console.error('[JobRush API] VITE_API_URL not set in production')
    throw new Error('API URL not configured. Add VITE_API_URL in Netlify build environment variables.')
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
  let res
  try {
    res = await Promise.race([fetchPromise, timeoutPromise(FETCH_TIMEOUT_MS + 10000)])
    console.log('[JobRush API] Response', { path, status: res?.status, ok: res?.ok })
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[JobRush API] Fetch error', { path, name: err.name, message: err.message, stack: err.stack })
    if (err.message?.includes('timed out')) throw err
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The server may be waking up—try again in a moment.')
    }
    const hint = !API_BASE && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? ' Set VITE_API_URL in Netlify environment variables.'
      : ''
    throw new Error('API server unreachable.' + hint)
  }
  clearTimeout(timeoutId)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error || `API error: ${res.status}`
    console.error('[JobRush API] HTTP error', { path, status: res.status, body: err })
    if (res.status === 404) {
      throw new Error('API server not found. Run "npm run server" in a separate terminal, or use "npm run dev:full" to run both.')
    }
    if (res.status === 500 && msg.includes('not configured')) {
      throw new Error('AI service not configured. Add the required API key to your environment.')
    }
    if (res.status === 500) {
      throw new Error(msg + ' (Ensure API server is running: npm run server)')
    }
    throw new Error(msg)
  }
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    console.log('[JobRush API] Success', { path })
    return data
  } catch (parseErr) {
    console.error('[JobRush API] JSON parse error', { path, preview: text?.slice(0, 200), parseErr: parseErr.message })
    throw new Error('Invalid response from API. Ensure VITE_API_URL points to your Render backend.')
  }
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
