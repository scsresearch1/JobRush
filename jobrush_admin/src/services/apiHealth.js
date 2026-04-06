/**
 * Probes the JobRush API /api/health (LLM + TTS flags). Base URL is configurable for staging.
 */

const DEFAULT_BASE = 'https://jobrush.onrender.com'

function normalizeBase(url) {
  const u = String(url || DEFAULT_BASE).replace(/\/$/, '')
  return u || DEFAULT_BASE
}

/**
 * @returns {Promise<{
 *   reachable: boolean,
 *   ok: boolean,
 *   status: number,
 *   ms: number,
 *   llm?: boolean,
 *   tts?: boolean,
 *   error?: string
 * }>}
 */
export async function fetchJobRushApiHealth() {
  const base = normalizeBase(import.meta.env.VITE_JOBRUSH_API_BASE)
  const url = `${base}/api/health`
  const t0 = performance.now()
  try {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), 12_000)
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal })
    clearTimeout(id)
    const ms = Math.round(performance.now() - t0)
    if (!res.ok) {
      return { reachable: true, ok: false, status: res.status, ms }
    }
    const body = await res.json().catch(() => ({}))
    return {
      reachable: true,
      ok: !!body.ok,
      status: res.status,
      ms,
      llm: !!body.llm,
      tts: !!body.tts,
    }
  } catch (e) {
    return {
      reachable: false,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - t0),
      error: e?.name === 'AbortError' ? 'Timed out' : 'Unreachable',
    }
  }
}
