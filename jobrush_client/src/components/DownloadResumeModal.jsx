import React from 'react'
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { generateParsedResumePDF, PARSED_RESUME_DESIGNS } from '../utils/pdfGenerator.js'

const DownloadResumeModal = ({ isOpen, onClose, resume }) => {
  if (!isOpen) return null

  const handleDownload = (design) => {
    generateParsedResumePDF(resume, design)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
        role="dialog"
        aria-label="Choose resume design"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DocumentArrowDownIcon className="w-6 h-6 text-primary-600" />
            Download Resume
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-600 text-sm mb-4">Choose a design for your resume PDF:</p>
        <div className="space-y-3">
          {Object.entries(PARSED_RESUME_DESIGNS).map(([key, { primary, name, desc }]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleDownload(key)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition text-left"
            >
              <div
                className="w-12 h-12 rounded-xl shrink-0"
                style={{ backgroundColor: primary }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{name}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default DownloadResumeModal
