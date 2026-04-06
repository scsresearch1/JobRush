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
import nodemailer from 'nodemailer'

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
 * Body: { email, paymentReference, couponCode? }
 * Sends an internal notification email (SMTP must be configured on this server).
 */
app.post('/api/notify-new-payment-request', async (req, res) => {
  try {
    const { email, paymentReference, couponCode } = req.body || {}
    const userEmail = String(email || '').trim()
    const ref = String(paymentReference || '').trim()
    if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return res.status(400).json({ error: 'A valid user email is required.' })
    }
    if (ref.length < 6) {
      return res.status(400).json({ error: 'Payment reference must be at least 6 characters.' })
    }

    const notifyTo = String(process.env.PAYMENT_NOTIFY_TO || 'hirefortune90@gmail.com').trim()
    const mailer = await resolveMailer()
    if (!mailer) {
      return res.status(503).json({
        error:
          'Email is not configured on the server. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional MAIL_FROM) on the API host, or configure outbound email in admin Settings plus FIREBASE_DATABASE_URL.',
      })
    }

    const couponLine =
      couponCode && String(couponCode).trim()
        ? `Coupon code (submitted): ${String(couponCode).trim()}\n`
        : 'Coupon code: (none submitted)\n'

    const text =
      `A new user has submitted a payment access request.\n\n` +
      `User email: ${userEmail}\n` +
      `Payment reference (UPI / transaction ID): ${ref}\n` +
      `${couponLine}\n` +
      `Server received at: ${new Date().toISOString()}\n`

    const subject = 'Urgent-New User'

    try {
      await mailer.transport.sendMail({
        from: mailer.from,
        to: notifyTo,
        replyTo: userEmail,
        subject,
        text,
      })
      res.json({ ok: true })
    } catch (e) {
      console.error('notify-new-payment-request sendMail:', e)
      res.status(500).json({ error: e.message || 'Failed to send notification email.' })
    }
  } catch (err) {
    console.error('notify-new-payment-request:', err)
    res.status(500).json({ error: err.message || 'Unexpected error' })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, llm: !!groq, tts: !!textToSpeechClient })
})

const RTDB_EMAIL_OUTBOUND_PATH = 'adminPortal/emailOutbound'
/** @type {{ at: number, val: object | null, ok: boolean }} */
let emailOutboundCache = { at: 0, val: null, ok: false }

async function fetchEmailOutboundFromRtdb() {
  if (Date.now() - emailOutboundCache.at < 30_000 && emailOutboundCache.ok) {
    return emailOutboundCache.val
  }
  const base = process.env.FIREBASE_DATABASE_URL
  if (!base) {
    emailOutboundCache = { at: Date.now(), val: null, ok: true }
    return null
  }
  try {
    const url = `${base.replace(/\/$/, '')}/${RTDB_EMAIL_OUTBOUND_PATH}.json`
    const r = await fetch(url)
    if (!r.ok) {
      emailOutboundCache = { at: Date.now(), val: null, ok: true }
      return null
    }
    const val = await r.json()
    emailOutboundCache = { at: Date.now(), val, ok: true }
    return val && typeof val === 'object' ? val : null
  } catch (e) {
    console.warn('fetchEmailOutboundFromRtdb:', e?.message || e)
    emailOutboundCache = { at: Date.now(), val: null, ok: true }
    return null
  }
}

/**
 * Env vars override Firebase per field. If using only the admin UI, set FIREBASE_DATABASE_URL on this server.
 * @returns {Promise<{ transport: import('nodemailer').Transporter, from: string } | null>}
 */
async function resolveMailer() {
  const db = await fetchEmailOutboundFromRtdb()
  const host = process.env.SMTP_HOST || (db && String(db.smtpHost || '').trim()) || ''
  const user = process.env.SMTP_USER || (db && String(db.smtpUser || '').trim()) || ''
  const pass = process.env.SMTP_PASS || (db && String(db.smtpPass || '').trim()) || ''
  if (!host || !user || !pass) return null
  const port = Number(process.env.SMTP_PORT || db?.smtpPort || 587)
  const secureEnv = process.env.SMTP_SECURE
  const secure =
    secureEnv !== undefined && secureEnv !== ''
      ? String(secureEnv).toLowerCase() === 'true'
      : db?.smtpSecure === true
  const from =
    process.env.MAIL_FROM ||
    (db && String(db.mailFrom || '').trim()) ||
    user
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  return { transport, from }
}

/**
 * POST /api/admin/notify-payment-decision
 * Header: Authorization: Bearer ADMIN_API_SECRET
 * Body: { toEmail, decision: "approved"|"rejected", paymentReference?, userLabel? }
 */
app.post('/api/admin/notify-payment-decision', async (req, res) => {
  const expected = process.env.ADMIN_API_SECRET
  const hdr = req.headers.authorization || ''
  if (!expected || hdr !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { toEmail, decision, paymentReference, userLabel } = req.body || {}
  const email = String(toEmail || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid toEmail' })
  }
  const d = decision === 'approved' || decision === 'rejected' ? decision : null
  if (!d) {
    return res.status(400).json({ error: 'decision must be approved or rejected' })
  }

  const mailer = await resolveMailer()
  if (!mailer) {
    return res.status(503).json({
      error:
        'Email is not configured. Set SMTP_* (and optional MAIL_FROM) on the API server, or save outbound mail in JobRush admin → Settings → Outbound email and set FIREBASE_DATABASE_URL here.',
    })
  }

  const { transport, from } = mailer
  const subject =
    d === 'approved' ? 'JobRush — your access is active' : 'JobRush — payment verification update'
  const refLine = paymentReference ? `Reference you submitted: ${paymentReference}\n\n` : ''
  const greeting = userLabel ? `Hello ${userLabel},\n\n` : 'Hello,\n\n'
  const text =
    d === 'approved'
      ? `${greeting}Your payment has been verified. Your JobRush account is now active — sign in and use the features included in your plan.\n\nThank you for choosing JobRush.\n`
      : `${greeting}We were unable to verify your payment with the reference we have on file.\n\n${refLine}Please try again from the JobRush app or contact support with proof of payment if you believe this is a mistake.\n\n— JobRush\n`

  try {
    await transport.sendMail({ from, to: email, subject, text })
    res.json({ ok: true })
  } catch (e) {
    console.error('notify-payment-decision mail error', e)
    res.status(500).json({ error: e.message || 'Failed to send email' })
  }
})

/**
 * POST /api/admin/send-user-email
 * Header: Authorization: Bearer ADMIN_API_SECRET
 * Body: { toEmail, subject, text }
 */
app.post('/api/admin/send-user-email', async (req, res) => {
  const expected = process.env.ADMIN_API_SECRET
  const hdr = req.headers.authorization || ''
  if (!expected || hdr !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { toEmail, subject, text } = req.body || {}
  const email = String(toEmail || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid toEmail' })
  }
  const subj = String(subject || '').trim()
  const body = String(text || '')
  if (!subj || !body) {
    return res.status(400).json({ error: 'subject and text are required' })
  }

  const mailer = await resolveMailer()
  if (!mailer) {
    return res.status(503).json({
      error:
        'Email is not configured. Set SMTP_* on the API server, or use admin Settings → Outbound email plus FIREBASE_DATABASE_URL.',
    })
  }

  const { transport, from } = mailer
  const clipped = body.length > 12000 ? `${body.slice(0, 12000)}\n\n[Message truncated for email size limits.]\n` : body

  try {
    await transport.sendMail({ from, to: email, subject: subj, text: clipped })
    res.json({ ok: true })
  } catch (e) {
    console.error('send-user-email error', e)
    res.status(500).json({ error: e.message || 'Failed to send email' })
  }
})

/**
 * Build transporter from admin "draft" form (optional test-before-save).
 */
function buildMailerFromDraft(d) {
  if (!d || typeof d !== 'object') return null
  const host = String(d.smtpHost || '').trim()
  const user = String(d.smtpUser || '').trim()
  const pass = String(d.smtpPass || '').replace(/\s+/g, '').trim()
  if (!host || !user || !pass) return null
  if (pass.length > 256) return null
  const port = Number(d.smtpPort) || 587
  const secure = d.smtpSecure === true
  const from = String(d.mailFrom || '').trim() || user
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  return { transport, from }
}

/**
 * POST /api/admin/send-test-email
 * Header: Authorization: Bearer ADMIN_API_SECRET
 * Body: { toEmail, draft?: { mailFrom, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } }
 * If draft is complete (incl. smtpPass), uses draft; else reloads Firebase and uses resolveMailer().
 */
app.post('/api/admin/send-test-email', async (req, res) => {
  const expected = process.env.ADMIN_API_SECRET
  const hdr = req.headers.authorization || ''
  if (!expected || hdr !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const email = String(req.body?.toEmail || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid toEmail is required' })
  }

  let mailer = buildMailerFromDraft(req.body?.draft)
  if (!mailer) {
    emailOutboundCache = { at: 0, val: null, ok: false }
    mailer = await resolveMailer()
  }
  if (!mailer) {
    return res.status(503).json({
      error:
        'Email is not configured. Save outbound settings to Firebase (and set FIREBASE_DATABASE_URL on this server), set SMTP_* env vars, or send a draft with smtpPass filled to test before saving.',
    })
  }

  const { transport, from } = mailer
  const subject = 'JobRush — test email'
  const text = `This is a test message from the JobRush API.\n\nIf you received this, outbound SMTP is working.\n\nSent at ${new Date().toISOString()}\n`

  try {
    await transport.sendMail({ from, to: email, subject, text })
    res.json({ ok: true })
  } catch (e) {
    console.error('send-test-email error', e)
    res.status(500).json({ error: e.message || 'Failed to send test email' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`JobRush API running on http://localhost:${PORT}`)
  if (!groq) console.warn('Warning: API key not set. AI features will return errors.')
})
