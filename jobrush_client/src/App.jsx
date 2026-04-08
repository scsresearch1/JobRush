import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { HelpCenterProvider, useHelpCenter } from './context/HelpCenterContext'
import HelpCenterChatbot from './components/HelpCenterChatbot'
import LandingPage from './components/LandingPage'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ResumeUpload from './pages/ResumeUpload'
import ATSAnalysis from './pages/ATSAnalysis'
import ResumeImprovements from './pages/ResumeImprovements'
import SOPCoverLetter from './pages/SOPCoverLetter'
import MockInterview from './pages/MockInterview'
import Profile from './pages/Profile'
import AboutPage from './pages/AboutPage'
import CareersComingSoonPage from './pages/CareersComingSoonPage'
import PrivacyPage from './pages/PrivacyPage'
import TransitionPage from './components/TransitionPage'
import EmailCaptureModal from './components/EmailCaptureModal'
import PaymentAccessModal from './components/PaymentAccessModal'
import PresenceHeartbeat from './components/PresenceHeartbeat'
import LoadTestPage from '@jobrush/testing-engine/LoadTestPage.jsx'
import { hasAppAccess } from './utils/access.js'
import { getUser, syncUserFieldsToFirebase } from './services/database.js'
import { mapFirebaseUserToLocal, computeStartJourneyFlow } from './utils/journeyState.js'
import { QUOTA_ATS_MAX, QUOTA_MOCK_MAX } from './utils/quotas.js'

function ProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
  if (!hasAppAccess(user)) {
    return <Navigate to="/" replace />
  }
  return children
}

function isQuotaLockedUser(user) {
  if (!user || typeof user !== 'object') return false
  const ats = Number(user.atsChecksUsed) || 0
  const mock = Number(user.mockInterviewsUsed) || 0
  return user.accessStatus === 'suspended' || ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX
}

function FeatureRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
  if (isQuotaLockedUser(user)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function App() {
  const navigate = useNavigate()

  useEffect(() => {
    function mergeLocalUserFromFirebase() {
      const raw = localStorage.getItem('jobRush_user')
      if (!raw) return
      let u
      try {
        u = JSON.parse(raw)
      } catch {
        return
      }
      const uid = u?.uniqueId
      if (!uid || String(uid).startsWith('local_')) return
      getUser(uid)
        .then((data) => {
          if (!data) return
          let merged = {
            ...u,
            ...mapFirebaseUserToLocal(data, uid, u),
          }
          const ats = Number(merged.atsChecksUsed) || 0
          const mock = Number(merged.mockInterviewsUsed) || 0
          if (merged.accessStatus === 'active' && (ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX)) {
            merged = { ...merged, accessStatus: 'suspended' }
            syncUserFieldsToFirebase(uid, { accessStatus: 'suspended' }).catch(() => {})
          }
          localStorage.setItem('jobRush_user', JSON.stringify(merged))
        })
        .catch(() => {})
    }
    mergeLocalUserFromFirebase()
    window.addEventListener('focus', mergeLocalUserFromFirebase)
    return () => window.removeEventListener('focus', mergeLocalUserFromFirebase)
  }, [])

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    email: '',
    initialStep: 'offer',
    mode: 'activation',
  })

  const openPaymentModal = (email, initialStep = 'offer', mode = 'activation') => {
    setPaymentModal({ open: true, email: email || '', initialStep, mode })
  }

  const closePaymentModal = () => {
    setPaymentModal((prev) => ({ ...prev, open: false }))
  }

  const handleStartJourney = async () => {
    let user = {}
    try {
      user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
    } catch {
      user = {}
    }
    const uid = user?.uniqueId
    if (uid && !String(uid).startsWith('local_')) {
      try {
        const data = await getUser(uid)
        if (data) {
          let merged = { ...user, ...mapFirebaseUserToLocal(data, uid, user) }
          const ats = Number(merged.atsChecksUsed) || 0
          const mock = Number(merged.mockInterviewsUsed) || 0
          if (merged.accessStatus === 'active' && (ats >= QUOTA_ATS_MAX || mock >= QUOTA_MOCK_MAX)) {
            merged = { ...merged, accessStatus: 'suspended' }
            syncUserFieldsToFirebase(uid, { accessStatus: 'suspended' }).catch(() => {})
          }
          localStorage.setItem('jobRush_user', JSON.stringify(merged))
          user = merged
        }
      } catch {
        /* keep cached user */
      }
    }

    const flow = computeStartJourneyFlow(user)
    if (flow.kind === 'blocked_suspended') {
      window.alert('Your account is suspended. Please contact support.')
      return
    }
    if (flow.kind === 'app') {
      setShowTransition(true)
      return
    }
    if (flow.kind === 'repayment' && flow.email) {
      openPaymentModal(flow.email, 'offer', 'repayment')
      return
    }
    if (flow.kind === 'payment_confirmation' && flow.email) {
      openPaymentModal(flow.email, 'confirmation', 'activation')
      return
    }
    if (flow.kind === 'payment_offer' && flow.email) {
      openPaymentModal(flow.email, 'offer', 'activation')
      return
    }
    setShowEmailModal(true)
  }

  const handleEmailSuccess = ({ user: userData, flow }) => {
    setShowEmailModal(false)
    const kind = flow?.kind
    if (kind === 'app') {
      setShowTransition(true)
      return
    }
    if (kind === 'payment_confirmation') {
      openPaymentModal(userData?.email, 'confirmation', 'activation')
      return
    }
    if (kind === 'repayment') {
      openPaymentModal(userData?.email, 'offer', 'repayment')
      return
    }
    openPaymentModal(userData?.email, 'offer', 'activation')
  }

  const handleTransitionComplete = () => {
    setShowTransition(false)
    navigate('/resume-upload')
  }

  if (showTransition) {
    return <TransitionPage onComplete={handleTransitionComplete} />
  }

  return (
    <HelpCenterProvider>
      <AppContent
        showEmailModal={showEmailModal}
        setShowEmailModal={setShowEmailModal}
        handleEmailSuccess={handleEmailSuccess}
        handleStartJourney={handleStartJourney}
        paymentModal={paymentModal}
        closePaymentModal={closePaymentModal}
      />
    </HelpCenterProvider>
  )
}

function AppContent({
  showEmailModal,
  setShowEmailModal,
  handleEmailSuccess,
  handleStartJourney,
  paymentModal,
  closePaymentModal,
}) {
  const { isOpen, openChatbot, closeChatbot } = useHelpCenter()
  const handleQuotaReached = () => {
    let user = {}
    try {
      user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
    } catch {
      user = {}
    }
    const email = String(user?.email || '').trim()
    if (!email) return
    closePaymentModal()
    setShowEmailModal(false)
    setTimeout(() => {
      // Reuse the same payment window used at journey start.
      handleEmailSuccess({ user: { email }, flow: { kind: 'repayment' } })
    }, 0)
  }

  return (
    <>
      <PresenceHeartbeat />
      <PaymentAccessModal
        isOpen={paymentModal.open}
        onClose={closePaymentModal}
        email={paymentModal.email}
        initialStep={paymentModal.initialStep}
        mode={paymentModal.mode}
      />
      <EmailCaptureModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSuccess={handleEmailSuccess}
      />
      <HelpCenterChatbot isOpen={isOpen} onClose={closeChatbot} />
      <Routes>
        <Route path="/" element={<LandingPage onStartJourney={handleStartJourney} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/careers" element={<CareersComingSoonPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/load-test" element={<LoadTestPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout><Dashboard onQuotaReached={handleQuotaReached} /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-upload"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><ResumeUpload /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ats-analysis"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><ATSAnalysis /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-improvements"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><ResumeImprovements /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sop-cover-letter"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><SOPCoverLetter /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-interview"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><MockInterview /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <FeatureRoute>
                <Layout><Profile /></Layout>
              </FeatureRoute>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}

export default App
