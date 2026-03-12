import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseResumeFromPdf } from '@prolaxu/open-resume-pdf-parser'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { transformParsedResume } from '../utils/resumeParserTransform.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
import {
  DocumentArrowUpIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  CpuChipIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { generateParsedResumePDF } from '../utils/pdfGenerator.js'
import { Link } from 'react-router-dom'

const ResumeUpload = () => {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState('')

  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')

  useEffect(() => {
    const stored = localStorage.getItem('jobRush_parsed_resume')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && (parsed.name || parsed.skills?.length || parsed.experience?.length)) {
          setParsedData(parsed)
        }
      } catch {
        // ignore invalid stored data
      }
    }
  }, [])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const isAcceptedFile = (f) => ACCEPTED_TYPES.includes(f.type) || f.name?.toLowerCase().endsWith('.pdf') || f.name?.toLowerCase().endsWith('.docx')

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return
    if (!isAcceptedFile(droppedFile)) {
      setError('Please upload a PDF or DOCX file')
      return
    }
    if (droppedFile.size > 5 * 1024 * 1024) {
      setError('File size must be under 5 MB')
      return
    }
    setFile(droppedFile)
    setError('')
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!isAcceptedFile(selectedFile)) {
        setError('Please upload a PDF or DOCX file')
        return
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be under 5 MB')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setError('')

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
        setError('Could not extract meaningful data. For PDF: ensure it\'s text-based (not scanned). For DOCX: check the file format.')
        return
      }

      if (parsed.email === '' && user?.email) {
        parsed.email = user.email
      }

      setParsedData(parsed)
      localStorage.setItem('jobRush_parsed_resume', JSON.stringify(parsed))
    } catch (err) {
      console.error('Resume parse error:', err)
      const msg = err?.message || ''
      if (msg.includes('encrypted') || msg.includes('password')) {
        setError('This file appears to be encrypted. Please use an unencrypted version.')
      } else if (msg.includes('Invalid') || msg.includes('corrupt') || msg.includes('Could not find file')) {
        setError('Could not read this file. It may be corrupted or in an unsupported format.')
      } else {
        setError('Failed to parse resume. Please ensure it\'s a valid PDF or DOCX file.')
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setIsParsing(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setParsedData(null)
    setError('')
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <Link
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-8 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Home
      </Link>

      {/* Welcome Section */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
          <SparklesIcon className="w-5 h-5" />
          <span>Step 1 of your journey</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Upload Your Resume
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mb-8">
          {user?.email ? (
            <>Welcome, <span className="font-medium text-primary-600">{user.email}</span>. Upload your CV and we'll automatically extract your skills, experience, education, and projects.</>
          ) : (
            <>Upload your CV and we'll automatically extract your skills, experience, education, and projects.</>
          )}
        </p>

        {/* ATS Mechanism USPs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-primary-100 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Our ATS Mechanism</h3>
          <p className="text-gray-600 mb-6">Your resume is evaluated using industry-leading technology:</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100">
              <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                <BuildingOffice2Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">20+ Mass Hiring Companies</p>
                <p className="text-xs text-gray-600 mt-0.5">Mapping with top recruiters</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100">
              <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                <BuildingOffice2Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">MAANG Companies</p>
                <p className="text-xs text-gray-600 mt-0.5">Meta, Apple, Amazon, Netflix, Google</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100">
              <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                <AcademicCapIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Ivy League Universities</p>
                <p className="text-xs text-gray-600 mt-0.5">Top university mapping</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100">
              <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
                <CpuChipIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">1 Lakh Parameter ML Model</p>
                <p className="text-xs text-gray-600 mt-0.5">AI-powered ATS scoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DocumentArrowUpIcon className="w-6 h-6" />
            Resume Upload & Parsing
          </h2>
          <p className="text-primary-100 text-sm mt-1">
            PDF or DOCX • Max 5MB • We'll extract your information automatically
          </p>
        </div>

        <div className="p-8">
          {!parsedData ? (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50 scale-[1.02]'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                    <DocumentArrowUpIcon className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-xl font-semibold text-gray-800 mb-2">
                    {file ? file.name : 'Drag and drop your resume here'}
                  </p>
                  <p className="text-gray-500 mb-2">
                    or click to browse
                  </p>
                  <p className="text-sm text-gray-400">
                    PDF or DOCX, maximum 5MB
                  </p>
                </label>
              </div>

              {error && (
                <p className="mt-4 text-red-600 font-medium flex items-center gap-2">
                  <XMarkIcon className="w-5 h-5" />
                  {error}
                </p>
              )}

              <div className="flex gap-4 mt-8">
                {file && (
                  <>
                    <button
                      onClick={handleParse}
                      disabled={isParsing}
                      className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {isParsing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Parsing resume...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-5 h-5" />
                          Parse Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleClear}
                      className="px-6 py-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-medium"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Extracted Information</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => generateParsedResumePDF(parsedData)}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition shadow-lg"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => navigate('/ats-analysis')}
                    className="bg-white border-2 border-primary-600 text-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition"
                  >
                    View ATS Analysis
                  </button>
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
                  >
                    <XMarkIcon className="w-5 h-5" />
                    Upload New
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-100">
                  <h3 className="font-bold text-gray-900 mb-3">Contact</h3>
                  <p className="text-gray-700">{parsedData.name || '—'}</p>
                  <p className="text-gray-700">{parsedData.email || '—'}</p>
                  <p className="text-gray-700">{parsedData.phone || '—'}</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-100">
                  <h3 className="font-bold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {(parsedData.skills || []).length > 0 ? (parsedData.skills || []).map((s, i) => (
                      <span key={i} className="px-4 py-2 bg-primary-100 text-primary-700 rounded-xl text-sm font-medium">
                        {s}
                      </span>
                    )) : <p className="text-gray-500 text-sm">No skills extracted</p>}
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-100 md:col-span-2">
                  <h3 className="font-bold text-gray-900 mb-3">Experience</h3>
                  {(parsedData.experience || []).length > 0 ? (parsedData.experience || []).map((exp, i) => (
                    <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                      <CheckCircleIcon className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {exp.role || exp.title}{exp.company ? ` at ${exp.company}` : ''}
                        </p>
                        <p className="text-sm text-gray-500">{exp.duration}</p>
                        {exp.description && <p className="text-sm text-gray-600 mt-1">{exp.description}</p>}
                      </div>
                    </div>
                  )) : <p className="text-gray-500 text-sm">No experience extracted</p>}
                </div>
                <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-100 md:col-span-2">
                  <h3 className="font-bold text-gray-900 mb-3">Education</h3>
                  {(parsedData.education || []).length > 0 ? (parsedData.education || []).map((edu, i) => (
                    <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                      <CheckCircleIcon className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700">{[edu.degree, edu.institution, edu.year].filter(Boolean).join(' — ')}</p>
                    </div>
                  )) : <p className="text-gray-500 text-sm">No education extracted</p>}
                </div>
                {(parsedData.projects || []).length > 0 && (
                  <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-100 md:col-span-2">
                    <h3 className="font-bold text-gray-900 mb-3">Projects</h3>
                    {(parsedData.projects || []).map((proj, i) => (
                      <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                        <CheckCircleIcon className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{proj.name}</p>
                          {proj.description && <p className="text-sm text-gray-600 mt-1">{proj.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResumeUpload
