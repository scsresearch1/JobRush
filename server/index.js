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

const app = express()

// CORS: reflect request origin (required by some proxies); allow jbrush.netlify.app
const ALLOWED_ORIGINS = ['https://jbrush.netlify.app', 'http://localhost:5173', 'http://localhost:3000']
app.use((req, res, next) => {
  const origin = req.headers.origin
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }))
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

    const systemPrompt = `You are a resume editor. Given a resume (JSON) and an improvement suggestion, return the modified resume as valid JSON. Apply ONLY the suggested change. Preserve all other fields. Output the complete resume JSON only, no other text.`
    const userPrompt = `Resume:
${JSON.stringify(resume, null, 2)}

Suggestion (${recommendation.section}): ${recommendation.suggestion}

Return the modified resume as valid JSON. Apply the suggestion. Output JSON only.`

    const raw = await callGroq(systemPrompt, userPrompt)
    let modified = resume
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        modified = JSON.parse(jsonMatch[0])
        if (!modified.skills) modified.skills = resume.skills || []
        if (!modified.experience) modified.experience = resume.experience || []
        if (!modified.education) modified.education = resume.education || []
        if (!modified.projects) modified.projects = resume.projects || []
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
    const systemPrompt = `You are an expert interview coach. Based on behavioral metrics from a mock interview (eye-contact, face visibility, head stability, blink rate, dominant emotions), generate 4-6 specific, actionable correction tips. Each tip should be: 1) Short and punchy (one sentence), 2) Tied to a specific metric when relevant, 3) Practical and easy to implement. Use a friendly, encouraging tone. Output JSON array only: [{"tip":"...","area":"eye-contact|visibility|stability|expression|general","priority":1}] where priority 1=highest. No other text.`
    const safeFix = (n, d) => {
      const x = (n != null && Number.isFinite(Number(n))) ? Number(n) : 0
      return x.toFixed(typeof d === 'number' ? d : 1)
    }
    const qSummaries = questionTimelines.map((q, i) => {
      const s = q?.timeline?.summary && typeof q.timeline.summary === 'object' ? q.timeline.summary : {}
      const qec = safeFix(safeNum(s.meanEyeContactRatio, 0) * 100, 0)
      const qfv = safeFix(safeNum(s.meanFaceVisibility, 0) * 100, 0)
      return `Q${i + 1} (${q?.type ?? 'unknown'}): confidence ${s.confidence ?? 0}, eye-contact ${qec}%, visibility ${qfv}%, dominant affect ${s.dominantEmotion ?? 'N/A'}`
    }).join('; ') || 'None'
    const userPrompt = `Behavioral metrics:
- Visual Confidence score: ${overall.confidence ?? 0}/100
- Eye-contact ratio: ${safeFix(ec, 1)}%
- Face visibility: ${safeFix(fv, 1)}%
- Head stability: ${safeFix(hs, 1)}%
- Emotional stability: ${safeFix(es, 1)}%
- Blink rate: ${safeFix(br, 2)}/s

Per-question summaries: ${qSummaries}

Generate 4-6 correction tips as JSON array. Be specific to these metrics.`

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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, llm: !!groq, tts: !!textToSpeechClient })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`JobRush API running on http://localhost:${PORT}`)
  if (!groq) console.warn('Warning: API key not set. AI features will return errors.')
})
