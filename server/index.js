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

const MODEL = 'llama-3.3-70b-versatile'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const ADMIN_API_SECRET = String(process.env.ADMIN_API_SECRET || '').trim()
const DEFAULT_FIREBASE_RTDB_URL = 'https://jobrush-f2eb4-default-rtdb.asia-southeast1.firebasedatabase.app'
const FIREBASE_DATABASE_URL = String(process.env.FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_RTDB_URL).replace(/\/+$/, '')
const DEFAULT_NEW_USER_NOTIFY_TO = 'hirefortune90@gmail.com'

const MAIL_FROM_NEW_USER = 'JobRush Onboarding Team <newuser@fortunehire.in>'
const MAIL_FROM_WELCOME = 'JobRush Access Team <welcome@fortunehire.in>'
const MAIL_FROM_REPORTS = 'JobRush Reports Desk <reports@fortunehire.in>'

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

function cleanEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendResendMail({ from, to, subject, html, text }) {
  if (!resend) throw new Error('Email service not configured. Add RESEND_API_KEY.')
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  }
  const out = await resend.emails.send(payload)
  if (out?.error) throw new Error(out.error.message || 'Resend rejected the email request.')
  return out?.data?.id || null
}

let cachedNotifyRecipient = { email: DEFAULT_NEW_USER_NOTIFY_TO, fetchedAt: 0 }
const NOTIFY_RECIPIENT_TTL_MS = 60_000

async function getNewUserNotifyRecipient() {
  const now = Date.now()
  if (now - cachedNotifyRecipient.fetchedAt < NOTIFY_RECIPIENT_TTL_MS) {
    return cachedNotifyRecipient.email
  }
  try {
    const resp = await fetch(`${FIREBASE_DATABASE_URL}/adminPortal/emailWorkflow/newUserNotifyTo.json`, {
      method: 'GET',
    })
    if (!resp.ok) throw new Error(`RTDB read failed: ${resp.status}`)
    const raw = await resp.json()
    const next = cleanEmail(raw)
    cachedNotifyRecipient = {
      email: next && next.includes('@') ? next : DEFAULT_NEW_USER_NOTIFY_TO,
      fetchedAt: now,
    }
  } catch (err) {
    console.warn('new-user notify recipient fallback:', err.message)
    cachedNotifyRecipient = { email: DEFAULT_NEW_USER_NOTIFY_TO, fetchedAt: now }
  }
  return cachedNotifyRecipient.email
}

async function callGroq(systemPrompt, userPrompt, maxTokens = 1024) {
  if (!groq) {
    throw new Error('AI service not configured. Add the required API key to your environment.')
  }
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  })
  return completion.choices[0]?.message?.content?.trim() || ''
}

async function chatGroq(messages, maxTokens = 1024) {
  if (!groq) {
    throw new Error('AI service not configured. Add the required API key to your environment.')
  }
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.5,
  })
  return completion.choices[0]?.message?.content?.trim() || ''
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

    const systemPrompt = `You are an ATS expert. Explain resume evaluation results clearly. Use plain text only—NO asterisks, NO markdown, NO bullet symbols. Write each point on its own line. Never output empty lines. Focus on strengths, weaknesses, and improvement suggestions.`
    const userPrompt = `Explain why the ATS score for ${entity} is ${score}%.

Input data:
- Matched mandatory skills: ${matchedMandatory.join(', ') || 'None'}
- Missing mandatory skills: ${missingMandatory.join(', ') || 'None'}
- Matched preferred skills: ${matchedPreferred.join(', ') || 'None'}
- Missing preferred skills: ${missingPreferred.join(', ') || 'None'}
- Score breakdown: Mandatory ${breakdown.mandatory_skill_score ?? 'N/A'}%, Preferred ${breakdown.preferred_skill_score ?? 'N/A'}%, Projects ${breakdown.project_relevance ?? 'N/A'}, Education ${breakdown.education_match ?? 'N/A'}, Formatting ${breakdown.formatting_score ?? 'N/A'}

Provide each point on a new line. Format:
Strengths:
- Point one
- Point two

Weaknesses:
- Point one
- Point two

Top 3 improvement suggestions:
- Suggestion one
- Suggestion two
- Suggestion three

Use plain dashes or nothing. No asterisks. No numbers.`

    const explanation = await callGroq(systemPrompt, userPrompt)
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

    const systemPrompt = `You are a career coach and resume expert. Generate specific, actionable resume improvement recommendations. Each recommendation should have: section, current (what they have), suggestion (what to change/add), and impact (High/Medium). Be specific—reference actual skills, companies, or projects from the resume. Prioritize by impact. In the suggestion field, use clear bullet points with real content—never output empty bullets or orphaned asterisks.`
    const userPrompt = `Based on this resume and ATS evaluation, generate 4-6 improvement recommendations.

Resume summary:
- Name: ${resume?.name || '—'}
- Email: ${resume?.email || '—'}
- Phone: ${resume?.phone || '—'}
- Skills: ${(resume?.skills || []).join(', ') || 'None'}
- Experience: ${(resume?.experience || []).map(e => `${e.role || e.title} at ${e.company}`).join('; ') || 'None'}
- Education: ${(resume?.education || []).map(e => e.degree).join('; ') || 'None'}
- Projects: ${(resume?.projects || []).map(p => p.name).join('; ') || 'None'}

ATS evaluation summary:
- Average scores: Mass hiring ${evaluation?.summary?.avgMassHiring ?? 'N/A'}%, MAANG ${evaluation?.summary?.avgMaang ?? 'N/A'}%, Ivy League ${evaluation?.summary?.avgIvyLeague ?? 'N/A'}%
- Common missing skills across profiles: ${[...new Set((evaluation?.scores?.all || []).flatMap(s => s.missing_mandatory || []))].slice(0, 10).join(', ') || 'N/A'}

Respond in JSON array format only, no other text:
[{"section":"Skills","current":"...","suggestion":"...","impact":"High"}, ...]`

    const raw = await callGroq(systemPrompt, userPrompt)
    let recommendations = []
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0])
      }
    } catch {
      recommendations = [{ section: 'General', current: '-', suggestion: raw.slice(0, 200), impact: 'Medium' }]
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

    const systemPrompt = `You are a resume editor. Given a resume (JSON) and an improvement suggestion, return the modified resume as valid JSON.

CRITICAL RULES:
- Apply ONLY the suggested change to the indicated section. Leave all other sections UNCHANGED.
- You MUST include every field from the original resume: name, email, phone, skills, experience, education, projects.
- NEVER omit name, email, or phone. Copy them exactly from the input.
- NEVER remove or drop any experience entry, education entry, or project. Only ADD or EDIT within the suggested section.
- Output the complete resume JSON only, no other text.`

    const userPrompt = `Resume:
${JSON.stringify(resume, null, 2)}

Suggestion (${recommendation.section}): ${recommendation.suggestion}

Return the modified resume as valid JSON. Apply the suggestion. Preserve name, email, phone, and all other entries. Output JSON only.`

    // Full resume JSON in / out needs a large completion budget (default 1024 truncates and breaks JSON).
    const raw = await callGroq(systemPrompt, userPrompt, 8192)
    let modified = resume
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        modified = JSON.parse(jsonMatch[0])
        modified = mergeResumePreservingOriginal(resume, modified)
      }
    } catch {
      modified = resume
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

    const systemPrompt = `You are an expert academic advisor. Write compelling Statements of Purpose for university admissions. Use plain text only—NO asterisks, NO markdown, NO bullet symbols. Write in formal paragraphs. Reference the candidate's actual resume data. Be specific and authentic.`
    const userPrompt = `Write a Statement of Purpose (2-4 paragraphs) for this candidate:

Candidate resume:
- Name: ${resume.name || '—'}
- Education: ${(resume.education || []).map(e => `${e.degree} from ${e.institution}`).join('; ') || '—'}
- Experience: ${(resume.experience || []).map(e => `${e.role || e.title} at ${e.company}`).join('; ') || '—'}
- Skills: ${(resume.skills || []).slice(0, 15).join(', ') || '—'}
- Projects: ${(resume.projects || []).map(p => p.name).join('; ') || '—'}

Target: ${targetProgram || 'Graduate program'} at ${targetUniversity || 'the university'}

Include: 1) Why this program/university, 2) Relevant background and achievements, 3) Career goals and how this program fits. Output the SOP text only, no other text.`

    const raw = await callGroq(systemPrompt, userPrompt, 1500)
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

    const systemPrompt = `You are an expert career coach. Write professional cover letters for job applications. Use plain text only—NO asterisks, NO markdown. Write in formal paragraphs with a proper greeting and sign-off. Reference the candidate's actual resume data. Be specific and authentic.`
    const userPrompt = `Write a cover letter (3-5 paragraphs) for this candidate:

Candidate resume:
- Name: ${resume.name || '—'}
- Email: ${resume.email || '—'}
- Skills: ${(resume.skills || []).slice(0, 15).join(', ') || '—'}
- Experience: ${(resume.experience || []).map(e => `${e.role || e.title} at ${e.company}${e.duration ? ' (' + e.duration + ')' : ''}`).join('; ') || '—'}
- Education: ${(resume.education || []).map(e => e.degree).join('; ') || '—'}
- Projects: ${(resume.projects || []).map(p => p.name).join('; ') || '—'}

Target: ${targetRole || 'the position'} at ${targetCompany || 'the company'}

Include: 1) Opening paragraph expressing interest, 2) Relevant background and key achievements, 3) Why you're a fit for the role/company, 4) Closing with call to action. End with "Sincerely," followed by the candidate's name. Output the cover letter text only, no other text.`

    const raw = await callGroq(systemPrompt, userPrompt, 1500)
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
    const systemPrompt = `You are an expert interview coach. Based on behavioral metrics from a mock interview (eye-contact, face visibility, head stability, blink rate, emotional expression), generate 4-6 specific, actionable correction tips. Each tip should be: 1) Short and punchy (one sentence), 2) Tied to a specific metric when relevant, 3) Practical and easy to implement. Use emotion data to give expression-specific advice (e.g. high fear/surprise→calm nerves; low happy→slight smile; stress indicators→breathing). Use a friendly, encouraging tone. Output JSON array only: [{"tip":"...","area":"eye-contact|visibility|stability|expression|general","priority":1}] where priority 1=highest. No other text.`
    const safeFix = (n, d) => {
      const x = (n != null && Number.isFinite(Number(n))) ? Number(n) : 0
      return x.toFixed(typeof d === 'number' ? d : 1)
    }
    const emotionDist = overall.avgEmotionDistribution && typeof overall.avgEmotionDistribution === 'object' ? overall.avgEmotionDistribution : {}
    const emotionStr = Object.entries(emotionDist)
      .filter(([, v]) => v > 0.02)
      .map(([k, v]) => `${k} ${safeFix((v ?? 0) * 100, 0)}%`)
      .join(', ') || 'N/A'
    const qSummaries = questionTimelines.map((q, i) => {
      const s = q?.timeline?.summary && typeof q.timeline.summary === 'object' ? q.timeline.summary : {}
      const qec = safeFix(safeNum(s.meanEyeContactRatio, 0) * 100, 0)
      const qfv = safeFix(safeNum(s.meanFaceVisibility, 0) * 100, 0)
      const qDist = s.questionAnalysis?.emotionalProbabilityDistribution || {}
      const qEmo = (Object.entries(qDist).filter(([, v]) => v > 0.1).map(([k, v]) => `${k} ${safeFix((v ?? 0) * 100, 0)}%`).join(', ') || s.dominantEmotion) ?? 'N/A'
      return `Q${i + 1} (${q?.type ?? 'unknown'}): confidence ${s.confidence ?? 0}, eye-contact ${qec}%, visibility ${qfv}%, emotions: ${qEmo}`
    }).join('; ') || 'None'
    const posRatio = safeFix((overall.positiveExpressionRatio ?? 1) * 100, 0)
    const stressRatio = safeFix((overall.stressIndicatorRatio ?? 0) * 100, 0)
    const userPrompt = `Behavioral metrics:
- Visual Confidence score: ${overall.confidence ?? 0}/100
- Eye-contact ratio: ${safeFix(ec, 1)}%
- Face visibility: ${safeFix(fv, 1)}%
- Head stability: ${safeFix(hs, 1)}%
- Emotional stability: ${safeFix(es, 1)}%
- Blink rate: ${safeFix(br, 2)}/s
- Positive expression ratio (neutral+happy): ${posRatio}%
- Stress indicators (fear+anger+sadness): ${stressRatio}%
- Emotion distribution: ${emotionStr}

Per-question summaries: ${qSummaries}

Generate 4-6 correction tips as JSON array. Be specific to these metrics. Use emotion data for expression-related tips.`

    const raw = await callGroq(systemPrompt, userPrompt)
    let recommendations = []
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0])
      }
    } catch {
      recommendations = [{ tip: raw.slice(0, 150) || 'Practice maintaining eye contact and steady posture.', area: 'general', priority: 1 }]
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

const SELECTRA_SYSTEM = `You are Selectra, the friendly Help Center assistant for JobRush.ai, a career acceleration platform.

Your role:
- Answer job-related questions: resume tips, ATS optimization, interview preparation, career advice, cover letters, SOPs, and job search strategies.
- Answer questions about JobRush.ai: what the platform does, its features (resume upload, ATS scoring, mock interviews, SOP & cover letter generation), how to get started, and general usage.
- Be helpful, concise, and professional. Use clear paragraphs. You may use bullet points when listing items.
- Keep responses focused and reasonably brief unless the user asks for detail.

CRITICAL - You must NEVER disclose:
- Any LLM, AI model, or API provider names (e.g. Groq, Llama, GPT, Claude, etc.)
- Technology stack, frameworks, programming languages, or implementation details
- How the system is built or what powers it internally

If asked about technology, architecture, or "what AI" you use, politely decline: "I'm not able to discuss technical implementation details. I'm here to help with career advice and questions about JobRush.ai. How can I assist you?"`

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
      .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, 8000) }))
      .filter((m) => m.content.length > 0)
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'messages must have role and content' })
    }
    const fullMessages = [{ role: 'system', content: SELECTRA_SYSTEM }, ...trimmed]
    const reply = await chatGroq(fullMessages, 1024)
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
    const notifyRecipient = await getNewUserNotifyRecipient()
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
    })
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
    })
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
    })
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
  if (!groq) console.warn('Warning: API key not set. AI features will return errors.')
})
