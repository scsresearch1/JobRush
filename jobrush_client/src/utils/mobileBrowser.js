/**
 * Mobile / small-screen detection for “desktop recommended” messaging.
 * Uses widely supported APIs (Chrome, Edge, Safari, Firefox): matchMedia, userAgent, touch hints.
 */

const MAX_MOBILE_WIDTH_PX = 767

function safeMatchMedia(query) {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

/** Typical phone-sized viewport (also catches desktop windows narrowed for testing). */
export function isNarrowViewport() {
  return safeMatchMedia(`(max-width: ${MAX_MOBILE_WIDTH_PX}px)`)
}

/**
 * Handheld browsers often identify with Mobi in the UA (MDN-style check).
 * Not relied on alone; combined with viewport and iPad heuristics.
 */
export function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Mobi|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true
  }
  if (/iPad/.test(ua)) return true
  // iPadOS 13+ Safari may report as Mac with touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
}

/**
 * True when we should show the “use desktop or laptop” experience on the landing page.
 * Handheld UA always qualifies (including landscape), so phones cannot bypass by rotating.
 * Narrow desktop windows also qualify so users can recover by widening the window.
 */
export function shouldShowDesktopOnlyNotice() {
  if (typeof window === 'undefined') return false
  if (isMobileUserAgent()) return true
  if (isNarrowViewport()) return true
  return false
}

export function subscribeDesktopOnlyNotice(callback) {
  if (typeof window === 'undefined') return () => {}

  const run = () => callback(shouldShowDesktopOnlyNotice())

  const mq = window.matchMedia(`(max-width: ${MAX_MOBILE_WIDTH_PX}px)`)
  const onMq = () => run()
  if (mq.addEventListener) {
    mq.addEventListener('change', onMq)
  } else {
    mq.addListener(onMq)
  }
  window.addEventListener('resize', onMq)
  window.addEventListener('orientationchange', onMq)

  run()

  return () => {
    if (mq.removeEventListener) {
      mq.removeEventListener('change', onMq)
    } else {
      mq.removeListener(onMq)
    }
    window.removeEventListener('resize', onMq)
    window.removeEventListener('orientationchange', onMq)
  }
}
