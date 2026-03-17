import React, { useState, useRef, useEffect } from 'react'
import { XMarkIcon, PaperAirplaneIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { chatSelectra } from '../services/groqService.js'

const WELCOME = 'Hi! I\'m Selectra, your career assistant. Ask me about resume tips, ATS guidance, interview prep, or anything about JobRush.ai.'

/** Renders text with **bold** converted to <strong> */
function FormattedMessage({ text }) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  )
}

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
        className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md flex flex-col animate-in slide-in-from-right bg-white shadow-2xl border-l border-gray-200"
        role="dialog"
        aria-label="Selectra Help Center"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-gradient-to-r from-primary-600 to-primary-500 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center shadow-inner">
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
            className="p-2 rounded-xl text-white/90 hover:bg-white/20 transition"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages area - subtle gradient matching site */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-gradient-to-b from-gray-50/80 to-white">
          <div className="p-4 space-y-5">
            {displayMessages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mb-5 shadow-sm border border-primary-100">
                  <ChatBubbleLeftRightIcon className="w-10 h-10 text-primary-600" />
                </div>
                <p className="text-gray-700 text-base max-w-sm leading-relaxed font-medium">{WELCOME}</p>
                <p className="text-gray-500 text-sm mt-6">Type a question below to get started.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {['Resume tips?', 'ATS help?', 'Interview prep?'].map((s) => (
                    <span key={s} className="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium border border-primary-100">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {displayMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                  }`}
                >
                  {msg.content ? (
                    msg.role === 'user' ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <FormattedMessage text={msg.content} />
                    )
                  ) : showError && msg.role === 'assistant' && i === displayMessages.length - 1 ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : null}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 shrink-0 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about resumes, interviews, or JobRush.ai..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 min-h-[46px] max-h-32 shadow-sm"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-white flex items-center justify-center hover:from-primary-700 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg"
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
