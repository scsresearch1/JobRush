import React, { createContext, useContext, useState } from 'react'

const HelpCenterContext = createContext(null)

export function HelpCenterProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const openChatbot = () => setIsOpen(true)
  const closeChatbot = () => setIsOpen(false)
  return (
    <HelpCenterContext.Provider value={{ isOpen, openChatbot, closeChatbot }}>
      {children}
    </HelpCenterContext.Provider>
  )
}

export function useHelpCenter() {
  const ctx = useContext(HelpCenterContext)
  if (!ctx) throw new Error('useHelpCenter must be used within HelpCenterProvider')
  return ctx
}
