/**
 * DOCX Resume Parser
 * Extracts text via mammoth and parses into structured resume format
 */

import mammoth from 'mammoth'

// Longer phrases first for regex alternation
const SECTION_HEADERS = [
  'work experience', 'professional experience', 'work history', 'experience', 'employment',
  'technical skills', 'core competencies', 'skills', 'expertise',
  'academic projects', 'personal projects', 'projects',
  'education', 'academic', 'qualifications',
  'summary', 'objective', 'profile',
  'certifications', 'certificates',
]

const SECTION_REGEX = new RegExp(
  `\\n\\s*(${SECTION_HEADERS.join('|')})\\s*[\\:\\-]?\\s*\\n`,
  'gi'
)

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}(?:[-.\s]?\d+)?/

/**
 * Parse DOCX file to structured resume
 * @param {ArrayBuffer} arrayBuffer - DOCX file content
 * @returns {Promise<Object>} Parsed resume in ATS format
 */
export async function parseDocxResume(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result?.value || ''
  if (!text.trim()) return null

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const sections = splitIntoSections(text)
  const profile = extractProfile(lines, text)
  const experience = extractExperience(sections.experience || sections['work experience'] || '')
  const education = extractEducation(sections.education || '')
  const skills = extractSkills(sections.skills || sections['technical skills'] || '', text)
  const projects = extractProjects(sections.projects || sections['academic projects'] || '')

  return {
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    skills,
    experience,
    education,
    projects,
  }
}

function splitIntoSections(text) {
  const sections = {}
  const headerPattern = new RegExp(`\\n\\s*(${SECTION_HEADERS.join('|')})\\s*[\\:\\-]?\\s*`, 'gi')
  let match
  let lastIndex = 0
  let lastHeader = null
  while ((match = headerPattern.exec(text)) !== null) {
    if (lastHeader) {
      const content = text.slice(lastIndex, match.index).trim()
      sections[lastHeader] = (sections[lastHeader] || '') + '\n\n' + content
    }
    lastHeader = match[1].toLowerCase()
    lastIndex = match.index + match[0].length
  }
  if (lastHeader) {
    sections[lastHeader] = (sections[lastHeader] || '') + '\n\n' + text.slice(lastIndex).trim()
  }
  return sections
}

function extractProfile(lines, text) {
  const email = text.match(EMAIL_REGEX)?.[0] || ''
  const phone = text.match(PHONE_REGEX)?.[0] || ''
  let name = ''
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]
    if (line.length > 2 && line.length < 80 && !EMAIL_REGEX.test(line) && !PHONE_REGEX.test(line)) {
      if (!/^(experience|education|skills|summary|objective|projects)/i.test(line)) {
        name = line
        break
      }
    }
  }
  return { name, email, phone }
}

function extractExperience(text) {
  if (!text.trim()) return []
  const entries = []
  const blocks = text.split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (lines.length < 2) continue
    const first = lines[0]
    const dateMatch = first.match(/(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)/i)
    const dateStr = dateMatch ? dateMatch[0] : ''
    let company = ''
    let role = ''
    if (dateMatch) {
      const before = first.substring(0, dateMatch.index).trim()
      const parts = before.split(/[|•\-–—]/).map((p) => p.trim()).filter(Boolean)
      role = parts[0] || ''
      company = parts[1] || parts[0] || ''
    } else {
      role = first
      company = lines[1] || ''
    }
    const description = lines.slice(2).join('\n')
    if (role || company) {
      entries.push({ company, role, title: role, duration: dateStr, description })
    }
  }
  return entries
}

function extractEducation(text) {
  if (!text.trim()) return []
  const entries = []
  const blocks = text.split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (lines.length < 1) continue
    const first = lines[0]
    const yearMatch = first.match(/\b(19|20)\d{2}\b/)
    const degree = yearMatch ? first.substring(0, yearMatch.index).trim() : first
    const institution = lines[1] || ''
    const year = yearMatch ? yearMatch[0] : ''
    if (degree) {
      entries.push({ degree, institution, year })
    }
  }
  return entries
}

function extractSkills(sectionText, fullText) {
  const skills = new Set()
  const text = sectionText || fullText
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'SQL',
    'Git', 'Agile', 'Machine Learning', 'Data Structures', 'Algorithms',
    'AWS', 'MongoDB', 'PostgreSQL', 'REST', 'GraphQL', 'Docker', 'Kubernetes',
  ]
  const lower = text.toLowerCase()
  for (const skill of commonSkills) {
    if (lower.includes(skill.toLowerCase())) skills.add(skill)
  }
  const commaParts = text.split(/[,;|•\n]/).map((p) => p.trim()).filter((p) => p.length > 1 && p.length < 35 && !p.endsWith('.'))
  commaParts.forEach((p) => skills.add(p))
  return [...skills]
}

function extractProjects(text) {
  if (!text.trim()) return []
  const entries = []
  const blocks = text.split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean)
    if (lines.length < 1) continue
    const name = lines[0]
    const description = lines.slice(1).join('\n')
    if (name) {
      entries.push({ name, description, technologies: [] })
    }
  }
  return entries
}
