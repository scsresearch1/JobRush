import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ChartBarIcon,
  SparklesIcon,
  VideoCameraIcon,
  BeakerIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const DELIVERY_ITEMS = [
  {
    icon: DocumentTextIcon,
    title: 'Intelligent Resume Structuring',
    points: [
      'Converts unstructured resumes into standardized, recruiter-readable formats',
      'Enables editing, refinement, and export-ready outputs',
    ],
  },
  {
    icon: ChartBarIcon,
    title: 'Targeted ATS Evaluation',
    points: [
      'Provides deterministic scoring aligned with real hiring pipelines',
      'Benchmarks profiles across global enterprises, MAANG-level companies, and top universities',
      'Generates structured analytical reports with actionable insights',
    ],
  },
  {
    icon: SparklesIcon,
    title: 'Precision Resume Optimization',
    points: [
      'Identifies weak signals in candidate profiles',
      'Recommends high-impact improvements mapped to hiring expectations',
      'Enables rapid correction and profile enhancement',
    ],
  },
  {
    icon: VideoCameraIcon,
    title: 'AI-Guided HR Interview Simulation',
    points: [
      'Generates context-aware HR questions derived from candidate profiles',
      'Evaluates behavioral signals such as confidence, eye contact, and composure',
      'Produces structured performance reports with measurable metrics',
    ],
  },
  {
    icon: BeakerIcon,
    title: 'Behavioral Intelligence Reporting',
    points: [
      'Quantifies interview readiness using multi-dimensional scoring',
      'Tracks emotional stability, engagement levels, and response consistency',
      'Provides actionable guidance for improvement',
    ],
  },
  {
    icon: DocumentTextIcon,
    title: 'Application Content Generation',
    points: [
      'Produces structured Statements of Purpose for academic applications',
      'Generates targeted cover letters aligned with specific roles and organizations',
    ],
  },
]

const DESIGN_PRINCIPLES = [
  {
    icon: UserGroupIcon,
    title: 'Recruiter-Centric, Not Candidate-Assumed',
    description: 'Every feature is modeled on how hiring decisions are actually made inside large organizations.',
  },
  {
    icon: LightBulbIcon,
    title: 'Evidence-Based Evaluation',
    description: 'Scoring, recommendations, and feedback are grounded in structured logic—not generic AI outputs.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Privacy-First Architecture',
    description: 'Sensitive candidate data and behavioral signals are processed locally wherever possible.',
  },
  {
    icon: ChartBarIcon,
    title: 'Outcome Over Interface',
    description: 'The focus is not on visual appeal but on measurable improvement in hiring readiness.',
  },
]

const AboutPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-10 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Home
      </Link>

      {/* Hero */}
      <header className="mb-16">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
          About <span className="gradient-text">JobRush.ai</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-700 leading-relaxed">
          JobRush.ai is built with a single objective: to convert raw candidate potential into measurable, job-ready performance. It is a precision-driven career acceleration platform designed to bridge the gap between academic output and real-world hiring expectations—without exposing or depending on underlying technical complexity.
        </p>
        <p className="mt-6 text-gray-700 leading-relaxed">
          The platform is conceptualized and engineered by a core team of five highly accomplished former HR professionals who have operated at scale within leading global organizations including Infosys, TCS, Microsoft, Google, and Amazon. This foundation ensures that every feature is grounded in actual hiring behavior, not theoretical assumptions.
        </p>
      </header>

      {/* What We Deliver */}
      <section className="mb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">What We Deliver</h2>
        <p className="text-gray-600 mb-10">
          JobRush.ai focuses on outcome-driven capabilities, not superficial tooling.
        </p>
        <div className="space-y-8">
          {DELIVERY_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg border border-gray-100 hover:border-primary-100 transition"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shrink-0">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
                  <ul className="space-y-2">
                    {item.points.map((point, j) => (
                      <li key={j} className="flex gap-2 text-gray-700">
                        <span className="text-primary-500 mt-1.5 shrink-0">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Design Philosophy */}
      <section className="mb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Design Philosophy</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {DESIGN_PRINCIPLES.map((principle, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <principle.icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">{principle.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{principle.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why JobRush.ai Exists */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 sm:p-10 text-white">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6">Why JobRush.ai Exists</h2>
        <p className="text-lg text-primary-50 leading-relaxed mb-6">
          Most platforms simulate preparation. JobRush.ai enforces alignment with real hiring systems.
        </p>
        <p className="text-primary-100 leading-relaxed mb-6">
          It does not train candidates to &ldquo;appear better.&rdquo;<br />
          It restructures them to become evaluable, comparable, and selectable in competitive pipelines.
        </p>
        <p className="text-white font-semibold text-lg">
          This distinction is the core differentiator.
        </p>
      </section>

      {/* CTA */}
      <div className="mt-16 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-700 transition shadow-lg"
        >
          Get Started
          <ArrowLeftIcon className="w-5 h-5 rotate-180" />
        </Link>
      </div>
    </div>
  </div>
)

export default AboutPage
