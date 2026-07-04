import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { generateInterviewQuestions } from '../utils/mockInterviewQuestions.js'
import { readStoredParsedResume } from '../utils/parsedResumeStorage.js'
import {
  ArrowLeftIcon,
  VideoCameraIcon,
  PlayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline'
import { speakQuestion, stopSpeaking, preloadVoices } from '../utils/questionTts.js'
import { startVideoAnalysis } from '../utils/videoAnalyzer.js'
import BehavioralReport from '../components/BehavioralReport.jsx'
import { getUser } from '../services/database.js'
import { USERDB_FIELDS } from '../config/databaseSchema.js'
import { QUOTA_MOCK_MAX } from '../utils/quotas.js'
import { hasUnlimitedQuota } from '../utils/superAdmin.js'
import { isMobileUserAgent } from '../utils/mobileBrowser.js'

const MockInterview = () => {
  const isMobileDevice = isMobileUserAgent()
  const [stage, setStage] = useState('intake') // 'intake' | 'questions' | 'interview' | 'analysis'
  const [resume, setResume] = useState(null)
  const [questions, setQuestions] = useState([])
  const [mockQuotaExceeded, setMockQuotaExceeded] = useState(false)

  const [isRecording, setIsRecording] = useState(false)
  const [countdown, setCountdown] = useState(null) // 60, 59, ... 0 when recording
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const countdownIntervalRef = useRef(null)
  const pendingNextRef = useRef(false)
  const stopVideoAnalysisRef = useRef(null)
  const frameMetricsRef = useRef([])

  // Same parsed resume as ATS Analysis — set once on Resume Upload (no second parse here).
  useEffect(() => {
    const parsed = readStoredParsedResume()
    if (parsed) {
      setResume(parsed)
      setQuestions(generateInterviewQuestions(parsed))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let localUser = {}
    let uid
    try {
      localUser = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
      uid = localUser.uniqueId
    } catch {
      uid = null
    }
    if (!uid || String(uid).startsWith('local_') || hasUnlimitedQuota(localUser)) return undefined
    getUser(uid)
      .then((d) => {
        if (cancelled) return
        const used = Number(d?.[USERDB_FIELDS.MOCK_INTERVIEWS_USED]) || 0
        if (used >= QUOTA_MOCK_MAX) setMockQuotaExceeded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const useExistingResume = () => {
    if (resume) {
      setQuestions(generateInterviewQuestions(resume))
      setStage('questions')
    }
  }

  const startInterview = () => {
    preloadVoices() // Ensure Chrome has loaded voices (needs user gesture)
    setStage('interview')
    setCurrentQuestionIndex(0)
    setResponses([])
  }

  const playQuestion = () => {
    const q = questions[currentQuestionIndex]
    if (!q?.question) return
    setIsSpeaking(true)
    speakQuestion(q.question, {
      onEnd: () => setIsSpeaking(false),
    })
  }

  // Auto-play question when it changes during interview
  useEffect(() => {
    if (stage === 'interview' && currentQuestion?.question) {
      setIsSpeaking(true)
      speakQuestion(currentQuestion.question, {
        onEnd: () => setIsSpeaking(false),
      })
    }
    return () => stopSpeaking()
  }, [stage, currentQuestionIndex])

  const stopRecordingAndCleanup = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (stopVideoAnalysisRef.current) {
      stopVideoAnalysisRef.current()
      stopVideoAnalysisRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCountdown(null)
    setIsRecording(false)
    setCameraError(null)
  }

  const startRecording = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      recordedChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        if (pendingNextRef.current) {
          const blob = recordedChunksRef.current.length > 0
            ? new Blob(recordedChunksRef.current, { type: mimeType })
            : null
          const metrics = [...frameMetricsRef.current]
          frameMetricsRef.current = []
          const currentQ = questions[currentQuestionIndex]
          if (currentQ) {
            setResponses((prev) => [
              ...prev,
              { question: currentQ.question, type: currentQ.type, videoBlob: blob, frameMetrics: metrics },
            ])
          }
          pendingNextRef.current = false
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((i) => i + 1)
          } else {
            setStage('analysis')
          }
        }
      }
      recorder.start(100) // collect chunks every 100ms
      mediaRecorderRef.current = recorder

      frameMetricsRef.current = []
      try {
        const stopAnalysis = await startVideoAnalysis(videoRef.current, (metrics) => {
          frameMetricsRef.current.push(metrics)
        })
        stopVideoAnalysisRef.current = stopAnalysis
      } catch (err) {
        console.warn('Video analysis failed:', err)
      }

      setIsRecording(true)
      setCountdown(60)

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((c) => {
          const next = c - 1
          if (next <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current)
              countdownIntervalRef.current = null
            }
            setTimeout(() => {
              pendingNextRef.current = true
              mediaRecorderRef.current?.stop()
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop())
                streamRef.current = null
              }
              if (stopVideoAnalysisRef.current) {
                stopVideoAnalysisRef.current()
                stopVideoAnalysisRef.current = null
              }
              setCountdown(null)
              setIsRecording(false)
            }, 0)
            return 0
          }
          return next
        })
      }, 1000)
    } catch (err) {
      setCameraError('Could not access webcam. Please allow camera permission.')
    }
  }

  const nextQuestion = () => {
    const currentQ = questions[currentQuestionIndex]
    if (isRecording && mediaRecorderRef.current?.state !== 'inactive') {
      pendingNextRef.current = true
      if (stopVideoAnalysisRef.current) {
        stopVideoAnalysisRef.current()
        stopVideoAnalysisRef.current = null
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      mediaRecorderRef.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setCountdown(null)
      setIsRecording(false)
      setCameraError(null)
      return
    }
    if (currentQ) {
      setResponses((prev) => [...prev, { question: currentQ.question, type: currentQ.type, videoBlob: null }])
    }
    stopRecordingAndCleanup()
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1)
    } else {
      setStage('analysis')
    }
  }

  // Cleanup on unmount or when leaving interview
  useEffect(() => {
    return () => stopRecordingAndCleanup()
  }, [])

  // Reset video when question changes (user hasn't started recording yet)
  useEffect(() => {
    if (!isRecording && videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [currentQuestionIndex, isRecording])

  const currentQuestion = questions[currentQuestionIndex]

  if (mockQuotaExceeded) {
    return (
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6 transition font-medium"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-lg mx-auto">
          <p className="text-lg font-semibold text-gray-900 mb-2">Mock interview limit reached</p>
          <p className="text-gray-600">
            You have used all {QUOTA_MOCK_MAX} mock interview reports included in your plan.
          </p>
        </div>
      </div>
    )
  }

  if (isMobileDevice) {
    return (
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6 transition font-medium"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-2xl mx-auto border border-gray-200">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
            <ComputerDesktopIcon className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl font-bold text-gray-900 mb-3">Mock interview is desktop-only</p>
          <p className="text-gray-600 leading-relaxed">
            Everything is possible from mobile browsers, except taking the mock interview.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Please open fortunehire.in on a desktop or laptop to continue with the mock interview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/dashboard"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-6 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Dashboard
      </Link>

      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <VideoCameraIcon className="w-8 h-8 text-primary-600" />
          AI HR Mock Interview
        </h1>
        <p className="text-gray-600 mb-6">
          Simulate interview sessions with HR-style questions. Record your video responses (video only, 60 sec per question) for analysis.
        </p>

        {/* Stage 1: Uses parsed resume from Resume Upload (single parse for ATS + mock interview) */}
        {stage === 'intake' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stage 1 — Your resume</h3>
              <p className="text-gray-600 mb-4">
                Your resume is parsed once on{' '}
                <Link to="/resume-upload" className="text-primary-600 font-medium hover:underline">
                  Resume Upload
                </Link>
                . Those details power ATS scoring here and your personalized questions—until you upload and parse a new file.
              </p>
            </div>

            {resume ? (
              <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  <span className="font-semibold text-green-800">Resume ready</span>
                </div>
                <p className="text-gray-700 text-sm mb-4">
                  {resume.name || 'Candidate'} • {(resume.skills || []).length} skills • {(resume.experience || []).length} experiences
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    type="button"
                    onClick={useExistingResume}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    View generated questions
                  </button>
                  <Link
                    to="/resume-upload"
                    className="text-sm text-primary-600 font-medium hover:underline"
                  >
                    Replace resume (upload & parse again)
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-gray-800 font-medium mb-2">No parsed resume yet</p>
                <p className="text-gray-600 text-sm mb-4">
                  Upload a PDF or DOCX on Resume Upload and tap Parse Resume. After that, return here—your profile will load automatically.
                </p>
                <Link
                  to="/resume-upload"
                  className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700"
                >
                  <DocumentArrowUpIcon className="w-5 h-5" />
                  Go to Resume Upload
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Stage: Questions Preview (before interview) */}
        {stage === 'questions' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Your Interview Questions</h3>
              <p className="text-gray-600 mb-4">
                These 5 questions were generated from your resume. Review them before starting the interview.
              </p>
            </div>

            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-medium text-primary-600 uppercase tracking-wide">
                    {q.type.replace(/-/g, ' ')}
                  </span>
                  <p className="font-medium text-gray-900 mt-1">{q.question}</p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
              <strong>Tip:</strong> For Indian-accent audio, add English (India) in Windows: Settings → Time & language → Language → Add language → English (India) → Options → Speech.
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-4">
              <button
                onClick={() => setStage('intake')}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg w-full sm:w-auto"
              >
                Back
              </button>
              <button
                onClick={startInterview}
                className="flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 w-full sm:w-auto"
              >
                <PlayIcon className="w-5 h-5" />
                Start Mock Interview
              </button>
            </div>
          </div>
        )}

        {/* Stage: Interview in progress */}
        {stage === 'interview' && currentQuestion && (
          <div className="space-y-6">
            <div className="p-6 bg-primary-50 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-primary-700 mb-2">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                  <p className="text-lg font-semibold text-gray-900">{currentQuestion.question}</p>
                </div>
                <button
                  onClick={playQuestion}
                  disabled={isSpeaking}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-primary-600 text-primary-600 rounded-xl font-medium hover:bg-primary-50 disabled:opacity-70 shrink-0"
                >
                  <SpeakerWaveIcon className="w-5 h-5" />
                  {isSpeaking ? 'Playing...' : 'Replay'}
                </button>
              </div>
            </div>

            <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              {!isRecording ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-600">
                      <VideoCameraIcon className="w-10 h-10 text-white" />
                    </div>
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold bg-primary-600 text-white hover:bg-primary-700"
                    >
                      <VideoCameraIcon className="w-5 h-5" />
                      Start Recording Response
                    </button>
                    <p className="text-gray-400 text-sm mt-2">Video only (60 sec max). Look at the camera while answering.</p>
                    {cameraError && <p className="text-red-400 text-sm mt-2">{cameraError}</p>}
                  </div>
                </div>
              ) : (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  {countdown}s
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={nextQuestion}
                className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700"
              >
                {currentQuestionIndex === questions.length - 1 ? 'Finish & View Analysis' : 'Next Question'}
              </button>
            </div>
          </div>
        )}

        {/* Stage 6: Analysis — Behavioral Report */}
        {stage === 'analysis' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Interview Complete</h3>
            <p className="text-gray-600">
              Your behavioral timeline has been generated from frame-level metrics. Review the report below.
            </p>
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              <BehavioralReport responses={responses} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setStage('questions')
                  setCurrentQuestionIndex(0)
                  setResponses([])
                  if (resume) setQuestions(generateInterviewQuestions(resume, Date.now()))
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg w-full sm:w-auto"
              >
                Retry Interview
              </button>
              <Link
                to="/dashboard"
                className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 text-center w-full sm:w-auto"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MockInterview
