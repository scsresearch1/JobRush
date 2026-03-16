import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { parseResumeFromPdf } from '@prolaxu/open-resume-pdf-parser'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { transformParsedResume } from '../utils/resumeParserTransform.js'
import { generateInterviewQuestions } from '../utils/mockInterviewQuestions.js'
import {
  ArrowLeftIcon,
  VideoCameraIcon,
  PlayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import { speakQuestion, stopSpeaking, preloadVoices } from '../utils/questionTts.js'
import { startVideoAnalysis } from '../utils/videoAnalyzer.js'
import BehavioralReport from '../components/BehavioralReport.jsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const isAcceptedFile = (f) =>
  ACCEPTED_TYPES.includes(f.type) || f.name?.toLowerCase().endsWith('.pdf') || f.name?.toLowerCase().endsWith('.docx')

const MockInterview = () => {
  const [stage, setStage] = useState('intake') // 'intake' | 'questions' | 'interview' | 'analysis'
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [resume, setResume] = useState(null)
  const [questions, setQuestions] = useState([])
  const [parseError, setParseError] = useState('')

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

  // Load existing resume from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('jobRush_parsed_resume')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && (parsed.name || parsed.skills?.length || parsed.experience?.length)) {
          setResume(parsed)
          setQuestions(generateInterviewQuestions(parsed))
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return
    if (!isAcceptedFile(droppedFile)) {
      setParseError('Please upload a PDF or DOCX file')
      return
    }
    if (droppedFile.size > 5 * 1024 * 1024) {
      setParseError('File size must be under 5 MB')
      return
    }
    setFile(droppedFile)
    setParseError('')
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!isAcceptedFile(selectedFile)) {
        setParseError('Please upload a PDF or DOCX file')
        return
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setParseError('File size must be under 5 MB')
        return
      }
      setFile(selectedFile)
      setParseError('')
    }
  }

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setParseError('')

    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    let objectUrl = null

    try {
      let parsed
      if (isPdf) {
        objectUrl = URL.createObjectURL(file)
        const raw = await parseResumeFromPdf(objectUrl)
        parsed = transformParsedResume(raw)
      } else {
        const arrayBuffer = await file.arrayBuffer()
        const { parseDocxResume } = await import('../utils/docxResumeParser.js')
        parsed = await parseDocxResume(arrayBuffer)
      }

      if (!parsed || (!parsed.name && !parsed.email && parsed.skills?.length === 0 && parsed.experience?.length === 0)) {
        setParseError('Could not extract meaningful data. Ensure the file is text-based (not scanned).')
        return
      }

      const generated = generateInterviewQuestions(parsed)
      setResume(parsed)
      setQuestions(generated)
      setStage('questions')
    } catch (err) {
      console.error('Parse error:', err)
      setParseError('Failed to parse resume. Please try a different file.')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setIsParsing(false)
    }
  }

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

        {/* Stage 1: Resume Intake and Question Generation */}
        {stage === 'intake' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Stage 1 — Resume Intake</h3>
              <p className="text-gray-600 mb-4">
                Upload your resume. It will be parsed locally in your browser. We'll generate 5 personalized interview questions based on your profile.
              </p>
            </div>

            {resume ? (
              <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  <span className="font-semibold text-green-800">Resume loaded</span>
                </div>
                <p className="text-gray-700 text-sm mb-4">
                  {resume.name || 'Candidate'} • {(resume.skills || []).length} skills • {(resume.experience || []).length} experiences
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={useExistingResume}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    View Generated Questions
                  </button>
                  <p className="text-gray-500 text-sm self-center">or upload a new resume below</p>
                </div>
              </div>
            ) : null}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
              }`}
            >
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
                id="mock-resume-upload"
              />
              <label htmlFor="mock-resume-upload" className="cursor-pointer block">
                <DocumentArrowUpIcon className="w-12 h-12 mx-auto mb-3 text-primary-500" />
                <p className="font-medium text-gray-700">
                  {file ? file.name : 'Drag and drop your resume here or click to browse'}
                </p>
                <p className="text-sm text-gray-500 mt-1">PDF or DOCX, max 5 MB</p>
              </label>
              {file && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={handleParse}
                    disabled={isParsing}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isParsing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-5 h-5" />
                        Parse & Generate Questions
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setFile(null); setParseError('') }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            {parseError && <p className="text-red-600 text-sm">{parseError}</p>}
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
