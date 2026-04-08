/**
 * JobRush API - LLM for ATS explanations and recommendations
 * Run: node server/index.js (requires API key in env)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })
import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'
import { Resend } from 'resend'
const app = express()

// CORS: reflect request origin (required by some proxies)
const ALLOWED_ORIGINS = ['https://jbrush.netlify.app', 'http://localhost:5173', 'http://localhost:3000']
app.use((req, res, next) => {
  const origin = req.headers.origin
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.netlify.app')) ? origin : '*'
  res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})
app.use(
  cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] })
)
app.use(express.json({ limit: '1mb' }))

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

/** Default: smaller/faster model to stay within Groq free-tier limits. Set GROQ_MODEL to override. */
const GROQ_MODEL = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim()
/** Used only for full-resume JSON rewrite where 8B may truncate or break JSON. Set GROQ_MODEL_HEAVY= same as GROQ_MODEL to force one model everywhere. */
const GROQ_MODEL_HEAVY = String(process.env.GROQ_MODEL_HEAVY || 'llama-3.3-70b-versatile').trim()

const MAX_CHAT_TURNS = 8
const MAX_CHAT_MSG_CHARS = 8000
const RESUME_LLM_MAX_STR = 2000
/** Groq completion ceiling for this app (avoid mid-stream cuts; models typically allow ≤ 8k). */
const GROQ_MAX_COMPLETION_TOKENS = 8192
const TOKENS_EXPLAIN_ATS = 2048
const TOKENS_RECOMMENDATIONS = 2048
const TOKENS_APPLY_CORRECTION = 8192
const TOKENS_SOP = 2048
const TOKENS_COVER_LETTER = 2048
const TOKENS_INTERVIEW_TIPS = 2048
const TOKENS_CHAT_REPLY = 2048
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
  const out = await resend.emails.send(payload)
  if (out?.error) throw new Error(out.error.message || 'Resend rejected the email request.')
  return out?.data?.id || null
}

function truncateStringsDeep(val, maxLen, seen = new WeakSet()) {
  if (val == null) return val
  if (typeof val === 'string') return val.length > maxLen ? `${val.slice(0, maxLen)}…` : val
  if (typeof val !== 'object') return val
  if (seen.has(val)) return val
  seen.add(val)
  if (Array.isArray(val)) return val.map((x) => truncateStringsDeep(x, maxLen, seen))
  const o = {}
  for (const [k, v] of Object.entries(val)) {
    o[k] = truncateStringsDeep(v, maxLen, seen)
  }
  return o
}

/** Compact JSON (no whitespace) to minimize prompt tokens. */
function compactJson(obj) {
  return JSON.stringify(obj)
}

async function groqCompleteMessages(messages, maxTokens, model, temperature) {
  if (!groq) {
    throw new Error('AI service not configured. Add the required API key to your environment.')
  }
  const completion = await groq.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  })
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

    const systemPrompt = `Resume coach. Output ONLY a JSON array of 3-4 objects: section, current, suggestion, impact (High|Medium). Short suggestion text. No markdown.`
    const skills = (resume?.skills || []).slice(0, 35).join(', ')
    const exp = (resume?.experience || [])
      .slice(0, 6)
      .map((e) => `${e.role || e.title}@${e.company}`)
      .join('; ')
    const userPrompt = `Resume: ${resume?.name || '—'} | skills: ${skills || 'None'} | exp: ${exp || 'None'} | edu: ${(resume?.education || []).slice(0, 3).map((e) => e.degree).join('; ') || 'None'} | projects: ${(resume?.projects || []).slice(0, 5).map((p) => p.name).join('; ') || 'None'}
ATS avg: mass ${evaluation?.summary?.avgMassHiring ?? 'N/A'}% maang ${evaluation?.summary?.avgMaang ?? 'N/A'}% ivy ${evaluation?.summary?.avgIvyLeague ?? 'N/A'}
Missing skills (sample): ${[...new Set((evaluation?.scores?.all || []).flatMap((s) => s.missing_mandatory || []))].slice(0, 8).join(', ') || 'N/A'}
JSON only: [{"section":"Skills","current":"...","suggestion":"...","impact":"High"},...]`

    const raw = await callGroq(systemPrompt, userPrompt, TOKENS_RECOMMENDATIONS, GROQ_MODEL, true)
    let recommendations = parseJsonArraySalvage(raw).filter(
      (r) =>
        r &&
        typeof r === 'object' &&
        String(r.section || '').trim() &&
        String(r.suggestion || '').trim()
    )
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      recommendations = [
        {
          section: 'General',
          current: '—',
          suggestion: 'We could not load complete recommendations. Please try again in a moment.',
          impact: 'Medium',
        },
      ]
    }
    res.json({ recommendations })
  } catch (err) {
    console.error('recommendations error:', err)
    const status = err.message?.includes('not configured') ? 503 : 500
    res.status(status).json({
      error: err.message || 'Failed to generate recommendations',
    })
  }
})

/** Merge LLM output with original resume - never lose name, email, phone, or any entry */
function mergeResumePreservingOriginal(original, modified) {
  const out = { ...modified }
  out.name = (modified.name || '').trim() || (original.name || '').trim()
  out.email = (modified.email || '').trim() || (original.email || '').trim()
  out.phone = (modified.phone || '').trim() || (original.phone || '').trim()
  const origSkills = original.skills || []
  const modSkills = modified.skills || []
  out.skills = modSkills.length >= origSkills.length ? modSkills : [...origSkills]
  const origExp = original.experience || []
  const modExp = modified.experience || []
  out.experience = modExp.length >= origExp.length ? modExp : origExp.map((e, i) => ({ ...e, ...(modExp[i] || {}) }))
  const origEdu = original.education || []
  const modEdu = modified.education || []
  out.education = modEdu.length >= origEdu.length ? modEdu : origEdu.map((e, i) => ({ ...e, ...(modEdu[i] || {}) }))
  const origProj = original.projects || []
  const modProj = modified.projects || []
  out.projects = modProj.length >= origProj.length ? modProj : origProj.map((e, i) => ({ ...e, ...(modProj[i] || {}) }))
  return out
}

/**
 * POST /api/apply-correction
 * Body: { resume, recommendation }
 * Returns modified resume with correction applied
 */
app.post('/api/apply-correction', async (req, res) => {
  try {
    const { resume, recommendation } = req.body
    if (!resume || !recommendation) {
      return res.status(400).json({ error: 'resume and recommendation required' })
    }

    const systemPrompt = `Resume editor. Input: resume JSON + one suggestion. Output: single valid JSON object only—same schema as input (name,email,phone,skills,experience,education,projects). Apply ONLY that suggestion to that section; keep everything else identical. Never drop entries.`

    const resumeCompact = compactJson(truncateStringsDeep(resume, RESUME_LLM_MAX_STR))
    const userPrompt = `Resume:${resumeCompact}
Section: ${recommendation.section}
Suggestion: ${String(recommendation.suggestion || '').slice(0, 2500)}
Return full resume JSON only.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
    const { content: raw } = await groqComplete(messages, TOKENS_APPLY_CORRECTION, GROQ_MODEL_HEAVY, 0.25, {
      stripPartialTail: false,
    })
    let modified = resume
    if (raw) {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          modified = JSON.parse(jsonMatch[0])
          modified = mergeResumePreservingOriginal(resume, modified)
        }
      } catch {
        modified = resume
      }
    }
    res.json({ resume: modified })
  } catch (err) {
    console.error('apply-correction error:', err)
    res.status(500).json({ error: err.message || 'Failed to apply correction' })
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
    const subject = isApproved
      ? 'Your JobRush access is now active'
      : 'Action required: JobRush payment verification'
    const text = isApproved
      ? [
          `Hello,`,
          ``,
          `Great news. Your JobRush payment has been verified and your access is now active.`,
          paymentReference ? `Payment reference: ${paymentReference}` : null,
          `Activation time: ${approvedAt}`,
          ``,
          `You can now use your included ATS checks and mock interview sessions.`,
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
          <p>Great news. Your <strong>JobRush</strong> payment has been verified and your access is now active.</p>
          <p>
            ${paymentReference ? `<strong>Payment reference:</strong> ${esc(paymentReference)}<br/>` : ''}
            <strong>Activation time:</strong> ${esc(approvedAt)}
          </p>
          <p>You can now use your included ATS checks and mock interview sessions.</p>
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, llm: !!groq, tts: !!textToSpeechClient, email: !!resend })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`JobRush API running on http://localhost:${PORT}`)
  console.log(`[email] New-user/payment alerts → ${ADMIN_NOTIFY_EMAIL} (override with ADMIN_NOTIFY_EMAIL)`)
  if (groq) {
    console.log(`[groq] Models: default=${GROQ_MODEL} apply-correction=${GROQ_MODEL_HEAVY} (set GROQ_MODEL / GROQ_MODEL_HEAVY to override)`)
  } else {
    console.warn('Warning: API key not set. AI features will return errors.')
  }
})
