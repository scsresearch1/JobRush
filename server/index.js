/**
 * JobRush API - LLM for ATS explanations and recommendations
 * Run: node server/index.js (requires API key in env)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
config({ path: resolve(process.cwd(), '.env') })
import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'
import { Resend } from 'resend'
import {
  detectResumeProfile,
  isFresherResume,
  partitionExperience,
  filterScoresForRecommendations,
  getProfileLabel,
  CS_RECOMMENDATION_ENTITIES,
  sanitizeRecommendationForProfile,
} from '../jobrush_client/src/utils/resumeProfile.js'

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException', err?.stack || err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection', reason)
})

const app = express()

/** Browser origins allowed to call this API (no wildcard). */
const ALLOWED_ORIGINS = new Set([
  'https://jbrush.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
])

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  try {
    const u = new URL(origin)
    return u.hostname.endsWith('.netlify.app')
  } catch {
    return false
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (isAllowedOrigin(origin)) return callback(null, true)
      callback(null, false)
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

app.use(express.json({ limit: '4mb' }))

app.use((req, res, next) => {
  const requestId = randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  const t0 = Date.now()
  res.on('finish', () => {
    const path = req.originalUrl?.split('?')[0] || req.url
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        ms: Date.now() - t0,
      })
    )
  })
  next()
})

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

/** Default: smaller/faster model to stay within Groq free-tier limits. Set GROQ_MODEL to override. */
const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim()

const MAX_CHAT_TURNS = 8
const MAX_CHAT_MSG_CHARS = 8000
/** Groq completion ceiling for this app (avoid mid-stream cuts; models typically allow ≤ 8k). */
const GROQ_MAX_COMPLETION_TOKENS = 8192
const TOKENS_EXPLAIN_ATS = 2048
/** Groq free tier TPM ~6000 — keep input + max_tokens under ~5500 */
const GROQ_TPM_SAFE_BUDGET = 5500
const TOKENS_RECOMMENDATIONS = 2048
const TOKENS_RECOMMENDATIONS_BATCH = 1536
const LLM_BATCH_DELAY_MS = 2200
const TOKENS_SOP = 2048
const TOKENS_COVER_LETTER = 2048
const TOKENS_INTERVIEW_TIPS = 2048
const TOKENS_CHAT_REPLY = 2048
/** Groq SDK call ceiling (ms). Large resume JSON routes need headroom; override with GROQ_SDK_TIMEOUT_MS. */
const GROQ_SDK_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.GROQ_SDK_TIMEOUT_MS) || 120_000, 15_000),
  300_000
)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const ADMIN_API_SECRET = String(process.env.ADMIN_API_SECRET || '').trim()

function cleanEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
}

/** Inbox for “new user / payment request” alerts — set ADMIN_NOTIFY_EMAIL on the API host (Render, etc.). */
const ADMIN_NOTIFY_EMAIL = cleanEmail(process.env.ADMIN_NOTIFY_EMAIL || 'hirefortune90@gmail.com')

const MAIL_FROM_NEW_USER = 'JobRush Onboarding Team <newuser@fortunehire.in>'
const MAIL_FROM_WELCOME = 'JobRush Access Team <welcome@fortunehire.in>'
const MAIL_FROM_REPORTS = 'JobRush Reports Desk <reports@fortunehire.in>'
const MAIL_REPLY_TO = 'info@fortunehire.in'
/** Shown in payment-approval emails so users can return to the live app. */
const JOB_RUSH_APP_URL = 'https://jbrush.netlify.app/'

function requireAdminSecret(req, res, next) {
  if (!ADMIN_API_SECRET) {
    return res.status(500).json({ error: 'ADMIN_API_SECRET is missing on the API server.' })
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== ADMIN_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized admin request.' })
  }
  next()
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** User-facing activation line in emails (avoids raw ISO strings in Gmail). */
function formatActivationForEmail(iso) {
  const s = String(iso || '').trim()
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s || '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(t))
  } catch {
    return s
  }
}

async function sendResendMail({ from, to, subject, html, text, replyTo }) {
  if (!resend) throw new Error('Email service not configured. Add RESEND_API_KEY.')
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  }
  if (replyTo) payload.reply_to = replyTo
  let lastErr
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await resend.emails.send(payload)
      if (out?.error) throw new Error(out.error.message || 'Resend rejected the email request.')
      return out?.data?.id || null
    } catch (e) {
      lastErr = e
      console.error(
        JSON.stringify({
          level: 'warn',
          msg: 'Resend send failed',
          attempt,
          error: e?.message || String(e),
        })
      )
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw lastErr
}

async function groqCompleteMessages(messages, maxTokens, model, temperature) {
  if (!groq) {
    throw new Error('AI service not configured. Add the required API key to your environment.')
  }
  const createPromise = groq.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  })
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Groq request timed out after ${GROQ_SDK_TIMEOUT_MS}ms`)),
      GROQ_SDK_TIMEOUT_MS
    )
  })
  let completion
  try {
    completion = await Promise.race([createPromise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
  const ch = completion.choices[0]
  return {
    content: String(ch?.message?.content ?? '').trim(),
    finishReason: ch?.finish_reason || 'unknown',
  }
}

/**
 * If output still ends because of max_tokens, remove the partial tail: prefer dropping the last line;
 * for a single block, trim to the last full sentence; never return a visibly cut-off fragment.
 */
function removeTruncatedSuffix(text) {
  if (!text) return text
  const lines = text.split('\n')
  const nonEmptyLineIndexes = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) nonEmptyLineIndexes.push(i)
  }
  if (nonEmptyLineIndexes.length >= 2) {
    const dropAt = nonEmptyLineIndexes[nonEmptyLineIndexes.length - 1]
    const out = lines.filter((_, i) => i !== dropAt)
    return out.join('\n').trimEnd()
  }
  const t = text.trim()
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i]
    if (c === '.' || c === '!' || c === '?') {
      const before = t.slice(0, i + 1).trim()
      if (before.length >= 24) return before
    }
  }
  return ''
}

/**
 * @param {{ stripPartialTail?: boolean }} opts - If true (default), strip incomplete last line/sentence when still truncated after retry. Set false for JSON outputs.
 */
async function groqComplete(messages, maxTokens, model, temperature, opts = {}) {
  const stripPartialTail = opts.stripPartialTail !== false
  const noTokenBump = opts.noTokenBump === true
  let { content, finishReason } = await groqCompleteMessages(messages, maxTokens, model, temperature)
  if (
    !noTokenBump &&
    finishReason === 'length' &&
    maxTokens < GROQ_MAX_COMPLETION_TOKENS
  ) {
    const bumped = Math.min(Math.max(maxTokens * 2, maxTokens + 1024), GROQ_MAX_COMPLETION_TOKENS)
    if (bumped > maxTokens) {
      const second = await groqCompleteMessages(messages, bumped, model, temperature)
      content = second.content
      finishReason = second.finishReason
    }
  }
  if (stripPartialTail && finishReason === 'length') {
    content = removeTruncatedSuffix(content)
  }
  return { content, finishReason }
}

function estimateGroqTokens(text) {
  return Math.ceil(String(text || '').length / 3.5)
}

function fitPromptToGroqBudget(systemPrompt, userPrompt, maxCompletionTokens) {
  const budget = GROQ_TPM_SAFE_BUDGET - maxCompletionTokens - 96
  let sys = String(systemPrompt || '')
  let usr = String(userPrompt || '')
  while (estimateGroqTokens(sys) + estimateGroqTokens(usr) > budget && usr.length > 400) {
    usr = usr.slice(0, Math.floor(usr.length * 0.82))
  }
  return { systemPrompt: sys, userPrompt: usr }
}

function isGroqQuotaError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('rate_limit') ||
    msg.includes('tokens per minute') ||
    msg.includes('request too large') ||
    msg.includes('413') ||
    msg.includes('tpm') ||
    msg.includes('quota')
  )
}

async function callGroq(systemPrompt, userPrompt, maxTokens = TOKENS_EXPLAIN_ATS, model = GROQ_MODEL, jsonOutput = false, groqOpts = {}) {
  const { content } = await groqComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens,
    model,
    0.25,
    { stripPartialTail: !jsonOutput, ...groqOpts }
  )
  return content
}

async function chatGroq(messages, maxTokens = TOKENS_CHAT_REPLY, model = GROQ_MODEL) {
  const { content } = await groqComplete(messages, maxTokens, model, 0.4, { stripPartialTail: true })
  return content
}

/** Parse a JSON array from model output; if truncated, drop incomplete trailing objects only (never return half an object). */
function parseJsonArraySalvage(raw) {
  if (!raw || typeof raw !== 'string') return []
  const start = raw.indexOf('[')
  if (start === -1) return []
  const s = raw.slice(start)
  const endBracket = s.lastIndexOf(']')
  if (endBracket !== -1) {
    try {
      return JSON.parse(s.slice(0, endBracket + 1))
    } catch {
      /* fall through */
    }
  }
  let i = s.lastIndexOf('}')
  while (i > 1) {
    try {
      return JSON.parse(`${s.slice(0, i + 1)}]`)
    } catch {
      i = s.lastIndexOf('}', i - 1)
    }
  }
  return []
}

function titleCaseWord(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase())
}

function toTitle(input) {
  const s = String(input || '').replace(/[_-]+/g, ' ').trim()
  if (!s) return ''
  return titleCaseWord(s)
}

function uniqueStrings(items, limit = 12) {
  const out = []
  const seen = new Set()
  for (const item of items || []) {
    const v = String(item || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

function collectMissingSkills(scores) {
  const freq = new Map()
  for (const s of scores || []) {
    for (const skill of s?.missing_mandatory || []) {
      const key = String(skill || '').trim().toLowerCase()
      if (!key) continue
      freq.set(key, (freq.get(key) || 0) + 2)
    }
    for (const skill of s?.missing_preferred || []) {
      const key = String(skill || '').trim().toLowerCase()
      if (!key) continue
      freq.set(key, (freq.get(key) || 0) + 1)
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k)
}

function collectMissingSkillsFromFiltered(scores, profile) {
  return collectMissingSkills(filterScoresForRecommendations(scores, profile))
}

function collectWeakDimensions(scores) {
  const dims = [
    { key: 'mandatory_skill_score', label: 'mandatory skills', badBelow: 70 },
    { key: 'preferred_skill_score', label: 'preferred skills', badBelow: 65 },
    { key: 'project_relevance', label: 'project relevance', badBelow: 65 },
    { key: 'education_match', label: 'education relevance', badBelow: 65 },
    { key: 'formatting_score', label: 'resume formatting', badBelow: 75 },
  ]
  const out = []
  for (const d of dims) {
    let sum = 0
    let n = 0
    for (const s of scores || []) {
      const v = Number(s?.breakdown?.[d.key])
      if (Number.isFinite(v)) {
        sum += v
        n += 1
      }
    }
    if (!n) continue
    const avg = Math.round(sum / n)
    if (avg < d.badBelow) out.push(`${d.label} (${avg}%)`)
  }
  return out.slice(0, 4)
}

function collectLowScoreEntities(scores, limit = 5) {
  return [...(scores || [])]
    .filter((s) => s && typeof s === 'object' && s.entity)
    .sort((a, b) => Number(a?.score || 0) - Number(b?.score || 0))
    .slice(0, limit)
    .map((s) => `${s.entity} (${s.score}%)`)
}

function collectLowScoreEntitiesForProfile(scores, profile, limit = 8) {
  return collectLowScoreEntities(filterScoresForRecommendations(scores, profile), limit)
}

function extractBullets(entry, max = 6) {
  if (Array.isArray(entry?.responsibilities)) {
    return entry.responsibilities.map((b) => String(b).trim()).filter(Boolean).slice(0, max)
  }
  if (Array.isArray(entry?.highlights)) {
    return entry.highlights.map((b) => String(b).trim()).filter(Boolean).slice(0, max)
  }
  const desc = String(entry?.description || '').trim()
  if (!desc) return []
  return desc
    .split(/\n|•|·|;/)
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function buildResumeDeepContext(resume, evaluation) {
  const profile = detectResumeProfile(resume)
  const fresher = isFresherResume(resume)
  const { internships, fullTime } = partitionExperience(resume)
  const relevantScores = filterScoresForRecommendations(evaluation?.scores?.all || [], profile)

  const formatRoleBlock = (entries, label) =>
    entries
      .slice(0, 5)
      .map((e) => {
        const role = e.role || e.title || label
        const company = e.company || 'Organization'
        const duration = e.duration ? ` (${e.duration})` : ''
        const bullets = extractBullets(e, 5)
        const bulletBlock = bullets.length
          ? bullets.map((b) => `    • "${b.slice(0, 220)}"`).join('\n')
          : `    • "${String(e.description || '').slice(0, 220) || '(no detail parsed)'}"`
        return `  ${role} @ ${company}${duration}\n${bulletBlock}`
      })
      .join('\n')

  const projectLines = (resume?.projects || []).slice(0, 6).map((p) => {
    const bullets = extractBullets(p, 4)
    const bulletBlock = bullets.length
      ? bullets.map((b) => `    • "${b.slice(0, 220)}"`).join('\n')
      : `    • "${String(p.description || '').slice(0, 220)}"`
    return `  ${p.name || 'Unnamed project'}\n${bulletBlock}`
  })

  const achievementLines = []
  const achievementNeedle = /\b(hackathon|winner|rank|award|certificate|certified|published|gpa|cgpa|merit|olympiad|competition|1st|2nd|3rd|top)\b/i
  for (const p of resume?.projects || []) {
    for (const b of extractBullets(p, 6)) {
      if (achievementNeedle.test(b)) achievementLines.push(`Project "${p.name}": ${b.slice(0, 180)}`)
    }
  }
  for (const e of resume?.education || []) {
    const line = `${e.degree || ''} ${e.institution || ''} ${e.year || ''}`
    if (achievementNeedle.test(line)) achievementLines.push(line.trim())
  }

  const entityGaps = [...relevantScores]
    .sort((a, b) => Number(a?.score || 0) - Number(b?.score || 0))
    .slice(0, 12)
    .map((s) => {
      const missM = (s.missing_mandatory || []).slice(0, 8).map(toTitle).join(', ') || 'none'
      const missP = (s.missing_preferred || []).slice(0, 5).map(toTitle).join(', ') || 'none'
      const matchM = (s.matched_mandatory || []).slice(0, 5).map(toTitle).join(', ') || 'none'
      const b = s.breakdown || {}
      return `  ${s.entity} — score ${s.score}% | mandatory skills ${Math.round(b.mandatory_skill_score || 0)}% | project relevance ${Math.round((b.project_relevance || 0) * 100)}% | missing mandatory: ${missM} | missing preferred: ${missP} | matched: ${matchM}`
    })

  const weakProjectBullets = []
  for (const p of resume?.projects || []) {
    for (const b of extractBullets(p, 3)) {
      if (b.length < 50 || !/\d|%|user|accuracy|improv|reduc|built|develop|deploy/i.test(b)) {
        weakProjectBullets.push(`"${b.slice(0, 160)}" (project: ${p.name})`)
      }
    }
  }

  const targetEmployers =
    profile === 'cs'
      ? [...CS_RECOMMENDATION_ENTITIES].slice(0, 18).join(', ')
      : collectLowScoreEntitiesForProfile(evaluation?.scores?.all || [], profile, 10).join(', ')

  return {
    profile,
    profileLabel: getProfileLabel(profile),
    fresher,
    internshipsBlock: formatRoleBlock(internships, 'Internship') || '  (none listed)',
    experienceBlock: formatRoleBlock(fullTime, 'Role') || '  (none — candidate is a fresher with no full-time roles)',
    projectBlock: projectLines.join('\n') || '  (none parsed)',
    achievementsBlock: achievementLines.slice(0, 8).join('\n  ') || '  (none explicitly listed — suggest adding hackathons, coursework awards, certifications)',
    entityGapsBlock: entityGaps.join('\n') || '  (no ATS scores)',
    weakProjectBulletsBlock: weakProjectBullets.slice(0, 6).join('\n  ') || '  (review project bullets for outcomes)',
    skillsList: (resume?.skills || []).slice(0, 45).join(', ') || 'None listed',
    educationBlock:
      (resume?.education || [])
        .slice(0, 4)
        .map((e) => `${e.degree || 'Degree'} @ ${e.institution || 'Institution'}${e.year ? ` (${e.year})` : ''}`)
        .join('; ') || 'None listed',
    summary: String(resume?.summary || resume?.objective || '').trim().slice(0, 400) || '(no summary section)',
    contact: [resume?.name, resume?.email].filter(Boolean).join(' | '),
    targetEmployers,
    internshipCount: internships.length,
    fullTimeCount: fullTime.length,
  }
}

function getLowScoreEntitiesRaw(scores, limit = 6) {
  return [...(scores || [])]
    .filter((s) => s && typeof s === 'object' && s.entity)
    .sort((a, b) => Number(a?.score || 0) - Number(b?.score || 0))
    .slice(0, limit)
}

function inferStacksFromProject(project, skills = []) {
  const blob = [
    project?.name,
    project?.description,
    ...extractBullets(project, 6),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const known = [
    'java', 'python', 'javascript', 'typescript', 'react', 'node', 'sql', 'spring', 'mysql',
    'mongodb', 'tensorflow', 'pandas', 'scikit-learn', 'git', 'docker', 'aws', 'c++', 'flask',
    'django', 'fastapi', 'redis', 'kafka', 'angular', 'vue', 'html', 'css', 'bootstrap',
    'machine learning', 'deep learning', 'nlp', 'opencv', 'android', 'kotlin', 'swift',
  ]
  const found = known.filter((k) => blob.includes(k))
  const fromSkills = (skills || [])
    .map((s) => String(s).trim())
    .filter((s) => s.length > 2 && blob.includes(s.toLowerCase()))
  return uniqueStrings([...found, ...fromSkills], 8)
}

function isWeakBullet(text) {
  const b = String(text || '').trim()
  if (b.length < 45) return true
  if (!/\d|%|accuracy|precision|recall|user|client|improv|reduc|increas|built|develop|deploy|design|implement/i.test(b)) {
    return true
  }
  return false
}

function buildEntityGapRecommendations(filteredScores, resume, deep, fresher) {
  const recs = []
  const lowEntities = getLowScoreEntitiesRaw(filteredScores, 5)
  const firstProject = (resume?.projects || [])[0]?.name || 'your lead project'
  const firstName = resume?.name?.split(/\s+/)?.[0] || 'You'

  for (const s of lowEntities) {
    const missingM = (s.missing_mandatory || []).slice(0, 5).map(toTitle)
    const missingP = (s.missing_preferred || []).slice(0, 3).map(toTitle)
    const missing = uniqueStrings([...missingM, ...missingP], 6)
    const matched = (s.matched_mandatory || []).slice(0, 4).map(toTitle)
    const b = s.breakdown || {}
    const projRel = Math.round((b.project_relevance || 0) * 100)
    const mandScore = Math.round(b.mandatory_skill_score || 0)

    const gapDetail = missing.length
      ? `Missing keywords for ${s.entity}: ${missing.join(', ')}.`
      : `Low project relevance (${projRel}%) and narrative alignment — your bullets may not show end-to-end ownership.`

    recs.push({
      section: `${s.entity} Readiness`,
      current: `Your resume scores ${s.score}% for ${s.entity} (mandatory skills ${mandScore}%, project relevance ${projRel}%). ${matched.length ? `Already matched: ${matched.join(', ')}.` : ''} ${gapDetail}`,
      suggestion: [
        `To raise your ${s.entity} shortlist odds, ${firstName} should make three targeted edits.`,
        missing.length
          ? `First, add ${missing.slice(0, 3).join(', ')} to Skills only if you can defend them in a technical round — then reference the same terms inside "${firstProject}" so skills and projects align.`
          : `First, rewrite "${firstProject}" with a clear problem statement, your individual contribution, and one metric recruiters can verify.`,
        `Second, add one bullet under "${firstProject}" framed as Action + Stack + Result — ${s.entity} reviewers look for proof you can ship, not coursework labels alone.`,
        fresher
          ? `Third, prepare a 90-second verbal walkthrough of "${firstProject}" mentioning ${missing[0] || matched[0] || 'your core stack'} — many ${s.entity} campus interviews start from the resume project list.`
          : `Third, mirror ${s.entity}'s associate-level JD language in your summary without keyword stuffing — tie your strongest project or role to their typical stack.`,
      ].join(' '),
      where: `Skills + Projects (optimized for ${s.entity})`,
      example: missing[0]
        ? `${firstProject} — Implemented ${missing[0]} module (${inferStacksFromProject(resume?.projects?.[0], resume?.skills).slice(0, 3).join(', ') || 'your stack'}) to [solve specific problem]; improved [metric] by X%.`
        : `${firstProject} — End-to-end [domain] solution using [stack]; achieved [metric] on [dataset/users], documented architecture decisions in README.`,
      evidence: `${s.entity} ${s.score}% | miss: ${missing.slice(0, 3).join(', ') || 'narrative'}`,
      valueAddition: `Directly addresses the ATS filter and human reviewer checklist ${s.entity} uses before campus shortlists.`,
      targetEmployers: s.entity,
      impact: Number(s.score) < 50 ? 'High' : 'Medium',
    })
  }
  return recs
}

function buildAllProjectRecommendations(resume, lowTargets, profile, deep) {
  const recs = []
  const projects = (resume?.projects || []).slice(0, 5)
  const targetStr = lowTargets.slice(0, 3).join(', ') || 'campus recruiters'

  projects.forEach((p, idx) => {
    const pname = p?.name || `Project ${idx + 1}`
    const bullets = extractBullets(p, 5)
    const stacks = inferStacksFromProject(p, resume?.skills)
    const leadBullet = bullets[0] || String(p?.description || '').slice(0, 160) || 'minimal description'
    const stackHint = stacks.length ? stacks.join(', ') : 'the stack you actually used'

    recs.push({
      section: idx === 0 ? 'Projects' : 'Project Depth',
      current: `"${pname}" currently reads as: "${String(leadBullet).slice(0, 180)}" — ${bullets.length < 2 ? 'too few bullets to show depth' : 'outcomes and your personal contribution are unclear'}.`,
      suggestion: [
        `Expand "${pname}" into ${bullets.length < 3 ? '3' : '2–4'} crisp bullets using this structure:`,
        `(1) Problem & scope — who benefited, what data/users/system;`,
        `(2) Your build — ${stackHint}, architecture or design choice you owned (not "team project" alone);`,
        `(3) Result — accuracy %, latency, users, time saved, or error reduction with a real number;`,
        idx === 0
          ? `As your lead project, this appears first — ${targetStr} often read only bullet #1 before deciding on a technical interview.`
          : `Support your lead project by showing breadth — different domain or stack where possible.`,
      ].join(' '),
      where: `Projects > ${pname}`,
      example: `${pname} — Built ML pipeline (${stackHint}) on [N] records; achieved [X]% precision. | Designed feature engineering workflow and documented model selection rationale. | Deployed demo API for stakeholder review.`,
      evidence: String(leadBullet).slice(0, 140),
      valueAddition: 'Transforms a coursework line into an interview story with verifiable technical depth.',
      targetEmployers: targetStr,
      impact: idx === 0 ? 'High' : 'Medium',
    })

    bullets.forEach((bullet, bi) => {
      if (!isWeakBullet(bullet)) return
      recs.push({
        section: 'Projects',
        current: `"${pname}" bullet ${bi + 1}: "${String(bullet).slice(0, 160)}" — lacks metrics, personal ownership, or technical specificity.`,
        suggestion: `Rewrite bullet ${bi + 1} using STAR in one line: Situation (1 phrase) → Your action (verb + ${stackHint}) → Result (number). Avoid passive voice ("was involved in", "helped with"). Name what YOU coded, configured, or analyzed. If this was academic, say "Academic project" honestly — still quantify the outcome.`,
        where: `Projects > ${pname} > bullet ${bi + 1}`,
        example: `Developed ${stackHint.split(',')[0] || 'Python'} module for [specific feature]; reduced [manual step] from [A] to [B] / achieved [X]% on test data.`,
        evidence: String(bullet).slice(0, 120),
        valueAddition: 'Weak bullets are the #1 reason technical reviewers skip to the next resume in campus piles.',
        targetEmployers: targetStr,
        impact: bi === 0 && idx === 0 ? 'High' : 'Medium',
      })
    })
  })

  if (projects.length > 1) {
    recs.push({
      section: 'Project Positioning',
      current: `Project order: ${projects.map((p) => p?.name || 'Unnamed').join(' → ')} — may not match ${profile === 'cs' ? 'software' : 'core'} recruiter priorities.`,
      suggestion: `Reorder so the project with the strongest metrics and most relevant stack (${targetStr.split(',')[0] || 'top target'}) appears first. Add a one-line subtitle under each project title: domain + primary stack. Remove or shorten projects with no bullets — empty entries signal lack of depth.`,
      where: 'Projects section — ordering & subtitles',
      example: `#1 ${projects[0]?.name} — "ML on utility data | Python, scikit-learn" | #2 [next project with different stack to show breadth]`,
      evidence: projects.map((p) => p?.name).filter(Boolean).join(', ').slice(0, 100),
      valueAddition: 'Recruiters spend ~15 seconds on projects — first impression determines interview shortlist.',
      targetEmployers: targetStr,
      impact: 'Medium',
    })
  }

  return recs
}

function buildRichResumeRecommendations(resume, evaluation, deep) {
  const profile = deep?.profile || detectResumeProfile(resume)
  const fresher = deep?.fresher ?? isFresherResume(resume)
  const scores = evaluation?.scores?.all || []
  const filtered = filterScoresForRecommendations(scores, profile)
  const missingSkills = collectMissingSkills(filtered)
  const lowTargets = collectLowScoreEntities(filtered, 6)
  const weakAreas = collectWeakDimensions(filtered)
  const skillsList = (resume?.skills || [])
  const skillsSample = skillsList.slice(0, 8).join(', ') || 'a thin or uncategorized skills list'
  const targetSample = lowTargets[0] || (profile === 'cs' ? 'TCS (campus hiring)' : 'relevant core employers')
  const firstName = resume?.name?.split(/\s+/)?.[0] || 'You'
  const firstProject = (resume?.projects || [])[0]?.name || 'your strongest project'
  const recs = []

  recs.push({
    section: 'Skills',
    current: `Skills section: "${skillsSample}" — ${skillsList.length > 12 ? 'long unstructured list' : 'does not yet signal interview-ready depth'} for ${targetSample}.`,
    suggestion: [
      `${firstName}, reorganize skills into 4 buckets: Languages | Frameworks/Libraries | Databases/Tools | CS Fundamentals.`,
      `Lead with the 6 skills you would confidently whiteboard or explain in a ${profile === 'cs' ? 'TCS/Infosys' : 'domain'} technical round.`,
      missingSkills.length
        ? `ATS gaps show recurring misses: ${missingSkills.slice(0, 6).map(toTitle).join(', ')} — add only skills you have used in "${firstProject}" or coursework.`
        : `Mirror stacks from "${firstProject}" so skills and projects tell one coherent story.`,
      `Drop outdated or vague items ("Core Computer Science", "OOP concepts") — replace with specifics: DSA, DBMS, OS, REST APIs, Git.`,
    ].join(' '),
    where: 'Skills section — top half of resume',
    example: 'Languages: Java, Python, SQL | Frameworks: Spring Boot, Pandas | Tools: Git, Jupyter, REST | Fundamentals: DSA, OOP, DBMS, OS',
    evidence: skillsSample.slice(0, 140),
    valueAddition: 'Recruiters scan skills in under 10 seconds — clear grouping is the difference between shortlist and reject pile.',
    targetEmployers: lowTargets.slice(0, 4).join(', '),
    impact: 'High',
  })

  if (missingSkills.length > 0) {
    const top = missingSkills.slice(0, 5).map(toTitle)
    recs.push({
      section: 'Skills Alignment',
      current: `Across your target employers, these skills appear repeatedly in ATS gaps but are absent or buried on your resume: ${top.join(', ')}.`,
      suggestion: [
        `Do not dump all keywords at once — weave them naturally:`,
        `(1) Add ${top.slice(0, 2).join(' and ')} under the correct Skills bucket;`,
        `(2) Reference ${top[0] || 'the top gap skill'} in a "${firstProject}" bullet showing how you used it;`,
        `(3) Mention one term in your summary if true.`,
        profile === 'cs'
          ? `Focus on IT/product employers (${lowTargets.slice(0, 3).join(', ') || 'TCS, Infosys, Wipro'}) — not hardware/core firms unrelated to your CS profile.`
          : `Align with ${deep.profileLabel} employers only.`,
        `If you cannot explain a skill in an interview, do not add it — honesty matters more than keyword count.`,
      ].join(' '),
      where: 'Skills + Projects + Summary',
      example: `Skills: added ${top[0] || 'SQL'} under Databases. Project: "Queried ${top[0] || 'SQL'} database of [N] records for ${firstProject}."`,
      evidence: top.join(', ').slice(0, 120),
      valueAddition: 'Raises ATS match scores while keeping your resume credible in human technical screens.',
      targetEmployers: lowTargets.slice(0, 4).join(', '),
      impact: 'High',
    })
  }

  recs.push(...buildAllProjectRecommendations(resume, lowTargets, profile, deep))
  recs.push(...buildEntityGapRecommendations(filtered, resume, deep, fresher))

  if (weakAreas.length > 0) {
    recs.push({
      section: 'ATS Dimensions',
      current: `Weakest scoring dimensions across your profile-filtered targets: ${weakAreas.join(', ')}.`,
      suggestion: [
        `These are structural gaps, not just missing keywords.`,
        weakAreas.some((w) => /project/i.test(w))
          ? `Project relevance is low — expand "${firstProject}" with problem, your code, and metrics.`
          : '',
        weakAreas.some((w) => /mandatory|skill/i.test(w))
          ? `Mandatory skill match is low — align Skills section with gaps listed in your per-company recommendations above.`
          : '',
        weakAreas.some((w) => /format/i.test(w))
          ? `Formatting score is low — use standard headings, no tables/icons, consistent dates.`
          : '',
        `Re-run ATS after edits to confirm dimension scores improve.`,
      ]
        .filter(Boolean)
        .join(' '),
      where: 'Cross-cutting — Skills, Projects, Formatting',
      example: 'Added quantified project bullets; categorized skills; standardized section headers.',
      evidence: weakAreas.join(', ').slice(0, 100),
      valueAddition: 'Fixing weak dimensions lifts all employer scores at once, not just one company.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    })
  }

  if (fresher) {
    recs.push({
      section: 'Achievements',
      current: deep?.achievementsBlock?.includes('none explicitly')
        ? 'No dedicated Achievements section — hackathons, certifications, and ranks are invisible to recruiters.'
        : `Achievements exist but are buried: ${deep.achievementsBlock.slice(0, 140)}`,
      suggestion: [
        `Add 3–5 one-line achievements between Education and Projects.`,
        `Include: hackathon ranks (with team size/track), coding contest positions, NPTEL/Coursera credentials with grade, Dean's list, publications, or meaningful GitHub activity.`,
        `Each line = one accomplishment + number or credential. Avoid paragraphs.`,
        `This is how freshers differentiate when 200 candidates list the same "Java, Python, SQL".`,
      ].join(' '),
      where: 'Achievements section (new) or below Education',
      example: '2nd / 40 teams — Inter-college Hackathon 2025 (AI track) | NPTEL Python for DS — Elite + Gold | Solved 200+ LeetCode problems (profile link)',
      evidence: deep?.achievementsBlock?.slice(0, 120) || 'No awards listed',
      valueAddition: 'Proof of drive beyond coursework — often the tiebreaker for campus shortlists.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    })

    const { internships } = partitionExperience(resume)
    if (internships.length > 0) {
      internships.slice(0, 3).forEach((intern, ii) => {
        const role = intern.role || intern.title || 'Intern'
        const company = intern.company || 'Organization'
        const bullets = extractBullets(intern, 3)
        const weakB = bullets[0] || String(intern.description || '').slice(0, 120)
        recs.push({
          section: 'Internships',
          current: `${role} @ ${company}: "${String(weakB).slice(0, 150)}" — reads like a title without deliverables or metrics.`,
          suggestion: [
            `Treat this internship as a real work story — 2–3 bullets each:`,
            `What team/product, what YOU built (stack), one measurable outcome (time saved, users, bugs fixed, reports automated).`,
            `If remote/part-time, state it honestly. Label section "Internships" separately from future full-time Experience.`,
            `Campus recruiters weigh internships heavily even when projects are strong.`,
          ].join(' '),
          where: `Internships > ${role} @ ${company}`,
          example: `${role} @ ${company} — Built [feature] in [stack] for [team]; reduced [task] from X to Y hours/week; presented to [N] stakeholders.`,
          evidence: String(weakB).slice(0, 120),
          valueAddition: 'Shows workplace exposure and professional communication — rare among freshers.',
          targetEmployers: lowTargets.slice(0, 3).join(', '),
          impact: ii === 0 ? 'High' : 'Medium',
        })
      })
    } else {
      recs.push({
        section: 'Internships',
        current: 'No internship listed — still competitive with strong projects, but recruiters cannot verify workplace exposure.',
        suggestion: [
          `Do NOT invent an internship or fake a company name.`,
          `Instead: strengthen "${firstProject}" with metrics, add GitHub README + demo, and list relevant certifications.`,
          `Label work honestly as "Academic Project" or "Personal Project".`,
          `Many mass-hiring drives shortlist freshers on projects alone when achievements are strong.`,
        ].join(' '),
        where: 'Projects + header links (not Experience)',
        example: `GitHub: ${firstProject} with README, architecture diagram, and 2-min demo video linked in contact line.`,
        evidence: 'No internship entries',
        valueAddition: 'Keeps resume honest while remaining competitive for fresher campus drives.',
        targetEmployers: lowTargets.slice(0, 3).join(', '),
        impact: 'Medium',
      })
    }

    recs.push({
      section: 'Summary',
      current: deep?.summary?.startsWith('(no')
        ? 'No professional summary — recruiters decide in ~6 seconds whether to read your projects.'
        : `Summary: "${deep.summary.slice(0, 160)}" — may be generic and not anchored to degree + best project.`,
      suggestion: [
        `Write 2–3 lines at the top:`,
        `Line 1: ${deep.profileLabel} graduate + graduation year + institution.`,
        `Line 2: Strongest stacks from "${firstProject}" and one proof point (metric, hackathon, internship).`,
        `Line 3: Target role type (e.g., entry-level software / ${profile === 'cs' ? 'IT services & product' : 'core engineering'}).`,
        `Avoid clichés ("hardworking", "quick learner") — use evidence from your resume.`,
      ].join(' '),
      where: 'Professional Summary — top of resume',
      example: `B.Tech Computer Science (2025) with hands-on ML projects (${inferStacksFromProject(resume?.projects?.[0], resume?.skills).slice(0, 2).join(', ') || 'Python, SQL'}). Built ${firstProject} with [metric]. Seeking entry-level software roles.`,
      evidence: deep?.summary?.slice(0, 120) || 'No summary',
      valueAddition: 'Gives human context before ATS parsing — helps non-technical recruiters understand fit instantly.',
      targetEmployers: lowTargets.slice(0, 4).join(', '),
      impact: 'High',
    })

    recs.push({
      section: 'Portfolio Links',
      current: 'GitHub, LinkedIn, or project demo not visible — recruiters cannot verify project claims before interview.',
      suggestion: [
        `Add one contact line: GitHub (with polished README on "${firstProject}"), LinkedIn, optional demo/portfolio URL.`,
        `README should include: problem, stack, how to run, results screenshot, your role.`,
        `Repos must match stacks on resume — mismatches fail technical credibility checks.`,
      ].join(' '),
      where: 'Header / contact block',
      example: `github.com/username | linkedin.com/in/username | Demo: ${firstProject}`,
      evidence: resume?.email || resume?.name || 'Contact block',
      valueAddition: 'Proof-of-work link is the fastest way to stand out when every fresher lists similar skills.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'Medium',
    })

    recs.push({
      section: 'Interview Preparation',
      current: `"${firstProject}" will likely be the first question in technical rounds for ${lowTargets.slice(0, 2).join(' / ') || 'campus recruiters'}.`,
      suggestion: [
        `Prepare a 90-second pitch: Problem → Why it matters → Your architecture/code choices → Stack → Result with numbers.`,
        `Anticipate follow-ups: Why this algorithm? What would you improve? How did you test? What was hardest?`,
        `Align pitch vocabulary with missing skills from your gap recommendations — only mention what you truly know.`,
        `Practice aloud — rambling project explanations fail more candidates than weak CGPA.`,
      ].join(' '),
      where: 'Preparation (not on resume — but critical for shortlist conversion)',
      example: `"I built ${firstProject} because [problem]. I used [stack] and achieved [metric]. The hardest part was [X]; I solved it by [Y]."`,
      evidence: firstProject,
      valueAddition: 'Shortlist means nothing without converting the project discussion — this bridges resume to offer.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    })
  } else {
    const { fullTime } = partitionExperience(resume)
    fullTime.slice(0, 3).forEach((exp, ei) => {
      const role = exp.role || exp.title || 'Role'
      const company = exp.company || 'Company'
      const bullets = extractBullets(exp, 4)
      const weakB = bullets.find(isWeakBullet) || bullets[0] || 'responsibility-heavy bullet'
      recs.push({
        section: 'Experience',
        current: `${role} @ ${company}: "${String(weakB).slice(0, 160)}" — impact and scale not quantified.`,
        suggestion: [
          `Rewrite top 2 bullets as Action + Scope + Stack + Result.`,
          `One metric per bullet: %, time, users, revenue, defects, throughput.`,
          `Lead with strongest outcome — ${targetSample} reviewers scan Experience before Projects.`,
          `Remove outdated tasks; emphasize work relevant to your next target role.`,
        ].join(' '),
        where: `Experience > ${role} @ ${company}`,
        example: `Engineered [system] in [stack] serving [N] users; cut [process] from X to Y hours/week. | Led migration to [tech]; reduced incidents by Z%.`,
        evidence: String(weakB).slice(0, 120),
        valueAddition: 'Experienced hires are judged on outcomes and scale — task lists do not pass ATS or human screens.',
        targetEmployers: lowTargets.slice(0, 3).join(', '),
        impact: ei === 0 ? 'High' : 'Medium',
      })
    })
  }

  if ((resume?.education || []).length > 0) {
    const edu = resume.education[0]
    recs.push({
      section: 'Education',
      current: `${edu.degree || 'Degree'} at ${edu.institution || 'institution'}${edu.year ? ` (${edu.year})` : ''} — CGPA and relevant coursework may not be visible.`,
      suggestion: [
        `Show: degree, branch, institution, graduation year, CGPA/percentage if ≥ 7.5 (omit if lower unless employer asks).`,
        `Add 2–4 coursework lines matching your projects: DSA, DBMS, OS, ML, Networks, etc.`,
        `Campus eligibility filters use degree + year — make them parser-friendly on line 1.`,
      ].join(' '),
      where: 'Education section',
      example: `B.Tech Computer Science, [University] (2025) | CGPA: 8.2 | Coursework: DSA, DBMS, ML, Computer Networks`,
      evidence: `${edu.degree || ''} ${edu.institution || ''}`.trim().slice(0, 100),
      valueAddition: 'Confirms eligibility and signals depth beyond a skills list.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'Medium',
    })
  }

  recs.push({
    section: 'Formatting',
    current: 'Layout issues (dense lists, missing headers, tables/icons) hurt both ATS parsers and 6-second human scans.',
    suggestion: [
      `Use standard headings: Summary | Skills | Education | Projects | Achievements | Internships (if any) | Experience (full-time only).`,
      `One column, no graphics/icons, consistent dates (MMM YYYY), PDF export with selectable text.`,
      fresher ? `Do not create a fake Experience section — keep internships and projects separate.` : `Keep Experience reverse-chronological with 3–5 bullets per role.`,
    ].join(' '),
    where: 'Overall layout & export',
    example: 'Replaced paragraph skills with categorized lists; added Achievements header; removed table layout.',
    evidence: 'Layout / ATS parsing',
    valueAddition: 'Ensures parsers and recruiters extract the right sections — invisible but essential.',
    targetEmployers: 'All targets',
    impact: 'Medium',
  })

  return recs
}

/** @deprecated — use buildRichResumeRecommendations */
function buildDeterministicFallbackRecommendations(resume, evaluation, deep) {
  return buildRichResumeRecommendations(resume, evaluation, deep)
}

function buildCoverageBoosterRecommendations(resume, missingSkills, deep) {
  return []
}

function buildCompactRecommendationPrompts(resume, deep, { fresher, profile, missingSkills, lowScoreTargets }, batchFocus = 'projects') {
  const projectLines = (resume?.projects || [])
    .slice(0, 3)
    .map((p) => {
      const bullets = extractBullets(p, 2)
        .map((b) => b.slice(0, 80))
        .join('; ')
      return `${p.name || 'Project'}: ${bullets || String(p.description || '').slice(0, 80)}`
    })
    .join('\n')

  const employers =
    profile === 'cs'
      ? 'TCS, Infosys, Wipro, Cognizant, Accenture, HCL, IBM, Oracle, SAP, Adobe, OpenText, MAANG'
      : lowScoreTargets.slice(0, 4).join(', ') || deep.profileLabel

  const fresherRules = fresher
    ? 'FRESHER: no Experience recs, no invented jobs.'
    : 'Experience recs only for real roles on resume.'

  const profileRules =
    profile === 'cs'
      ? 'CS: IT employers only — never Cisco, Intel, NVIDIA, Samsung.'
      : `Core (${deep.profileLabel}): branch-relevant employers only.`

  const focusBlock =
    batchFocus === 'projects'
      ? `Focus on Projects + Project Depth: 4-5 items quoting their project names/bullets. Each suggestion 3-5 sentences with specific rewrites.`
      : `Focus on Skills, Achievements, Summary, ${fresher ? 'Internships' : 'Experience'}: 4-5 items. Each suggestion 3-5 sentences with value for recruiters.`

  const systemPrompt = `Campus counselor. JSON array of 4-5 detailed objects. Keys: section,current,suggestion,where,example,evidence,valueAddition,targetEmployers,impact.
${fresherRules} ${profileRules} ${focusBlock}
Write to "you". Be specific, human, detailed — not generic keywords. No markdown.`

  const userPrompt = `${resume?.name || '—'} | ${deep.profileLabel} | ${fresher ? 'Fresher' : 'Experienced'}
Skills: ${deep.skillsList.slice(0, 180)}
Projects:
${projectLines || '(none)'}
Gaps: ${lowScoreTargets.slice(0, 4).join('; ') || 'N/A'}
Missing: ${missingSkills.slice(0, 6).map(toTitle).join(', ') || 'N/A'}
Employers: ${employers}
Return JSON only (4-5 detailed items).`

  return fitPromptToGroqBudget(systemPrompt, userPrompt, TOKENS_RECOMMENDATIONS_BATCH)
}

async function fetchLlmRecommendations(resume, deep, ctx) {
  if (!groq) return []
  const batches = ['projects', 'profile']
  const all = []

  for (const batchFocus of batches) {
    try {
      const { systemPrompt, userPrompt } = buildCompactRecommendationPrompts(resume, deep, ctx, batchFocus)
      const estIn = estimateGroqTokens(systemPrompt) + estimateGroqTokens(userPrompt)
      const estTotal = estIn + TOKENS_RECOMMENDATIONS_BATCH
      if (estTotal > GROQ_TPM_SAFE_BUDGET) {
        console.warn('[recommendations] batch over budget, skipping', { batchFocus, estTotal })
        continue
      }
      const raw = await callGroq(
        systemPrompt,
        userPrompt,
        TOKENS_RECOMMENDATIONS_BATCH,
        GROQ_MODEL,
        true,
        { noTokenBump: true }
      )
      const parsed = parseJsonArraySalvage(raw).filter(
        (r) => r && typeof r === 'object' && String(r.section || '').trim() && String(r.suggestion || '').trim()
      )
      all.push(...parsed)
      if (batches.indexOf(batchFocus) < batches.length - 1) {
        await new Promise((r) => setTimeout(r, LLM_BATCH_DELAY_MS))
      }
    } catch (err) {
      console.warn(`[recommendations] LLM batch "${batchFocus}" skipped:`, err?.message || err)
      if (isGroqQuotaError(err)) break
    }
  }
  return all
}

function shapeRecommendationList(items, fallbackItems, minCount = 15, maxCount = 18, { fresher = false, profile = 'cs' } = {}) {
  const dedupe = new Set()
  const out = []
  const bannedForFresher = /^experience$/i

  const pushUnique = (r) => {
    const sanitized = sanitizeRecommendationForProfile(r, { fresher, profile })
    if (!sanitized) return
    const section = String(sanitized?.section || '').trim().slice(0, 64)
    if (fresher && bannedForFresher.test(section)) return
    const suggestion = String(sanitized?.suggestion || '').trim().slice(0, 2000)
    if (!section || !suggestion) return
    if (/create an experience section|no experience section/i.test(`${sanitized?.current} ${suggestion}`) && fresher) return
    if (/software engineer @ infosys|@ infosys, developed/i.test(suggestion) && fresher) return
    const where = String(sanitized?.where || sanitized?.location || sanitized?.target || '').trim().slice(0, 240) || section
    const key = `${section.toLowerCase()}|${where.toLowerCase().slice(0, 60)}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    out.push({
      section,
      current: String(sanitized?.current || 'Needs optimization').trim().slice(0, 500),
      suggestion,
      where,
      example: String(sanitized?.example || '').trim().slice(0, 600),
      evidence: String(sanitized?.evidence || '').trim().slice(0, 280),
      valueAddition: String(sanitized?.valueAddition || sanitized?.value_addition || '').trim().slice(0, 400),
      targetEmployers: String(sanitized?.targetEmployers || sanitized?.target_employers || '').trim().slice(0, 240),
      impact: String(sanitized?.impact || '').trim().toLowerCase() === 'high' ? 'High' : 'Medium',
      _sort: String(sanitized?.impact || '').toLowerCase() === 'high' ? 0 : 1,
    })
  }

  const merged = [...(items || []), ...(fallbackItems || [])]
  merged.sort((a, b) => {
    const ah = String(a?.impact || '').toLowerCase() === 'high' ? 0 : 1
    const bh = String(b?.impact || '').toLowerCase() === 'high' ? 0 : 1
    return ah - bh
  })

  for (const item of merged) {
    if (out.length >= maxCount) break
    pushUnique(item)
  }

  if (out.length >= minCount) {
    return out.slice(0, maxCount).map(({ _sort, ...rest }) => rest)
  }

  for (const item of fallbackItems || []) {
    if (out.length >= minCount) break
    pushUnique(item)
  }

  return out.slice(0, maxCount).map(({ _sort, ...rest }) => rest)
}

/**
 * POST /api/explain-ats
 * Body: { entity, score, matchedMandatory, missingMandatory, matchedPreferred, missingPreferred, breakdown }
 */
app.post('/api/explain-ats', async (req, res) => {
  try {
    const {
      entity,
      score,
      matchedMandatory = [],
      missingMandatory = [],
      matchedPreferred = [],
      missingPreferred = [],
      breakdown = {},
    } = req.body

    const systemPrompt = `ATS expert. Plain text only: no markdown, no asterisks. One idea per line. Be concise.`
    const userPrompt = `Score ${score}% for ${entity}.
Matched mandatory: ${matchedMandatory.join(', ') || 'None'}
Missing mandatory: ${missingMandatory.join(', ') || 'None'}
Matched preferred: ${matchedPreferred.join(', ') || 'None'}
Missing preferred: ${missingPreferred.join(', ') || 'None'}
Breakdown: mand ${breakdown.mandatory_skill_score ?? 'N/A'}% pref ${breakdown.preferred_skill_score ?? 'N/A'}% proj ${breakdown.project_relevance ?? 'N/A'} edu ${breakdown.education_match ?? 'N/A'} fmt ${breakdown.formatting_score ?? 'N/A'}

Format (short lines):
Strengths:
- (2-3)

Weaknesses:
- (2-3)

Suggestions:
- (exactly 3)`

    const explanation = await callGroq(systemPrompt, userPrompt, TOKENS_EXPLAIN_ATS)
    if (!explanation || !String(explanation).trim()) {
      return res.status(503).json({
        error: 'We could not produce a complete explanation. Please try again.',
      })
    }
    res.json({ explanation })
  } catch (err) {
    console.error('explain-ats error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate explanation',
    })
  }
})

/**
 * POST /api/recommendations
 * Body: { resume, evaluation }
 */
app.post('/api/recommendations', async (req, res) => {
  try {
    const { resume, evaluation } = req.body

    const deep = buildResumeDeepContext(resume, evaluation)
    const profile = deep.profile
    const fresher = deep.fresher
    const filteredScores = filterScoresForRecommendations(evaluation?.scores?.all || [], profile)
    const missingSkills = collectMissingSkills(filteredScores)
    const lowScoreTargets = collectLowScoreEntities(filteredScores, 8)

    const richRecommendations = buildRichResumeRecommendations(resume, evaluation, deep)

    let llmRecommendations = []
    let source = 'rich'

    try {
      llmRecommendations = await fetchLlmRecommendations(resume, deep, {
        fresher,
        profile,
        missingSkills,
        lowScoreTargets,
      })
      if (llmRecommendations.length > 0) source = 'hybrid'
    } catch (llmErr) {
      console.warn('[recommendations] LLM skipped:', llmErr?.message || llmErr)
    }

    const recommendations = shapeRecommendationList(llmRecommendations, richRecommendations, 15, 18, { fresher, profile })
    res.json({
      recommendations,
      meta: { profile, profileLabel: deep.profileLabel, fresher, source },
    })
  } catch (err) {
    console.error('recommendations error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate recommendations',
    })
  }
})

/**
 * POST /api/generate-sop
 * Body: { resume, targetProgram, targetUniversity }
 * Returns generated Statement of Purpose
 */
app.post('/api/generate-sop', async (req, res) => {
  try {
    const { resume, targetProgram, targetUniversity } = req.body
    if (!resume) {
      return res.status(400).json({ error: 'resume required' })
    }

    const systemPrompt = `Academic advisor. Plain text SOP: formal paragraphs, no markdown. Be concise.`
    const userPrompt = `SOP (2-3 short paragraphs) for ${resume.name || 'candidate'} → ${targetProgram || 'Graduate program'} @ ${targetUniversity || 'university'}.
Edu: ${(resume.education || []).slice(0, 3).map((e) => `${e.degree} ${e.institution || ''}`).join('; ') || '—'}
Exp: ${(resume.experience || []).slice(0, 4).map((e) => `${e.role || e.title} ${e.company}`).join('; ') || '—'}
Skills: ${(resume.skills || []).slice(0, 12).join(', ') || '—'}
Projects: ${(resume.projects || []).slice(0, 4).map((p) => p.name).join('; ') || '—'}
Cover: fit for program, background, goals. Text only.`

    const raw = await callGroq(systemPrompt, userPrompt, TOKENS_SOP)
    if (!raw || !String(raw).trim()) {
      return res.status(503).json({
        error: 'We could not produce a complete statement. Please try again.',
      })
    }
    res.json({ content: raw })
  } catch (err) {
    console.error('generate-sop error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate SOP',
    })
  }
})

/**
 * POST /api/generate-cover-letter
 * Body: { resume, targetRole, targetCompany }
 * Returns generated cover letter
 */
app.post('/api/generate-cover-letter', async (req, res) => {
  try {
    const { resume, targetRole, targetCompany } = req.body
    if (!resume) {
      return res.status(400).json({ error: 'resume required' })
    }

    const systemPrompt = `Career coach. Plain text cover letter: greeting, body, "Sincerely," + name. No markdown. Concise.`
    const userPrompt = `Cover letter for ${resume.name || '—'} applying to ${targetRole || 'role'} at ${targetCompany || 'company'}.
Skills: ${(resume.skills || []).slice(0, 12).join(', ') || '—'}
Exp: ${(resume.experience || []).slice(0, 4).map((e) => `${e.role || e.title} @ ${e.company}`).join('; ') || '—'}
Edu: ${(resume.education || []).slice(0, 2).map((e) => e.degree).join('; ') || '—'}
Projects: ${(resume.projects || []).slice(0, 3).map((p) => p.name).join('; ') || '—'}
4 short paragraphs max. End Sincerely, ${resume.name || 'Candidate'}. Text only.`

    const raw = await callGroq(systemPrompt, userPrompt, TOKENS_COVER_LETTER)
    if (!raw || !String(raw).trim()) {
      return res.status(503).json({
        error: 'We could not produce a complete cover letter. Please try again.',
      })
    }
    res.json({ content: raw })
  } catch (err) {
    console.error('generate-cover-letter error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate cover letter',
    })
  }
})

/**
 * POST /api/tts - Indian English text-to-speech
 * Body: { text }
 * Returns: audio/mpeg (Indian accent)
 * Requires: GOOGLE_APPLICATION_CREDENTIALS
 */
let textToSpeechClient = null
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const { TextToSpeechClient } = await import('@google-cloud/text-to-speech')
    textToSpeechClient = new TextToSpeechClient()
  } catch (e) {
    console.warn('Google TTS not available:', e.message)
  }
}

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' })
    }
    const trimmed = text.trim().slice(0, 5000)
    if (!trimmed) return res.status(400).json({ error: 'text required' })

    if (textToSpeechClient) {
      const [response] = await textToSpeechClient.synthesizeSpeech({
        input: { text: trimmed },
        voice: { languageCode: 'en-IN', name: 'en-IN-Standard-A' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0 },
      })
      const audio = response.audioContent
      if (audio?.length > 0) {
        res.set('Content-Type', 'audio/mpeg')
        res.send(Buffer.from(audio))
        return
      }
    }
    res.status(503).json({ error: 'Indian TTS not configured. Set GOOGLE_APPLICATION_CREDENTIALS.' })
  } catch (err) {
    console.error('tts error:', err)
    res.status(500).json({ error: err.message || 'TTS failed' })
  }
})

/**
 * POST /api/interview-recommendations
 * Body: { report } - behavioral report with overall + questionTimelines
 * Returns LLM-generated correction tips for interview performance
 */
app.post('/api/interview-recommendations', async (req, res) => {
  try {
    const { report } = req.body
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'report object required' })
    }

    const overall = report.overall && typeof report.overall === 'object' ? report.overall : {}
    const questionTimelines = Array.isArray(report?.questionTimelines) ? report.questionTimelines : []
    const safeNum = (v, def = 0) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : def)
    const ec = safeNum(overall.avgEyeContact, 0) * 100
    const fv = safeNum(overall.avgFaceVisibility, 0) * 100
    const hs = safeNum(overall.avgHeadStability, 0) * 100
    const es = safeNum(overall.avgEmotionalStability, 1) * 100
    const br = safeNum(overall.avgBlinkRate, 0)
    const systemPrompt = `Interview coach. From metrics below, output ONLY JSON array of 4 tips: {"tip":"one sentence","area":"eye-contact|visibility|stability|expression|general","priority":1}. priority 1=most important. Encouraging tone.`
    const safeFix = (n, d) => {
      const x = (n != null && Number.isFinite(Number(n))) ? Number(n) : 0
      return x.toFixed(typeof d === 'number' ? d : 1)
    }
    const emotionDist = overall.avgEmotionDistribution && typeof overall.avgEmotionDistribution === 'object' ? overall.avgEmotionDistribution : {}
    const emotionStr = Object.entries(emotionDist)
      .filter(([, v]) => v > 0.02)
      .map(([k, v]) => `${k} ${safeFix((v ?? 0) * 100, 0)}%`)
      .join(', ') || 'N/A'
    const qSummaries = questionTimelines
      .slice(0, 8)
      .map((q, i) => {
      const s = q?.timeline?.summary && typeof q.timeline.summary === 'object' ? q.timeline.summary : {}
      const qec = safeFix(safeNum(s.meanEyeContactRatio, 0) * 100, 0)
      const qfv = safeFix(safeNum(s.meanFaceVisibility, 0) * 100, 0)
      const qDist = s.questionAnalysis?.emotionalProbabilityDistribution || {}
      const qEmo = (Object.entries(qDist).filter(([, v]) => v > 0.1).map(([k, v]) => `${k} ${safeFix((v ?? 0) * 100, 0)}%`).join(', ') || s.dominantEmotion) ?? 'N/A'
      return `Q${i + 1} (${q?.type ?? 'unknown'}): conf ${s.confidence ?? 0} ec ${qec}% vis ${qfv}% ${qEmo}`
    })
      .join('; ') || 'None'
    const posRatio = safeFix((overall.positiveExpressionRatio ?? 1) * 100, 0)
    const stressRatio = safeFix((overall.stressIndicatorRatio ?? 0) * 100, 0)
    const userPrompt = `Conf ${overall.confidence ?? 0}/100 | ec ${safeFix(ec, 1)}% | vis ${safeFix(fv, 1)}% | head ${safeFix(hs, 1)}% | emo stab ${safeFix(es, 1)}% | blink ${safeFix(br, 2)}/s | pos ${posRatio}% | stress ${stressRatio}% | dist: ${emotionStr}
Per Q: ${qSummaries}
JSON array 4 tips.`

    const raw = await callGroq(systemPrompt, userPrompt, TOKENS_INTERVIEW_TIPS, GROQ_MODEL, true)
    let recommendations = parseJsonArraySalvage(raw).filter(
      (r) => r && typeof r === 'object' && String(r.tip || '').trim()
    )
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      recommendations = [
        {
          tip: 'Practice maintaining eye contact and a steady posture while speaking clearly.',
          area: 'general',
          priority: 1,
        },
      ]
    }
    res.json({ recommendations })
  } catch (err) {
    console.error('interview-recommendations error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate recommendations',
    })
  }
})

const SELECTRA_SYSTEM = `You are Selectra, JobRush.ai help assistant (careers: resumes, ATS, interviews, cover letters, SOPs, job search). Also explain JobRush features briefly.
Be concise (short paragraphs; bullets OK for lists). Do not ramble.
Never name AI vendors/models or reveal stack/code. If asked how you work technically, say you can't discuss implementation and offer career help instead.`

/**
 * POST /api/chat - Selectra chatbot
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 * Returns: { reply: string }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' })
    }
    const trimmed = messages
      .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, MAX_CHAT_MSG_CHARS) }))
      .filter((m) => m.content.length > 0)
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'messages must have role and content' })
    }
    const recent = trimmed.length > MAX_CHAT_TURNS ? trimmed.slice(-MAX_CHAT_TURNS) : trimmed
    const fullMessages = [{ role: 'system', content: SELECTRA_SYSTEM }, ...recent]
    const reply = await chatGroq(fullMessages, TOKENS_CHAT_REPLY)
    if (!reply || !String(reply).trim()) {
      return res.status(503).json({
        error: 'We could not produce a complete reply. Please try again.',
      })
    }
    res.json({ reply })
  } catch (err) {
    console.error('chat error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to get reply',
    })
  }
})

/**
 * POST /api/notify-new-payment-request
 * Body: { email, upiReference, couponCode, requestedAt }
 */
app.post('/api/notify-new-payment-request', async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email)
    const upiReference = String(req.body?.upiReference || '').trim()
    const couponCode = String(req.body?.couponCode || '').trim()
    const requestedAt = String(req.body?.requestedAt || new Date().toISOString())
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid user email is required.' })
    }
    const notifyRecipient = ADMIN_NOTIFY_EMAIL.includes('@') ? ADMIN_NOTIFY_EMAIL : 'hirefortune90@gmail.com'
    const refLine = upiReference ? `Payment reference: ${upiReference}` : 'Payment reference: Not provided'
    const couponLine = couponCode ? `Coupon code submitted: ${couponCode}` : 'Coupon code submitted: None'
    const subject = 'New JobRush user registration and payment request'
    const text = [
      `Hello Team,`,
      ``,
      `A new user has completed registration and submitted a payment request on JobRush.`,
      `User email: ${email}`,
      `${refLine}`,
      `${couponLine}`,
      `Requested at: ${requestedAt}`,
      ``,
      `Regards,`,
      `JobRush Onboarding Team`,
    ].join('\n')
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <p>Hello Team,</p>
        <p>A new user has completed registration and submitted a payment request on <strong>JobRush</strong>.</p>
        <p>
          <strong>User email:</strong> ${esc(email)}<br/>
          <strong>Payment reference:</strong> ${esc(upiReference || 'Not provided')}<br/>
          <strong>Coupon code submitted:</strong> ${esc(couponCode || 'None')}<br/>
          <strong>Requested at:</strong> ${esc(requestedAt)}
        </p>
        <p>Regards,<br/>JobRush Onboarding Team</p>
      </div>
    `
    const messageId = await sendResendMail({
      from: MAIL_FROM_NEW_USER,
      to: notifyRecipient,
      subject,
      html,
      text,
      replyTo: MAIL_REPLY_TO,
    })
    console.log('[email] notify-new-payment-request', { to: notifyRecipient, subject, messageId })
    res.json({ ok: true, messageId, recipient: notifyRecipient })
  } catch (err) {
    console.error('notify-new-payment-request error:', err)
    res.status(500).json({ error: err.message || 'Failed to send acknowledgement email.' })
  }
})

/**
 * POST /api/admin/notify-payment-decision
 * Body: { email, decision, paymentReference, approvedAt }
 */
app.post('/api/admin/notify-payment-decision', requireAdminSecret, async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email)
    const decision = String(req.body?.decision || '').trim().toLowerCase()
    const paymentReference = String(req.body?.paymentReference || '').trim()
    const approvedAt = String(req.body?.approvedAt || new Date().toISOString())
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid recipient email is required.' })
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'Decision must be "approved" or "rejected".' })
    }

    const isApproved = decision === 'approved'
    const activationDisplay = formatActivationForEmail(approvedAt)
    const subject = isApproved
      ? 'Your JobRush access is now active'
      : 'Action required: JobRush payment verification'
    const text = isApproved
      ? [
          `Hello,`,
          ``,
          `Great news—your JobRush payment is verified and your full access is now active.`,
          paymentReference ? `Payment reference: ${paymentReference}` : null,
          `Activation time: ${activationDisplay} (IST)`,
          ``,
          `You are ready to move forward with confidence: sharpen your resume for ATS, strengthen your story, and practice interviews that mirror the real process.`,
          ``,
          `Take the next step and launch JobRush here:`,
          JOB_RUSH_APP_URL,
          ``,
          `We are glad to have you on board and look forward to seeing you succeed.`,
          ``,
          `Regards,`,
          `JobRush Access Team`,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `Hello,`,
          ``,
          `We could not verify your recent payment details for JobRush.`,
          paymentReference ? `Submitted reference: ${paymentReference}` : null,
          ``,
          `Please complete payment again and submit a fresh reference from your dashboard, or contact support with proof of payment.`,
          ``,
          `Regards,`,
          `JobRush Access Team`,
        ]
          .filter(Boolean)
          .join('\n')

    const html = isApproved
      ? `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
          <p>Hello,</p>
          <p>Great news—your <strong>JobRush</strong> payment is verified and your <strong>full access is now active</strong>.</p>
          <p>
            ${paymentReference ? `<strong>Payment reference:</strong> ${esc(paymentReference)}<br/>` : ''}
            <strong>Activation time:</strong> ${esc(activationDisplay)} <span style="color:#6b7280;font-weight:400">(IST)</span>
          </p>
          <p>You are ready to move forward with confidence: sharpen your resume for ATS, strengthen your story, and practice interviews that mirror the real process.</p>
          <p style="margin:24px 0">
            <a href="${esc(JOB_RUSH_APP_URL)}" style="display:inline-block;background:#111827;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600">Get started on JobRush</a>
          </p>
          <p style="font-size:14px;color:#4b5563">Or open this link in your browser:<br/><a href="${esc(JOB_RUSH_APP_URL)}" style="color:#2563eb">${esc(JOB_RUSH_APP_URL)}</a></p>
          <p>We are glad to have you on board and look forward to seeing you succeed.</p>
          <p>Regards,<br/>JobRush Access Team</p>
        </div>
      `
      : `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
          <p>Hello,</p>
          <p>We could not verify your recent payment details for <strong>JobRush</strong>.</p>
          <p>${paymentReference ? `<strong>Submitted reference:</strong> ${esc(paymentReference)}<br/>` : ''}</p>
          <p>Please complete payment again and submit a fresh reference from your dashboard, or contact support with proof of payment.</p>
          <p>Regards,<br/>JobRush Access Team</p>
        </div>
      `

    const messageId = await sendResendMail({
      from: MAIL_FROM_WELCOME,
      to: email,
      subject,
      html,
      text,
      replyTo: MAIL_REPLY_TO,
    })
    console.log('[email] notify-payment-decision', { to: email, subject, messageId })
    res.json({ ok: true, messageId })
  } catch (err) {
    console.error('notify-payment-decision error:', err)
    res.status(500).json({ error: err.message || 'Failed to send payment decision email.' })
  }
})

/**
 * POST /api/admin/notify-payment-pending
 * Body: { email } — users who registered but have not completed payment (pending_payment).
 */
app.post('/api/admin/notify-payment-pending', requireAdminSecret, async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email)
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email is required.' })
    }

    const subject = 'Complete your JobRush registration — payment details needed'
    const text = [
      `Hello,`,
      ``,
      `Thank you for starting your JobRush registration. Your account is on file, but we have not yet received a completed payment with a verifiable transaction reference.`,
      ``,
      `You are only a few clicks away from unlocking your full toolkit: ATS-aligned resume scoring, targeted improvements, and AI-powered mock interviews — structured to help you present your strongest candidacy for roles that matter to you.`,
      ``,
      `To continue:`,
      `1. Open JobRush using the link below.`,
      `2. Sign in with the same email you used to register.`,
      `3. Complete payment and enter your valid payment or UPI transaction ID exactly as shown in your bank or UPI app. Accurate references allow us to verify and activate your access promptly.`,
      ``,
      `Return to JobRush:`,
      JOB_RUSH_APP_URL,
      ``,
      `If you believe you have already paid, please try again with the correct transaction ID, or reply to this email with proof of payment and we will assist you.`,
      ``,
      `Regards,`,
      `JobRush Onboarding Team`,
    ].join('\n')

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <p>Hello,</p>
        <p>Thank you for starting your <strong>JobRush</strong> registration. Your account is on file, but we have not yet received a completed payment with a verifiable transaction reference.</p>
        <p>You are only a few clicks away from unlocking your full toolkit: ATS-aligned resume scoring, targeted improvements, and AI-powered mock interviews — structured to help you present your strongest candidacy for roles that matter to you.</p>
        <p><strong>To continue:</strong></p>
        <ol style="margin:0 0 1em 1.25em;padding:0">
          <li style="margin-bottom:0.35em">Open JobRush using the button or link below.</li>
          <li style="margin-bottom:0.35em">Sign in with the <strong>same email</strong> you used to register.</li>
          <li style="margin-bottom:0.35em">Complete payment and enter your <strong>valid payment or UPI transaction ID</strong> exactly as shown in your bank or UPI app. Accurate references allow us to verify and activate your access promptly.</li>
        </ol>
        <p style="margin:24px 0">
          <a href="${esc(JOB_RUSH_APP_URL)}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:600">Continue to JobRush</a>
        </p>
        <p style="font-size:14px;color:#4b5563">Or copy this URL:<br/><a href="${esc(JOB_RUSH_APP_URL)}" style="color:#2563eb">${esc(JOB_RUSH_APP_URL)}</a></p>
        <p>If you believe you have already paid, please try again with the correct transaction ID, or reply to this email with proof of payment and we will assist you.</p>
        <p>Regards,<br/>JobRush Onboarding Team</p>
      </div>
    `

    const messageId = await sendResendMail({
      from: MAIL_FROM_NEW_USER,
      to: email,
      subject,
      html,
      text,
      replyTo: MAIL_REPLY_TO,
    })
    console.log('[email] notify-payment-pending', { to: email, subject, messageId })
    res.json({ ok: true, messageId })
  } catch (err) {
    console.error('notify-payment-pending error:', err)
    res.status(500).json({ error: err.message || 'Failed to send payment pending email.' })
  }
})

/**
 * POST /api/admin/send-user-email
 * Body: { to, subject, message }
 */
app.post('/api/admin/send-user-email', requireAdminSecret, async (req, res) => {
  try {
    const toRaw = req.body?.to
    const to = Array.isArray(toRaw) ? toRaw.map(cleanEmail).filter(Boolean) : [cleanEmail(toRaw)].filter(Boolean)
    const subject = String(req.body?.subject || '').trim()
    const message = String(req.body?.message || '').trim()
    if (!to.length) return res.status(400).json({ error: 'At least one recipient email is required.' })
    if (!subject) return res.status(400).json({ error: 'Email subject is required.' })
    if (!message) return res.status(400).json({ error: 'Email message is required.' })

    const text = `${message}\n\nRegards,\nJobRush Reports Desk`
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
        <p>${esc(message).replace(/\n/g, '<br/>')}</p>
        <p>Regards,<br/>JobRush Reports Desk</p>
      </div>
    `
    const messageId = await sendResendMail({
      from: MAIL_FROM_REPORTS,
      to,
      subject,
      html,
      text,
      replyTo: MAIL_REPLY_TO,
    })
    console.log('[email] send-user-email', { to, subject, messageId })
    res.json({ ok: true, messageId, recipients: to.length })
  } catch (err) {
    console.error('send-user-email error:', err)
    res.status(500).json({ error: err.message || 'Failed to send report email.' })
  }
})

async function probeGroqUsageHeaders() {
  const key = process.env.GROQ_API_KEY
  if (!key) return { ok: false, reason: 'no_key' }
  const ac = new AbortController()
  const tid = setTimeout(() => ac.abort(), 8000)
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: '.' }],
        max_tokens: 1,
      }),
      signal: ac.signal,
    })
    clearTimeout(tid)
    const h = (n) => r.headers.get(n)
    return {
      ok: true,
      httpStatus: r.status,
      limitRequests: h('x-ratelimit-limit-requests'),
      remainingRequests: h('x-ratelimit-remaining-requests'),
      limitTokens: h('x-ratelimit-limit-tokens'),
      remainingTokens: h('x-ratelimit-remaining-tokens'),
      resetRequests: h('x-ratelimit-reset-requests'),
      resetTokens: h('x-ratelimit-reset-tokens'),
    }
  } catch (e) {
    clearTimeout(tid)
    return {
      ok: false,
      reason: 'fetch_error',
      error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e),
    }
  }
}

async function probeResendUsageHeaders() {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'no_key' }
  const ac = new AbortController()
  const tid = setTimeout(() => ac.abort(), 8000)
  try {
    const r = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: ac.signal,
    })
    clearTimeout(tid)
    const h = (n) => r.headers.get(n)
    return {
      ok: true,
      httpStatus: r.status,
      ratelimitLimit: h('ratelimit-limit'),
      ratelimitRemaining: h('ratelimit-remaining'),
      ratelimitReset: h('ratelimit-reset'),
      dailyQuotaUsed: h('x-resend-daily-quota'),
      monthlyQuotaUsed: h('x-resend-monthly-quota'),
    }
  } catch (e) {
    clearTimeout(tid)
    return {
      ok: false,
      reason: 'fetch_error',
      error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e),
    }
  }
}

function buildProcessInfo() {
  const mem = process.memoryUsage()
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    rssMb: Math.round(mem.rss / 1_048_576),
    heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
    node: process.version,
  }
}

/** Fast: for Render health checks, client preflight pings — no outbound provider calls. */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    llm: !!groq,
    tts: !!textToSpeechClient,
    email: !!resend,
    process: buildProcessInfo(),
  })
})

/** Slow: Groq + Resend usage probes (admin dashboard only). */
app.get('/api/health/deep', async (_req, res) => {
  const [groqUsage, resendUsage] = await Promise.all([probeGroqUsageHeaders(), probeResendUsageHeaders()])
  res.json({
    ok: true,
    llm: !!groq,
    tts: !!textToSpeechClient,
    email: !!resend,
    process: buildProcessInfo(),
    groqUsage,
    resendUsage,
  })
})

app.use((err, req, res, _next) => {
  if (res.headersSent) return
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: req.requestId,
      message: err?.message,
    })
  )
  res.status(500).json({ error: 'Internal server error.' })
})

const IS_RENDER = process.env.RENDER === 'true'
const HOST = process.env.BIND_HOST || '0.0.0.0'
let PORT
if (IS_RENDER) {
  PORT = Number.parseInt(String(process.env.PORT || ''), 10)
  if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Render requires a valid PORT environment variable',
        portEnv: process.env.PORT,
      })
    )
    process.exit(1)
  }
} else {
  PORT = Number.parseInt(String(process.env.PORT || ''), 10) || 3001
}

function startSelfPingOnRender() {
  if (process.env.ENABLE_SELF_PING === '0') return
  if (process.env.RENDER !== 'true') return
  const base = String(process.env.RENDER_EXTERNAL_URL || 'https://jobrush.onrender.com').replace(/\/$/, '')
  const intervalMs = Math.max(60_000, Number(process.env.SELF_PING_INTERVAL_MS) || 12 * 60 * 1000)
  setInterval(() => {
    fetch(`${base}/api/health`, {
      headers: { 'User-Agent': 'JobRush-self-ping/1' },
    }).catch((e) => console.error('[self-ping]', e?.message || e))
  }, intervalMs)
  console.log(
    `[self-ping] Render free tier keep-warm: GET /api/health every ${Math.round(intervalMs / 60000)} min → ${base}`
  )
}

app.listen(PORT, HOST, () => {
  const listenLog = {
    level: 'info',
    msg: 'JobRush API listening',
    host: HOST,
    port: PORT,
    groqTimeoutMs: GROQ_SDK_TIMEOUT_MS,
  }
  if (IS_RENDER) {
    listenLog.note =
      'Render forwards to this socket; use your *.onrender.com URL (or RENDER_EXTERNAL_URL) for HTTP checks — not localhost.'
    const ext = String(process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '')
    if (ext) listenLog.publicBaseUrl = ext
  }
  console.log(JSON.stringify(listenLog))
  console.log(`[email] New-user/payment alerts → ${ADMIN_NOTIFY_EMAIL} (override with ADMIN_NOTIFY_EMAIL)`)
  if (groq) {
    console.log(`[groq] Model: default=${GROQ_MODEL} (set GROQ_MODEL to override)`)
  } else {
    console.warn('Warning: API key not set. AI features will return errors.')
  }
  startSelfPingOnRender()
})
