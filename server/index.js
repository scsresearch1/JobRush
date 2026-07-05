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
const TOKENS_RECOMMENDATIONS = 6144
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
  let { content, finishReason } = await groqCompleteMessages(messages, maxTokens, model, temperature)
  if (finishReason === 'length' && maxTokens < GROQ_MAX_COMPLETION_TOKENS) {
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

async function callGroq(systemPrompt, userPrompt, maxTokens = TOKENS_EXPLAIN_ATS, model = GROQ_MODEL, jsonOutput = false) {
  const { content } = await groqComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens,
    model,
    0.25,
    { stripPartialTail: !jsonOutput }
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

function buildDeterministicFallbackRecommendations(resume, evaluation, deep) {
  const profile = deep?.profile || detectResumeProfile(resume)
  const fresher = deep?.fresher ?? isFresherResume(resume)
  const scores = evaluation?.scores?.all || []
  const filtered = filterScoresForRecommendations(scores, profile)
  const missingSkills = collectMissingSkills(filtered)
  const lowTargets = collectLowScoreEntities(filtered, 5)
  const projectHints = uniqueStrings((resume?.projects || []).map((p) => p?.name), 4)
  const firstProject = projectHints[0] || 'your strongest project'
  const firstProjectEntry = (resume?.projects || []).find((p) => p?.name === firstProject) || resume?.projects?.[0]
  const firstProjectBullet = extractBullets(firstProjectEntry, 1)[0] || 'your project description'
  const skillsSample = (resume?.skills || []).slice(0, 6).join(', ') || 'a thin skills list'
  const targetSample = lowTargets[0] || (profile === 'cs' ? 'TCS (campus hiring)' : 'relevant core employers')

  const recs = [
    {
      section: 'Skills',
      current: `Your skills section (${skillsSample}) does not yet signal the depth recruiters at ${targetSample} scan for in the first 10 seconds.`,
      suggestion: `Group skills into clear buckets (Languages, Frameworks/Tools, Databases, CS Fundamentals) and lead with the 6 skills you would actually discuss in a technical interview. ${missingSkills.length ? `Based on your ATS gaps, prioritize adding (only if true): ${missingSkills.slice(0, 5).map(toTitle).join(', ')}.` : 'Mirror the stack from your best project so skills and projects tell the same story.'}`,
      where: 'Skills section — first half of the resume',
      example: 'Languages: Java, Python, SQL | CS Fundamentals: DSA, OOP, DBMS | Tools: Git, REST APIs, Jupyter',
      evidence: skillsSample.slice(0, 120),
      valueAddition: 'Recruiters instantly see role-fit; ATS parsers match mandatory keywords for campus drives.',
      targetEmployers: lowTargets.slice(0, 4).join(', ') || deep?.targetEmployers?.slice(0, 80),
      impact: 'High',
    },
    {
      section: 'Projects',
      current: `Project "${firstProject}" reads as: "${String(firstProjectBullet).slice(0, 140)}" — the problem, your role, and outcome are not yet obvious.`,
      suggestion: `Expand this into 3 bullets: (1) problem & dataset/users, (2) what YOU built (stack + design choice), (3) measurable result (accuracy, latency, users, time saved). Tie the stack to employers like ${lowTargets.slice(0, 2).join(' or ') || 'your target companies'} without keyword stuffing.`,
      where: `Projects > ${firstProject}`,
      example: `Electricity Theft Detection — Built an ML pipeline (Python, Pandas, scikit-learn) on 12k meter readings; achieved 91% precision on held-out data and documented feature engineering steps recruiters can discuss.`,
      evidence: String(firstProjectBullet).slice(0, 120),
      valueAddition: 'Projects become interview stories; hiring managers see proof you can ship, not just list coursework.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    },
  ]

  if (fresher) {
    recs.push({
      section: 'Achievements',
      current: deep?.achievementsBlock?.includes('none explicitly') ? 'No achievements section — hackathons, coursework awards, or certifications are easy to miss.' : 'Achievements exist but are buried inside projects/education.',
      suggestion: 'Add a short Achievements block (3–5 lines): hackathon ranks, coding contest positions, relevant certifications (NPTEL, Coursera with grade), Dean\'s list, or open-source contributions. Keep each line one accomplishment with a number or credential.',
      where: 'Between Education and Projects (or after Skills)',
      example: '2nd place — College Hackathon 2025 (ML track) | NPTEL Python for Data Science — Elite + Gold | Published mini-project on GitHub with 40+ stars',
      evidence: deep?.achievementsBlock?.slice(0, 120) || 'No awards listed',
      valueAddition: 'Differentiates you from hundreds of similar fresher resumes with identical skill lists.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    })

    if ((deep?.internshipCount || 0) > 0) {
      recs.push({
        section: 'Internships',
        current: `You have ${deep.internshipCount} internship-style role(s) but they may read like job titles without outcomes.`,
        suggestion: 'Treat internships as mini full-time roles: 2–3 bullets each with stack, team context, and one metric. If it was remote/part-time, say so honestly — still highlight deliverables.',
        where: 'Internships section (separate from future full-time Experience)',
        example: 'Software Intern @ ABC — Automated report generation in Python, saving ~4 hours/week for the analytics team; presented findings to 5 stakeholders.',
        evidence: deep?.internshipsBlock?.slice(0, 120) || 'Internship listed',
        valueAddition: 'Shows workplace exposure even without full-time experience.',
        targetEmployers: lowTargets.slice(0, 3).join(', '),
        impact: 'High',
      })
    } else {
      recs.push({
        section: 'Internships',
        current: 'No internship is listed — many campus recruiters still shortlist candidates with strong projects + achievements.',
        suggestion: 'Do NOT invent an internship. Instead, strengthen projects and add a GitHub/portfolio link. If you have unpaid project work, label it clearly as "Academic Project" or "Personal Project", not as employment at a company.',
        where: 'Projects + header links',
        example: 'Added GitHub link with README, demo video, and reproducible notebook for the electricity theft detection project.',
        evidence: 'No internship entries',
        valueAddition: 'Keeps your resume honest while still competitive for fresher drives.',
        targetEmployers: lowTargets.slice(0, 3).join(', '),
        impact: 'Medium',
      })
    }

    recs.push({
      section: 'Summary',
      current: deep?.summary?.startsWith('(no') ? 'Missing professional summary — recruiters decide in 6 seconds whether to read projects.' : 'Summary may be generic and not anchored to your degree + best project.',
      suggestion: `Write 2–3 lines: degree + specialization (${deep?.profileLabel}), strongest stacks from your projects, and one proof point (project outcome, achievement, or internship). Speak in first person implied ("${resume?.name?.split(' ')?.[0] || 'Candidate'} — B.Tech CS graduate…").`,
      where: 'Top of resume — Professional Summary',
      example: 'B.Tech Computer Science graduate with hands-on ML projects (Python, SQL) and campus hackathon recognition; seeking entry-level software roles at product and IT services firms.',
      evidence: deep?.summary?.slice(0, 100) || 'No summary',
      valueAddition: 'Gives human context before the ATS keywords; helps non-technical recruiters understand your fit.',
      targetEmployers: lowTargets.slice(0, 4).join(', '),
      impact: 'Medium',
    })
  } else {
    const firstExp = partitionExperience(resume).fullTime[0]
    const weakBullet = extractBullets(firstExp, 1)[0] || 'a responsibility-heavy bullet'
    recs.push({
      section: 'Experience',
      current: `Full-time bullet: "${String(weakBullet).slice(0, 140)}" — impact is not quantified.`,
      suggestion: 'Rewrite top bullets as Action + Scope + Stack + Result. One metric per bullet (%, time, users, revenue, defects). Align verbs with the profile you want next.',
      where: `Experience > ${firstExp?.role || firstExp?.title || 'Role'} @ ${firstExp?.company || 'Company'}`,
      example: 'Engineered batch ETL jobs in Python + SQL serving 3 downstream dashboards, cutting manual reconciliation from 6 hours to 45 minutes per week.',
      evidence: String(weakBullet).slice(0, 120),
      valueAddition: 'Experienced recruiters scan for scale and outcomes, not task lists.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'High',
    })
  }

  if (projectHints.length > 1) {
    recs.push({
      section: 'Project Positioning',
      current: `Projects listed: ${projectHints.join(', ')} — order may not match ${profile === 'cs' ? 'software' : 'core'} recruiter priorities.`,
      suggestion: `Move the project closest to ${targetSample} requirements to the top. Add a one-line "why it matters" under the title (domain + stack).`,
      where: 'Projects section ordering',
      example: `Moved "${firstProject}" to #1 with subtitle: "ML classification on real utility data — Python, scikit-learn"`,
      evidence: projectHints.join(', ').slice(0, 100),
      valueAddition: 'Recruiters often read only the first project in depth.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'Medium',
    })

    for (let pi = 1; pi < Math.min(projectHints.length, 4); pi++) {
      const pname = projectHints[pi]
      const entry = (resume?.projects || []).find((p) => p?.name === pname) || resume?.projects?.[pi]
      const bullet = extractBullets(entry, 1)[0] || 'brief description'
      recs.push({
        section: 'Projects',
        current: `"${pname}" — "${String(bullet).slice(0, 130)}" needs clearer technical depth for campus technical rounds.`,
        suggestion: `For "${pname}", add: problem statement in one line, your individual contribution (not team-only), tech stack in parentheses, and one outcome metric. Prepare a 60-second verbal walkthrough recruiters use in TCS/Infosys technical screens.`,
        where: `Projects > ${pname}`,
        example: `${pname} — Designed REST API (Spring Boot, MySQL) for inventory tracking; reduced manual stock checks by automating daily reconciliation reports.`,
        evidence: String(bullet).slice(0, 100),
        valueAddition: 'Each additional strong project doubles your interview talking points.',
        targetEmployers: lowTargets.slice(0, 3).join(', '),
        impact: pi === 1 ? 'High' : 'Medium',
      })
    }
  }

  if (fresher && (resume?.education || []).length > 0) {
    const edu = resume.education[0]
    recs.push({
      section: 'Education',
      current: `${edu.degree || 'Degree'} at ${edu.institution || 'institution'} — coursework and CGPA may not be visible to recruiters scanning quickly.`,
      suggestion: 'List degree, branch, graduation year, and CGPA/percentage if above 7.5 (or omit if lower). Add 2–3 relevant coursework lines (DSA, DBMS, OS, ML) that match your projects.',
      where: 'Education section',
      example: 'B.Tech Computer Science, XYZ University (2025) | CGPA: 8.2 | Coursework: Data Structures, DBMS, Machine Learning, Computer Networks',
      evidence: `${edu.degree || ''} ${edu.institution || ''}`.trim().slice(0, 100),
      valueAddition: 'Campus eligibility filters often use degree + year; coursework signals depth beyond skill lists.',
      targetEmployers: lowTargets.slice(0, 3).join(', '),
      impact: 'Medium',
    })
  }

  recs.push({
    section: 'Formatting',
    current: 'Dense skill lists or missing section headers can hurt ATS parsing and human skim-reading.',
    suggestion: 'Use standard headings: Summary, Skills, Education, Projects, Achievements, Internships (if any), Experience (only if full-time). Avoid tables/icons. Keep dates consistent (MMM YYYY).',
    where: 'Overall layout',
    example: 'Replaced paragraph-style skills with categorized comma lists; added explicit "Projects" and "Achievements" headings.',
    evidence: 'Layout / parsing',
    valueAddition: 'Ensures both ATS and recruiters extract the right sections.',
    targetEmployers: 'All targets',
    impact: 'Medium',
  })

  return recs
}

function buildCoverageBoosterRecommendations(resume, missingSkills, deep) {
  const top = missingSkills.slice(0, 6).map(toTitle)
  if (!top.length) return []
  const fresher = deep?.fresher ?? isFresherResume(resume)
  const firstProject = (resume?.projects || [])[0]?.name || 'your lead project'

  const recs = [
    {
      section: 'Keyword Coverage',
      current: `Skills like ${top.slice(0, 3).join(', ')} appear in ATS gaps for your target employers but are not woven through your resume narrative.`,
      suggestion: fresher
        ? `Add 2 terms to Skills, 2 to your "${firstProject}" project bullets, and mention 1 in your summary — only where you can explain them in an interview. Avoid listing Cisco/core-hardware employers if you are a CS candidate; focus on ${deep?.targetEmployers?.slice(0, 60) || 'IT services and product firms'}.`
        : `Spread ${top.join(', ')} across Skills, Experience, and Projects naturally — one term per section minimum.`,
      where: fresher ? 'Skills + Projects + Summary' : 'Skills + Experience + Projects',
      example: `Added "Agile" and "Git" under Tools; referenced "SQL" in project data pipeline bullet for ${firstProject}.`,
      evidence: top.join(', ').slice(0, 100),
      valueAddition: 'Raises ATS match scores without reading as keyword stuffing when tied to real work.',
      targetEmployers: deep?.targetEmployers?.slice(0, 80) || top.join(', '),
      impact: 'High',
    },
  ]

  if (!fresher) {
    const expRole = uniqueStrings((resume?.experience || []).map((e) => e?.role || e?.title), 1)[0] || 'your role'
    recs.push({
      section: 'Experience Alignment',
      current: 'Experience bullets may not reflect the stacks your target employers filter on.',
      suggestion: `For ${expRole}, rewrite 2 bullets with "action + stack + outcome" and include one missing keyword from: ${top.slice(0, 3).join(', ')}.`,
      where: `Experience > ${expRole}`,
      example: 'Implemented CI/CD in GitHub Actions for a Node.js service, reducing release turnaround time by 40%.',
      evidence: expRole,
      valueAddition: 'Connects work history to the next role you are targeting.',
      targetEmployers: deep?.targetEmployers?.slice(0, 80) || '',
      impact: 'High',
    })
  }

  return recs
}

function shapeRecommendationList(items, fallbackItems, minCount = 12, maxCount = 15, { fresher = false, profile = 'cs' } = {}) {
  const dedupe = new Set()
  const out = []
  const bannedForFresher = /^experience$/i

  const pushUnique = (r) => {
    const sanitized = sanitizeRecommendationForProfile(r, { fresher, profile })
    if (!sanitized) return
    const section = String(sanitized?.section || '').trim().slice(0, 64)
    if (fresher && bannedForFresher.test(section)) return
    const suggestion = String(sanitized?.suggestion || '').trim().slice(0, 1200)
    if (!section || !suggestion) return
    if (/create an experience section|no experience section/i.test(`${sanitized?.current} ${suggestion}`) && fresher) return
    if (/software engineer @ infosys|@ infosys, developed/i.test(suggestion) && fresher) return
    const key = `${section.toLowerCase()}|${suggestion.toLowerCase().slice(0, 80)}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    out.push({
      section,
      current: String(sanitized?.current || 'Needs optimization').trim().slice(0, 400),
      suggestion,
      where: String(sanitized?.where || sanitized?.location || sanitized?.target || '').trim().slice(0, 200) || section,
      example: String(sanitized?.example || '').trim().slice(0, 420),
      evidence: String(sanitized?.evidence || '').trim().slice(0, 220),
      valueAddition: String(sanitized?.valueAddition || sanitized?.value_addition || '').trim().slice(0, 320),
      targetEmployers: String(sanitized?.targetEmployers || sanitized?.target_employers || '').trim().slice(0, 200),
      impact: String(sanitized?.impact || '').trim().toLowerCase() === 'high' ? 'High' : 'Medium',
    })
  }

  for (const item of items || []) pushUnique(item)
  for (const item of fallbackItems || []) {
    if (out.length >= maxCount) break
    pushUnique(item)
  }

  if (out.length >= minCount) return out.slice(0, maxCount)
  return (fallbackItems || []).slice(0, maxCount).map((r) => ({
    section: String(r?.section || 'General').trim().slice(0, 64),
    current: String(r?.current || 'Needs optimization').trim().slice(0, 400),
    suggestion: String(r?.suggestion || 'Improve role relevance and ATS keyword coverage.').trim().slice(0, 1200),
    where: String(r?.where || r?.location || r?.target || '').trim().slice(0, 200) || String(r?.section || 'General'),
    example: String(r?.example || '').trim().slice(0, 420),
    evidence: String(r?.evidence || '').trim().slice(0, 220),
    valueAddition: String(r?.valueAddition || '').trim().slice(0, 320),
    targetEmployers: String(r?.targetEmployers || '').trim().slice(0, 200),
    impact: String(r?.impact || '').trim().toLowerCase() === 'high' ? 'High' : 'Medium',
  })).filter((r) => !(fresher && bannedForFresher.test(r.section)))
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
    const weakAreas = collectWeakDimensions(filteredScores)
    const lowScoreTargets = collectLowScoreEntities(filteredScores, 10)

    const fresherRules = fresher
      ? `CANDIDATE IS A FRESHER (no substantive full-time experience). STRICT RULES:
- Do NOT recommend creating fake full-time jobs or "Experience" sections at companies they never worked at.
- Do NOT suggest "Software Engineer @ Infosys" or similar invented roles.
- Focus ONLY on: Skills, Projects, Achievements, Internships (if listed), Education, Summary, Formatting, Project Positioning.
- At least 4 recommendations must be about Projects with specific rewrites from their project text.
- At least 2 about Skills/Achievements.`
      : `Candidate has full-time experience — you may include Experience recommendations with real companies from their resume only.`

    const profileRules =
      profile === 'cs'
        ? `PROFILE: Computer Science / IT. Target ONLY these employers in targetEmployers: IT services, consulting, product software (TCS, Infosys, Wipro, Cognizant, Accenture, HCL, IBM, Oracle, SAP, Adobe, OpenText, MAANG). Do NOT reference Cisco, Intel, NVIDIA, Qualcomm, Tata Motors, Bosch, BHEL, L&T civil, or other core/hardware employers.`
        : `PROFILE: ${deep.profileLabel}. Target employers relevant to this core branch only — not generic IT services unless their degree is dual/CS.`

    const systemPrompt = `You are an experienced campus placement counselor writing resume feedback for Indian graduates. Sound human, direct, and encouraging — write to the candidate as "you", not third person.

Output ONLY a valid JSON array of 12-15 objects with these exact keys:
- section (Skills|Projects|Achievements|Internships|Education|Summary|Formatting|Project Positioning|Keyword Coverage|Experience only if NOT a fresher)
- current (quote their actual resume text — project name, skill list, or bullet)
- suggestion (4-6 sentences: what to change, why recruiters care, how it helps campus shortlists — not keyword stuffing)
- where (exact location on resume)
- example (copy-paste-ready rewrite using THEIR project names and stacks)
- evidence (verbatim snippet, max 120 chars)
- valueAddition (one sentence: what the candidate gains — interview talking point, shortlist odds, clarity)
- targetEmployers (2-4 comma-separated companies from the allowed list for their profile)
- impact (High|Medium)

${fresherRules}
${profileRules}

Global rules:
1) Never invent employers, internships, or jobs not in the resume.
2) Every suggestion must cite something specific from their projects, skills, or education.
3) Explain VALUE — why this edit helps a human recruiter, not just ATS keywords.
4) No markdown, no extra keys.`

    const userPrompt = `CANDIDATE: ${deep.contact || resume?.name || '—'}
PROFILE: ${deep.profileLabel} | FRESHER: ${fresher ? 'YES' : 'NO'}
ALLOWED TARGET EMPLOYERS: ${deep.targetEmployers}

SUMMARY:
${deep.summary}

SKILLS:
${deep.skillsList}

EDUCATION:
${deep.educationBlock}

ACHIEVEMENTS / AWARDS (extracted):
  ${deep.achievementsBlock}

INTERNSHIPS (if any):
${deep.internshipsBlock}

FULL-TIME EXPERIENCE:
${deep.experienceBlock}

PROJECTS (verbatim):
${deep.projectBlock}

WEAK PROJECT BULLETS:
  ${deep.weakProjectBulletsBlock}

ATS SUMMARY: mass hiring ${evaluation?.summary?.avgMassHiring ?? 'N/A'}% | MAANG ${evaluation?.summary?.avgMaang ?? 'N/A'}%

RELEVANT PER-TARGET GAPS (profile-filtered, lowest first):
${deep.entityGapsBlock}

TOP MISSING SKILLS: ${missingSkills.slice(0, 12).map(toTitle).join(', ') || 'N/A'}
WEAKEST DIMENSIONS: ${weakAreas.join(', ') || 'N/A'}
LOWEST SCORING TARGETS: ${lowScoreTargets.join(', ') || 'N/A'}

Return JSON array only (12-15 items).`

    const raw = await callGroq(systemPrompt, userPrompt, TOKENS_RECOMMENDATIONS, GROQ_MODEL, true)
    const llmRecommendations = parseJsonArraySalvage(raw)
      .filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          String(r.section || '').trim() &&
          String(r.suggestion || '').trim()
      )
    const fallback = [
      ...buildDeterministicFallbackRecommendations(resume, evaluation, deep),
      ...buildCoverageBoosterRecommendations(resume, missingSkills, deep),
    ]
    const recommendations = shapeRecommendationList(llmRecommendations, fallback, 12, 15, { fresher, profile })
    res.json({ recommendations, meta: { profile, profileLabel: deep.profileLabel, fresher } })
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
