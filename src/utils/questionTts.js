/**
 * Text-to-speech for interview questions
 * Uses Web Speech API (browser built-in) — truly free, no API keys
 * Prefers Indian-accent English (en-IN) when available
 *
 * For Indian accent on Windows: Settings → Time & language → Language
 * → Add language → English (India) → Options → Speech
 */

let cachedVoices = null

function getVoices() {
  return new Promise((resolve) => {
    if (cachedVoices && cachedVoices.length > 0) {
      resolve(cachedVoices)
      return
    }
    const voices = window.speechSynthesis?.getVoices() || []
    if (voices.length > 0) {
      cachedVoices = voices
      resolve(voices)
      return
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    // Chrome loads voices asynchronously — retry after delay
    setTimeout(() => {
      if (!cachedVoices || cachedVoices.length === 0) {
        cachedVoices = window.speechSynthesis.getVoices()
      }
      resolve(cachedVoices || [])
    }, 500)
  })
}

/** Indian voice patterns: en-IN, or common Indian voice names (Ravi, Raveena, etc.) */
const INDIAN_PATTERNS = /en-IN|india|indian|ravi|raveena|raju|anika|rudra|ruhaan/i

function selectVoice(voices) {
  const list = voices.filter(Boolean)
  const indian = list.find((v) => v.lang === 'en-IN' || INDIAN_PATTERNS.test(v.name || ''))
  if (indian) return indian
  const english = list.find((v) => v.lang?.startsWith('en'))
  return english || list[0]
}

/**
 * Speak text using Web Speech API (Indian accent when available)
 * @param {string} text - Text to speak
 * @param {Object} options - { onEnd, rate, pitch }
 * @returns {Promise<void>}
 */
export function speakQuestion(text, options = {}) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve()
  }

  window.speechSynthesis.cancel()

  return getVoices().then((voices) => {
    const voice = selectVoice(voices)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate ?? 0.9
    utterance.pitch = options.pitch ?? 1
    utterance.lang = voice?.lang === 'en-IN' ? 'en-IN' : (voice?.lang || 'en-IN')
    if (voice) utterance.voice = voice

    return new Promise((resolve) => {
      utterance.onend = () => {
        options.onEnd?.()
        resolve()
      }
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  })
}

/**
 * Preload voices (call after user interaction — Chrome loads voices on first interaction)
 */
export function preloadVoices() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.getVoices()
  }
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
