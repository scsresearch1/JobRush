import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  BriefcaseIcon, 
  AcademicCapIcon, 
  ChartBarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import DemoModal from './DemoModal'
import AnimatedCounter from './AnimatedCounter'
import { useHelpCenter } from '../context/HelpCenterContext'
import { MASS_HIRING_PROFILES } from '../ats/config/companyProfiles.js'

const SparklesIconSVG = () => (
  <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const LandingPage = ({ onStartJourney }) => {
  const { openChatbot } = useHelpCenter()
  const [isDemoOpen, setIsDemoOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isLoggedIn = typeof window !== 'undefined' && JSON.parse(localStorage.getItem('jobRush_user') || '{}')?.isAuthenticated
  const [currentTagline, setCurrentTagline] = useState(0)
  const [isFading, setIsFading] = useState(false)

  const taglines = [
    "Your Career Acceleration Platform",
    "Land Your Dream Job Faster",
    "Trusted by 10,000+ Students Worldwide",
    "AI Technology Meets Human Expertise"
  ]

  // Rotate taglines with smooth fade transition
  useEffect(() => {
    let timeoutId = null
    const interval = setInterval(() => {
      setIsFading(true)
      timeoutId = setTimeout(() => {
        setCurrentTagline((prev) => (prev + 1) % taglines.length)
        setIsFading(false)
      }, 300) // Half of fade duration
    }, 4000) // Change every 4 seconds
    return () => {
      clearInterval(interval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [taglines.length])

  const features = [
    {
      icon: <AcademicCapIcon className="w-8 h-8" />,
      title: "Resume Upload & ATS Scoring",
      description: `Upload your CV, auto-extract skills and experience, and get compatibility scores across ${MASS_HIRING_PROFILES.length} mass hiring companies and 10 universities.`
    },
    {
      icon: <ChartBarIcon className="w-8 h-8" />,
      title: "AI Resume Improvement",
      description: "Get targeted suggestions and apply automatic corrections to optimize your resume for ATS systems."
    },
    {
      icon: <BriefcaseIcon className="w-8 h-8" />,
      title: "AI Mock Interview",
      description: "Practice with HR-style questions. Record video responses and get confidence, tone, and performance analysis."
    },
    {
      icon: <UserGroupIcon className="w-8 h-8" />,
      title: "SOP & Cover Letter",
      description: "Generate customized Statements of Purpose and cover letters using your resume data."
    }
  ]

  const benefits = [
    `ATS compatibility across ${MASS_HIRING_PROFILES.length} mass hiring targets`,
    "Scientific resume analysis reports",
    "Video-based mock interviews",
    "Confidence & emotion analysis",
    "One-click resume corrections",
    "AI-generated cover letters"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center shrink-0">
                <BriefcaseIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold gradient-text">JobRush.ai</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-primary-600 transition">Features</a>
              <a href="#benefits" className="text-gray-700 hover:text-primary-600 transition">Benefits</a>
              <Link to="/about" className="text-gray-700 hover:text-primary-600 transition">About</Link>
              <button type="button" onClick={openChatbot} className="text-gray-700 hover:text-primary-600 transition">Help Center</button>
              {isLoggedIn ? (
                <Link to="/dashboard" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition shadow-lg hover:shadow-xl">
                  Dashboard
                </Link>
              ) : (
                <button onClick={onStartJourney} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition shadow-lg hover:shadow-xl">
                  Get Started
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
          {mobileNavOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 flex flex-col gap-1">
              <a href="#features" onClick={() => setMobileNavOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">Features</a>
              <a href="#benefits" onClick={() => setMobileNavOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">Benefits</a>
              <Link to="/about" onClick={() => setMobileNavOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">About</Link>
              <button type="button" onClick={() => { openChatbot(); setMobileNavOpen(false) }} className="px-4 py-3 text-left text-gray-700 hover:bg-gray-100 rounded-lg">Help Center</button>
              {isLoggedIn ? (
                <Link to="/dashboard" onClick={() => setMobileNavOpen(false)} className="mx-4 mt-2 bg-primary-600 text-white px-6 py-3 rounded-lg text-center font-medium">
                  Dashboard
                </Link>
              ) : (
                <button onClick={() => { onStartJourney?.(); setMobileNavOpen(false) }} className="mx-4 mt-2 bg-primary-600 text-white px-6 py-3 rounded-lg font-medium w-[calc(100%-2rem)]">
                  Get Started
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <div className="inline-flex items-center space-x-3 bg-primary-100 text-primary-700 px-6 py-3 rounded-full text-lg md:text-xl font-semibold mb-6">
              <SparklesIconSVG />
              <span 
                key={currentTagline}
                className={`transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'}`}
              >
                {taglines[currentTagline]}
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Land Your Dream Job with
              <span className="block gradient-text mt-2">JobRush.ai</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Your career acceleration platform. Land your dream job faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={onStartJourney || (() => {})}
                className="bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-700 transition shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center space-x-2"
              >
                <span>Start Your Journey</span>
                <ArrowRightIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsDemoOpen(true)}
                className="bg-white text-primary-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition shadow-lg border-2 border-primary-600 hover:scale-105 transform"
              >
                Watch Demo
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                <AnimatedCounter end={10} suffix="K+" duration={2000} startDelay={200} />
              </div>
              <div className="text-gray-600">Candidates Helped</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                <AnimatedCounter end={500} suffix="+" duration={2000} startDelay={400} />
              </div>
              <div className="text-gray-600">ATS Targets</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                <AnimatedCounter end={95} suffix="%" duration={2000} startDelay={600} />
              </div>
              <div className="text-gray-600">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600 mb-2">
                <AnimatedCounter end={4.9} suffix="★" duration={2000} startDelay={800} />
              </div>
              <div className="text-gray-600">User Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything You Need to <span className="gradient-text">Succeed</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to land your dream job faster
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-2 border border-gray-100"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-gradient-to-br from-primary-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Why Choose <span className="gradient-text">JobRush.ai</span>?
              </h2>
              <p className="text-xl text-gray-700 mb-8">
                We've built a comprehensive platform that covers resume optimization, ATS compatibility, and AI-powered mock interviews to accelerate your job search.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircleIcon className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-12">
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <BriefcaseIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Personalized Learning</h3>
                    <p className="text-gray-600">AI-powered recommendations based on your profile</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <ChartBarIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Track Progress</h3>
                    <p className="text-gray-600">Monitor your improvement with detailed analytics</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <UserGroupIcon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Community Support</h3>
                    <p className="text-gray-600">Connect with peers and mentors in our community</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Career?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands who have accelerated their careers with JobRush.ai
          </p>
          <button onClick={onStartJourney} className="bg-white text-primary-600 px-10 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition shadow-2xl transform hover:scale-105 flex items-center space-x-2 mx-auto">
            <span>Get Started</span>
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
                  <BriefcaseIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">JobRush.ai</span>
              </div>
              <p className="text-gray-400">
                Your career acceleration platform.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="hover:text-white transition">About</Link></li>
                <li><Link to="/careers" className="hover:text-white transition">Careers — Coming Soon</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><button type="button" onClick={openChatbot} className="text-gray-300 hover:text-white transition text-left">Help Center</button></li>
                <li><Link to="/privacy" className="hover:text-white transition text-sm">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 JobRush.ai. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </div>
  )
}

export default LandingPage

