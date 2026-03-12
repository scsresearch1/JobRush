import React, { useEffect, useState } from 'react'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

const SparklesIconSVG = () => (
  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const TransitionPage = ({ onComplete }) => {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1200),
      setTimeout(() => setStage(3), 2000),
      setTimeout(() => onComplete(), 2500)
    ]

    return () => timers.forEach(timer => clearTimeout(timer))
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 flex items-center justify-center">
      <div className="text-center">
        {/* Sparkles Animation */}
        <div className={`mb-8 transition-all duration-700 ${
          stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}>
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white/20 backdrop-blur-md rounded-full mb-6">
            <SparklesIconSVG />
          </div>
        </div>

        {/* Document Icon */}
        <div className={`mb-6 transition-all duration-700 ${
          stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl shadow-2xl mb-4">
            <DocumentTextIcon className="w-12 h-12 text-primary-600" />
          </div>
        </div>

        {/* Text */}
        <div className={`transition-all duration-700 ${
          stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome to JobRush
          </h2>
          <p className="text-xl text-primary-100">
            Get ready to upload your resume
          </p>
        </div>

        {/* Loading Dots */}
        <div className={`flex justify-center space-x-2 mt-8 transition-opacity duration-500 ${
          stage >= 3 ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}

export default TransitionPage

