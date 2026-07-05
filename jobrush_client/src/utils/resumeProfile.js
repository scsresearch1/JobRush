/** CS / IT employers used for resume improvement recommendations (excludes core engineering & hardware-only targets). */
export const CS_RECOMMENDATION_ENTITIES = new Set([
  'TCS', 'Infosys', 'Wipro', 'Cognizant', 'Accenture', 'Capgemini', 'HCL Tech', 'Tech Mahindra',
  'LTI Mindtree', 'Deloitte', 'EY', 'KPMG', 'IBM', 'Oracle', 'SAP', 'Adobe', 'OpenText',
  'Meta', 'Apple', 'Amazon', 'Netflix', 'Google',
])

export const CORE_ENTITY_GROUPS = {
  mechanical: new Set(['Tata Motors', 'Bosch']),
  civil: new Set(['Larsen & Toubro', 'Tata Projects']),
  ece: new Set(['Samsung', 'Texas Instruments', 'Qualcomm', 'Intel', 'NVIDIA', 'Cisco']),
  electrical: new Set(['BHEL', 'Tata Power']),
}

const PROFILE_LABELS = {
  cs: 'Computer Science / IT',
  mechanical: 'Mechanical Engineering',
  civil: 'Civil Engineering',
  ece: 'Electronics & Communication (ECE)',
  electrical: 'Electrical Engineering (EEE)',
}

export function getProfileLabel(profile) {
  return PROFILE_LABELS[profile] || PROFILE_LABELS.cs
}

export function detectResumeProfile(resume) {
  const blob = [
    ...(resume?.education || []).map((e) => `${e.degree || ''} ${e.institution || ''}`),
    ...(resume?.skills || []),
    ...(resume?.experience || []).map((e) => `${e.role || e.title || ''} ${e.company || ''}`),
    ...(resume?.projects || []).map((p) => `${p.name || ''} ${p.description || ''}`),
  ]
    .join(' ')
    .toLowerCase()

  if (/\b(mechanical|thermodynamics|manufacturing|automobile|machine design)\b/.test(blob)) return 'mechanical'
  if (/\b(civil|structural|construction|geotechnical|rcc|surveying)\b/.test(blob)) return 'civil'
  if (/\b(ece|electronics|embedded|vlsi|communication systems|semiconductor|pcb)\b/.test(blob)) return 'ece'
  if (/\b(eee|electrical|power systems|electrical machines|power plant)\b/.test(blob)) return 'electrical'
  if (
    /\b(computer science|cse|\bcs\b|information technology|\bit\b|mca|bca|software engineer|developer|programmer|java|python|javascript|react|full stack|backend|frontend|data structures|algorithms|machine learning)\b/.test(
      blob
    )
  ) {
    return 'cs'
  }
  return 'cs'
}

export function isInternshipRole(role) {
  const r = String(role || '').toLowerCase()
  if (/\bgraduate engineer trainee\b/.test(r)) return false
  return /\b(intern|internship|trainee|apprentice|summer analyst)\b/.test(r)
}

export function hasSubstantiveFullTimeExperience(resume) {
  for (const e of resume?.experience || []) {
    const role = String(e?.role || e?.title || '')
    const company = String(e?.company || '').trim()
    if (!company || isInternshipRole(role)) continue
    const desc = String(e?.description || '').trim()
    const bullets = Array.isArray(e?.responsibilities) ? e.responsibilities : []
    if (desc.length > 40 || bullets.length > 0) return true
  }
  return false
}

export function isFresherResume(resume) {
  return !hasSubstantiveFullTimeExperience(resume)
}

export function partitionExperience(resume) {
  const internships = []
  const fullTime = []
  for (const e of resume?.experience || []) {
    if (isInternshipRole(e?.role || e?.title || '')) internships.push(e)
    else fullTime.push(e)
  }
  return { internships, fullTime }
}

export function filterScoresForRecommendations(scores, profile) {
  const list = Array.isArray(scores) ? scores : []
  return list.filter((s) => {
    if (!s?.entity || s.type === 'university') return false
    if (profile === 'cs') return CS_RECOMMENDATION_ENTITIES.has(s.entity)
    const group = CORE_ENTITY_GROUPS[profile]
    if (group) return group.has(s.entity)
    return CS_RECOMMENDATION_ENTITIES.has(s.entity)
  })
}

/** Core / hardware employers that must not appear in CS improvement copy */
const CS_BLOCKED_EMPLOYERS =
  /\b(cisco|intel|nvidia|qualcomm|texas instruments|samsung|tata motors|bosch|bhel|larsen\s*&\s*toubro|l&t|tata projects|tata power)\b/gi

export function sanitizeRecommendationForProfile(rec, { fresher = false, profile = 'cs' } = {}) {
  if (!rec || typeof rec !== 'object') return rec
  const out = { ...rec }
  if (fresher && /^experience$/i.test(String(out.section || ''))) return null

  const scrub = (text) => {
    let s = String(text || '')
    if (profile === 'cs') {
      s = s.replace(CS_BLOCKED_EMPLOYERS, 'relevant IT employers')
    }
    if (fresher) {
      s = s.replace(/\b(create an experience section|add (a |an )?experience section|no experience section)\b/gi, 'strengthen projects')
      s = s.replace(/software engineer @ infosys[^.]*\./gi, '')
    }
    return s.trim()
  }

  for (const key of ['section', 'current', 'suggestion', 'where', 'example', 'evidence', 'valueAddition', 'targetEmployers']) {
    if (out[key]) out[key] = scrub(out[key])
  }
  if (!out.suggestion) return null
  return out
}
