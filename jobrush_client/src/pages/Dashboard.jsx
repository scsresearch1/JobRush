import React from 'react'
import { Link } from 'react-router-dom'
import {
  DocumentArrowUpIcon,
  ChartBarIcon,
  SparklesIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { MASS_HIRING_PROFILES } from '../ats/config/companyProfiles.js'
import { QUOTA_ATS_MAX, QUOTA_MOCK_MAX } from '../utils/quotas.js'

const Dashboard = ({ onQuotaReached }) => {
  const user = JSON.parse(localStorage.getItem('jobRush_user') || '{}')
  const atsUsed = Number(user?.atsChecksUsed) || 0
  const mockUsed = Number(user?.mockInterviewsUsed) || 0

  const features = [
    {
      to: '/resume-upload',
      icon: DocumentArrowUpIcon,
      title: 'Resume Upload & Parsing',
      description: 'Upload your CV and automatically extract skills, experience, education, and projects.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      to: '/ats-analysis',
      icon: ChartBarIcon,
      title: 'ATS Compatibility Score',
      description: `Evaluate your resume against ${MASS_HIRING_PROFILES.length} mass hiring companies and 10 universities. Get detailed analysis.`,
      color: 'from-indigo-500 to-purple-500',
      quotaReached: atsUsed >= QUOTA_ATS_MAX,
      quotaType: 'ats',
    },
    {
      to: '/resume-improvements',
      icon: SparklesIcon,
      title: 'AI Resume Improvements',
      description: 'Get targeted suggestions and apply automatic corrections to optimize for ATS.',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      to: '/sop-cover-letter',
      icon: DocumentTextIcon,
      title: 'SOP & Cover Letter',
      description: 'Generate customized Statements of Purpose and cover letters from your resume.',
      color: 'from-amber-500 to-orange-500',
    },
    {
      to: '/mock-interview',
      icon: VideoCameraIcon,
      title: 'AI HR Mock Interview',
      description: 'Practice with AI-powered HR interviews. Record responses and get performance analysis.',
      color: 'from-rose-500 to-pink-500',
      quotaReached: mockUsed >= QUOTA_MOCK_MAX,
      quotaType: 'mock',
    },
  ]

  return (
    <div>
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name || 'there'}!
        </h1>
        <p className="text-gray-600">
          Choose a feature to get started with your career acceleration journey.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Link
            key={feature.to}
            to={feature.quotaReached ? '#' : feature.to}
            onClick={(e) => {
              if (!feature.quotaReached) return
              e.preventDefault()
              onQuotaReached?.(feature.quotaType)
            }}
            className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-primary-200 hover:-translate-y-1"
          >
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
            >
              <feature.icon className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition">
              {feature.title}
            </h3>
            <p className="text-gray-600 text-sm mb-4">{feature.description}</p>
            <span className="inline-flex items-center text-primary-600 font-medium text-sm group-hover:gap-2 transition-all">
              {feature.quotaReached ? 'Quota completed - Pay again' : 'Get Started'}
              <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:ml-2 transition-all" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
