import React, { useState, useRef, useEffect } from 'react'
import { XMarkIcon, PaperAirplaneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { chatSelectra } from '../services/groqService.js'

const WELCOME = 'Hi! I\'m Selectra, your career assistant. Ask me about resume tips, ATS guidance, interview prep, or anything about JobRush.ai.'

const HelpCenterChatbot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const { reply } = await chatSelectra(history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setMessages((prev) => [...prev, { role: 'assistant', content: null }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  const displayMessages = messages.length === 0 ? [] : messages
  const lastAssistant = displayMessages.filter((m) => m.role === 'assistant').pop()
  const showError = error && lastAssistant?.content === null

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
        aria-label="Selectra Help Center"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-500 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Selectra</h2>
              <p className="text-xs text-primary-100">Your career assistant</p>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {displayMessages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary-600" />
              </div>
              <p className="text-gray-600 text-sm max-w-xs leading-relaxed">{WELCOME}</p>
              <p className="text-gray-400 text-xs mt-8">Type a question below to get started.</p>
            </div>
          )}
          {displayMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.content ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : showError && msg.role === 'assistant' && i === displayMessages.length - 1 ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : null}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about resumes, interviews, or JobRush.ai..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px] max-h-32"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              aria-label="Send"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default HelpCenterChatbot
