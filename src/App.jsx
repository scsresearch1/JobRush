import React, { useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ResumeUpload from './pages/ResumeUpload'
import ATSAnalysis from './pages/ATSAnalysis'
import ResumeImprovements from './pages/ResumeImprovements'
import SOPCoverLetter from './pages/SOPCoverLetter'
import MockInterview from './pages/MockInterview'
import Profile from './pages/Profile'
import TransitionPage from './components/TransitionPage'
import EmailCaptureModal from './components/EmailCaptureModal'

function ProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
  if (!user?.isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  const navigate = useNavigate()
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showTransition, setShowTransition] = useState(false)

  const handleStartJourney = () => {
    const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
    if (user?.isAuthenticated) {
      setShowTransition(true)
    } else {
      setShowEmailModal(true)
    }
  }

  const handleEmailSuccess = () => {
    setShowEmailModal(false)
    setShowTransition(true)
  }

  const handleTransitionComplete = () => {
    setShowTransition(false)
    navigate('/resume-upload')
  }

  if (showTransition) {
    return <TransitionPage onComplete={handleTransitionComplete} />
  }

  return (
    <>
      <EmailCaptureModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSuccess={handleEmailSuccess}
      />
      <Routes>
        <Route path="/" element={<LandingPage onStartJourney={handleStartJourney} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-upload"
          element={
            <ProtectedRoute>
              <Layout><ResumeUpload /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ats-analysis"
          element={
            <ProtectedRoute>
              <Layout><ATSAnalysis /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-improvements"
          element={
            <ProtectedRoute>
              <Layout><ResumeImprovements /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sop-cover-letter"
          element={
            <ProtectedRoute>
              <Layout><SOPCoverLetter /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-interview"
          element={
            <ProtectedRoute>
              <Layout><MockInterview /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout><Profile /></Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
