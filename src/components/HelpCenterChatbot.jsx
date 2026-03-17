import React from 'react'
import { XMarkIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

const HelpCenterChatbot = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right"
        role="dialog"
        aria-label="Help Center Chatbot"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Help Center</h2>
              <p className="text-xs text-primary-100">Chatbot — Coming soon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/90 hover:bg-white/20 transition"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Placeholder content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
            <ChatBubbleLeftRightIcon className="w-10 h-10 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chatbot Coming Soon</h3>
          <p className="text-gray-500 text-sm max-w-xs">
            Our AI assistant will help you with resume tips, ATS guidance, interview prep, and more. Detailed programming in progress.
          </p>
        </div>
      </div>
    </>
  )
}

export default HelpCenterChatbot
