import React, { useEffect, useState } from 'react'
import { ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { subscribeDesktopOnlyNotice } from '../utils/mobileBrowser'

/**
 * Full-screen advisory on the marketing landing page when accessed from a phone
 * or a sufficiently narrow viewport. Blocks interaction with the page underneath.
 */
export default function LandingMobileGate() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return subscribeDesktopOnlyNotice(setVisible)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5 sm:p-8 bg-slate-900/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-mobile-gate-title"
      aria-describedby="landing-mobile-gate-desc"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-8 sm:p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
          <ComputerDesktopIcon className="h-9 w-9" aria-hidden />
        </div>
        <h2 id="landing-mobile-gate-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Please use a computer for JobRush.ai
        </h2>
        <p id="landing-mobile-gate-desc" className="mt-4 text-slate-600 text-base leading-relaxed">
          This portal is not available on phones. Resume analysis, ATS tools, and mock interviews are
          designed for a larger screen and need a stable desktop or laptop browser to work reliably and
          to give you the full benefit of the platform.
        </p>
        <p className="mt-4 text-sm text-slate-500 leading-relaxed">
          For the best experience, open{' '}
          <strong className="font-semibold text-slate-700">JobRush.ai</strong> in{' '}
          <strong className="font-semibold text-slate-700">Google Chrome</strong>,{' '}
          <strong className="font-semibold text-slate-700">Microsoft Edge</strong>,{' '}
          <strong className="font-semibold text-slate-700">Safari</strong>, or{' '}
          <strong className="font-semibold text-slate-700">Firefox</strong> on a{' '}
          <strong className="font-semibold text-slate-700">desktop or laptop</strong>.
        </p>
        <p className="mt-5 text-xs text-slate-400 leading-relaxed">
          If you are already on a computer, widen your browser window until this message disappears.
        </p>
      </div>
    </div>
  )
}
