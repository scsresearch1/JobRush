import React, { useState, useEffect, useRef } from 'react'
import { XMarkIcon, AcademicCapIcon, ChartBarIcon, BriefcaseIcon, UserGroupIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const DemoModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)
  const progressRef = useRef(null)

  const steps = [
    {
      title: "Resume Upload & ATS Scoring",
      icon: <AcademicCapIcon className="w-16 h-16" />,
      description: "Upload your CV and get compatibility scores across 20 companies and 10 universities",
      features: [
        "Automatic resume parsing",
        "Skills, experience & education extraction",
        "30+ ATS target evaluation",
        "Detailed compatibility reports"
      ],
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "AI Resume Improvements",
      icon: <ChartBarIcon className="w-16 h-16" />,
      description: "Get targeted suggestions and apply corrections with one click",
      features: [
        "Keyword matching analysis",
        "Formatting & skill alignment",
        "One-click auto-correction",
        "Scientific score breakdown"
      ],
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "AI Mock Interview",
      icon: <BriefcaseIcon className="w-16 h-16" />,
      description: "Practice with HR-style questions and get performance analysis",
      features: [
        "Video-based response recording",
        "Confidence & emotion analysis",
        "Scientific performance reports",
        "Actionable improvement feedback"
      ],
      color: "from-orange-500 to-red-500"
    },
    {
      title: "SOP & Cover Letter",
      icon: <UserGroupIcon className="w-16 h-16" />,
      description: "Generate customized documents from your resume data",
      features: [
        "AI-generated cover letters",
        "Statement of Purpose creation",
        "Target role & company customization",
        "Resume data integration"
      ],
      color: "from-green-500 to-emerald-500"
    }
  ]

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setCurrentStep(0)
      return
    }

    // Reset and start animation when modal opens
    setCurrentStep(0)
    const startTimer = setTimeout(() => {
      setIsPlaying(true)
    }, 50) // Minimal delay for smooth start

    return () => clearTimeout(startTimer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !isPlaying) return

    let audioContext = null
    
    // Initialize audio context
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      // Audio context not supported, continue without sound
    }
    
    // Play a subtle notification sound for each step
    const playStepSound = (stepIndex) => {
      if (!audioContext) return
      
      try {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.value = 400 + (stepIndex * 100)
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      } catch (e) {
        // Audio playback failed, continue without sound
      }
    }

    // Play sound for initial step
    playStepSound(0)

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        const nextStep = prev + 1
        if (nextStep < steps.length) {
          playStepSound(nextStep)
          return nextStep
        } else {
          setIsPlaying(false)
          return prev
        }
      })
    }, 3000) // 3 seconds per step for faster animation

    return () => {
      clearInterval(stepInterval)
      if (audioContext) {
        audioContext.close().catch(() => {})
      }
    }
  }, [isOpen, isPlaying, steps.length])

  if (!isOpen) return null

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition p-2 hover:bg-white/20 rounded-lg"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <h2 className="text-3xl font-bold text-white mb-2">Your Career Journey</h2>
          <p className="text-primary-100">Experience the complete JobRush platform</p>
          
          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              ref={progressRef}
              className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Step Indicator */}
          <div className="flex justify-center mb-8">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                      index === currentStep
                        ? `bg-gradient-to-r ${step.color} text-white scale-110 shadow-lg`
                        : index < currentStep
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${
                    index === currentStep ? 'text-primary-600' : 'text-gray-400'
                  }`}>
                    {step.title.split(' ')[0]}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-16 mt-6 transition-all duration-500 ${
                      index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Current Step Content */}
          <div
            key={currentStep}
            className="text-center"
            style={{
              animation: 'fade-in 0.5s ease-out, slide-in-from-right 0.5s ease-out'
            }}
          >
            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-r ${currentStepData.color} text-white mb-6 shadow-2xl transform transition-all duration-500 hover:scale-110`}>
              {currentStepData.icon}
            </div>
            
            <h3 className="text-4xl font-bold text-gray-900 mb-4">
              {currentStepData.title}
            </h3>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {currentStepData.description}
            </p>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {currentStepData.features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-xl border border-gray-200 text-left"
                  style={{
                    animation: `fade-in 0.5s ease-out ${index * 0.1}s, slide-in-from-bottom 0.5s ease-out ${index * 0.1}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${currentStepData.color} flex items-center justify-center flex-shrink-0`}>
                      <CheckCircleIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-gray-700 font-medium">{feature}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default DemoModal

