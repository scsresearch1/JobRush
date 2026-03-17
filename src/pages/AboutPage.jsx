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
  ArrowRightIcon,
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
  <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
    {/* Ambient background */}
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary-600/8 rounded-full blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.15),transparent)]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
    </div>

    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Nav */}
      <nav className="mb-12 sm:mb-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-primary-400 transition font-medium text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Home
        </Link>
      </nav>

      {/* Hero */}
      <header className="mb-20 sm:mb-28">
        <p className="text-primary-400 font-semibold text-sm uppercase tracking-widest mb-4">About Us</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
          <span className="text-white">About </span>
          <span className="gradient-text">JobRush.ai</span>
        </h1>
        <div className="max-w-2xl space-y-6 text-slate-400 text-lg leading-relaxed">
          <p>
            JobRush.ai is built with a single objective: to convert raw candidate potential into measurable, job-ready performance. It is a precision-driven career acceleration platform designed to bridge the gap between academic output and real-world hiring expectations—without exposing or depending on underlying technical complexity.
          </p>
          <p>
            The platform is conceptualized and engineered by a core team of five highly accomplished former HR professionals who have operated at scale within leading global organizations including Infosys, TCS, Microsoft, Google, and Amazon. This foundation ensures that every feature is grounded in actual hiring behavior, not theoretical assumptions.
          </p>
        </div>
      </header>

      {/* What We Deliver */}
      <section className="mb-24 sm:mb-32">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">What We Deliver</h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Outcome-driven capabilities, not superficial tooling.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {DELIVERY_ITEMS.map((item, i) => (
            <div
              key={i}
              className="group relative bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-800/80 hover:border-primary-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/5"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-4 shadow-lg shadow-primary-500/20">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-3 group-hover:text-primary-200 transition-colors">{item.title}</h3>
                <ul className="space-y-2">
                  {item.points.map((point, j) => (
                    <li key={j} className="flex gap-2 text-slate-400 text-sm leading-relaxed">
                      <span className="text-primary-500 shrink-0 mt-0.5">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Design Philosophy */}
      <section className="mb-24 sm:mb-32">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-12">Design Philosophy</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {DESIGN_PRINCIPLES.map((principle, i) => (
            <div
              key={i}
              className="flex gap-4 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/80 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
                <principle.icon className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1.5">{principle.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{principle.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why JobRush.ai Exists — Featured block */}
      <section className="relative rounded-3xl overflow-hidden mb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(0,0,0,0.2),transparent)]" />
        <div className="relative p-8 sm:p-12 lg:p-16">
          <p className="text-primary-200/90 text-sm font-semibold uppercase tracking-widest mb-4">Our Differentiator</p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 max-w-2xl">
            Why JobRush.ai Exists
          </h2>
          <p className="text-lg text-primary-50/95 leading-relaxed mb-4 max-w-2xl">
            Most platforms simulate preparation. JobRush.ai enforces alignment with real hiring systems.
          </p>
          <p className="text-primary-100/90 leading-relaxed mb-6 max-w-2xl">
            It does not train candidates to &ldquo;appear better.&rdquo;
            <br />
            It restructures them to become evaluable, comparable, and selectable in competitive pipelines.
          </p>
          <p className="text-white font-semibold text-lg">
            This distinction is the core differentiator.
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-8 py-4 rounded-xl font-semibold transition shadow-lg shadow-primary-500/25 hover:shadow-primary-500/30"
        >
          Get Started
          <ArrowRightIcon className="w-5 h-5" />
        </Link>
      </div>
    </div>
  </div>
)

export default AboutPage
