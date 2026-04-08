import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { generateSOP, generateCoverLetter } from '../services/groqService.js'

const STORAGE_KEY = 'jobRush_parsed_resume'

const SOPCoverLetter = () => {
  const [type, setType] = useState('cover-letter')
  const [targetRole, setTargetRole] = useState('')
  const [targetCompany, setTargetCompany] = useState('')
  const [targetProgram, setTargetProgram] = useState('')
  const [resume, setResume] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && (parsed.name || parsed.skills?.length || parsed.experience?.length)) {
          setResume(parsed)
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const handleGenerate = async () => {
    if (!resume) {
      setError('Upload and parse your resume first on the Resume Upload page.')
      return
    }
    if (type === 'cover-letter') {
      if (!targetRole.trim()) {
        setError('Please enter the target role for the cover letter.')
        return
      }
      if (!targetCompany.trim()) {
        setError('Please enter the target company for the cover letter.')
        return
      }
    } else {
      if (!targetProgram.trim()) {
        setError('Please enter the target program or degree for the SOP.')
        return
      }
      if (!targetCompany.trim()) {
        setError('Please enter the target university for the SOP.')
        return
      }
    }
    setIsGenerating(true)
    setGenerated(null)
    setError(null)

    try {
      if (type === 'sop') {
        const { content } = await generateSOP(resume, targetProgram, targetCompany)
        setGenerated(content)
      } else {
        const { content } = await generateCoverLetter(resume, targetRole, targetCompany)
        setGenerated(content)
      }
    } catch (err) {
      setError(err.message || 'Failed to generate. Ensure the API server is running (npm run server).')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (generated) {
      navigator.clipboard.writeText(generated).catch(() => {
        setError('Could not copy to clipboard. Please copy the text manually.')
      })
    }
  }

  const handleDownload = () => {
    if (!generated) return
    const name = type === 'sop' ? 'Statement_of_Purpose' : 'Cover_Letter'
    const target = type === 'sop' ? (targetProgram || targetCompany) : (targetCompany || targetRole)
    const filename = `${name}_${(target || 'document').replace(/\s+/g, '_')}_${Date.now()}.txt`
    const blob = new Blob([generated], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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

      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <DocumentTextIcon className="w-8 h-8 text-primary-600" />
          SOP & Cover Letter Generation
        </h1>
        <p className="text-gray-600 mb-6">
          Generate customized Statements of Purpose and cover letters using your resume data.
        </p>

        {!resume && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl mb-6">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
            <p>
              Upload and parse your resume on the <Link to="/resume-upload" className="underline font-medium">Resume Upload</Link> page first.
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        <div className="space-y-6 mb-8">
          <div>
            <label className="block font-medium text-gray-700 mb-2">Document Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => { setType('cover-letter'); setGenerated(null); setError(null) }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  type === 'cover-letter' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cover Letter
              </button>
              <button
                onClick={() => { setType('sop'); setGenerated(null); setError(null) }}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  type === 'sop' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Statement of Purpose
              </button>
            </div>
          </div>

          {type === 'cover-letter' ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700 mb-2">Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-2">Target Company</label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="e.g. Google"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700 mb-2">Target Program / Degree</label>
                <input
                  type="text"
                  value={targetProgram}
                  onChange={(e) => setTargetProgram(e.target.value)}
                  placeholder="e.g. MS in Computer Science"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-2">Target University</label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="e.g. MIT, Stanford"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !resume}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating with AI...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Generate {type === 'sop' ? 'SOP' : 'Cover Letter'}
              </>
            )}
          </button>
        </div>

        {generated && (
          <div className="border-t pt-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h3 className="font-bold text-gray-900">
                Generated {type === 'sop' ? 'Statement of Purpose' : 'Cover Letter'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition font-medium"
                >
                  <DocumentDuplicateIcon className="w-5 h-5" />
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition font-medium"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download .txt
                </button>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl whitespace-pre-wrap text-gray-700 leading-relaxed">
              {generated}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SOPCoverLetter
