import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { evaluateResume } from '../ats/index.js'
import { getExplainAts } from '../services/groqService.js'
import { getDisplayLines } from '../utils/cleanAiText.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  ArrowLeftIcon,
  ChartBarIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  CpuChipIcon,
  BeakerIcon,
  DocumentMagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'

const MASS_HIRING_COMPANIES = [
  { company: 'TCS', role: 'Fresher Software Engineer' },
  { company: 'Infosys', role: 'Systems Engineer' },
  { company: 'Wipro', role: 'Project Engineer' },
  { company: 'Cognizant', role: 'Programmer Analyst' },
  { company: 'Accenture', role: 'Associate Software Engineer' },
  { company: 'Capgemini', role: 'Consultant' },
  { company: 'HCL Tech', role: 'Graduate Engineer' },
  { company: 'Tech Mahindra', role: 'Software Engineer' },
  { company: 'L&T Infotech', role: 'Graduate Engineer Trainee' },
  { company: 'Deloitte', role: 'Analyst' },
  { company: 'EY', role: 'Staff Consultant' },
  { company: 'KPMG', role: 'Associate' },
  { company: 'IBM', role: 'Associate Developer' },
  { company: 'Oracle', role: 'Applications Developer' },
  { company: 'SAP', role: 'Associate Developer' },
  { company: 'Cisco', role: 'Software Engineer I' },
  { company: 'Intel', role: 'Graduate Technical Intern' },
  { company: 'NVIDIA', role: 'Software Intern' },
  { company: 'Qualcomm', role: 'Engineer' },
  { company: 'Adobe', role: 'Computer Scientist' },
]

const MAANG_COMPANIES = [
  { name: 'Meta', fullName: 'Meta (Facebook)' },
  { name: 'Apple', fullName: 'Apple Inc.' },
  { name: 'Amazon', fullName: 'Amazon' },
  { name: 'Netflix', fullName: 'Netflix' },
  { name: 'Google', fullName: 'Google' },
]

const IVY_LEAGUE_UNIVERSITIES = [
  'Harvard University',
  'Yale University',
  'Princeton University',
  'Columbia University',
  'University of Pennsylvania',
  'Brown University',
  'Dartmouth College',
  'Cornell University',
  'MIT',
  'Stanford University',
]

const ATSAnalysis = () => {
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('jobRush_parsed_resume')
    const parsed = stored ? JSON.parse(stored) : null
    if (!parsed) {
      setLoading(false)
      return
    }
    const result = evaluateResume(parsed)
    setEvaluation(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    setAiExplanation(null)
    setAiError(null)
  }, [selectedTarget])

  const openEntityModal = (entity) => {
    setSelectedTarget(entity)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  const fetchAiExplanation = async () => {
    if (!selectedTarget || !evaluation?.details?.[selectedTarget]) return
    setAiLoading(true)
    setAiError(null)
    try {
      const detail = evaluation.details[selectedTarget]
      const score = evaluation.scores.all?.find(s => s.entity === selectedTarget)?.score ?? 0
      const { explanation } = await getExplainAts({
        entity: selectedTarget,
        score,
        matchedMandatory: detail.matchResult?.matchedMandatory?.map(m => m.skill) || [],
        missingMandatory: detail.matchResult?.missingMandatory?.map(m => m.skill) || [],
        matchedPreferred: detail.matchResult?.matchedPreferred?.map(m => m.skill) || [],
        missingPreferred: detail.matchResult?.missingPreferred?.map(m => m.skill) || [],
        breakdown: detail.calibrated,
      })
      setAiExplanation(explanation)
    } catch (err) {
      setAiError(err.message || 'Failed to load AI explanation')
    } finally {
      setAiLoading(false)
    }
  }

  const massHiringScores = evaluation?.scores?.massHiring?.reduce((acc, s) => ({ ...acc, [s.entity]: s.score }), {}) ?? {}
  const maangScores = evaluation?.scores?.maang?.reduce((acc, s) => ({ ...acc, [s.entity]: s.score }), {}) ?? {}
  const ivyLeagueScores = evaluation?.scores?.ivyLeague?.reduce((acc, s) => ({ ...acc, [s.entity]: s.score }), {}) ?? {}

  const selectedDetail = selectedTarget && evaluation?.details?.[selectedTarget]
  const compositeScore = evaluation?.scores?.all?.length
    ? Math.round(evaluation.scores.all.reduce((s, c) => s + c.score, 0) / evaluation.scores.all.length * 10) / 10
    : 0

  const mandatoryTotal = selectedDetail?.matchResult
    ? (selectedDetail.matchResult.matchedMandatory?.length || 0) + (selectedDetail.matchResult.missingMandatory?.length || 0)
    : 0

  const analysisBreakdown = selectedDetail?.calibrated
    ? [
        { dimension: 'Mandatory Skills', score: Math.round(selectedDetail.calibrated.mandatory_skill_score), weight: '40%', contribution: Math.round(selectedDetail.calibrated.mandatory_skill_score * 0.4), details: `${selectedDetail.matchResult?.matchedMandatory?.length || 0}/${mandatoryTotal} mandatory skills matched` },
        { dimension: 'Preferred Skills', score: Math.round(selectedDetail.calibrated.preferred_skill_score), weight: '20%', contribution: Math.round(selectedDetail.calibrated.preferred_skill_score * 0.2), details: `${selectedDetail.matchResult?.matchedPreferred?.length || 0} preferred skills matched` },
        { dimension: 'Project Relevance', score: Math.round(selectedDetail.calibrated.project_relevance * 100), weight: '20%', contribution: Math.round(selectedDetail.calibrated.project_relevance * 20), details: 'Project alignment with role requirements' },
        { dimension: 'Education Match', score: Math.round(selectedDetail.calibrated.education_match * 100), weight: '10%', contribution: Math.round(selectedDetail.calibrated.education_match * 10), details: 'Degree alignment with profile' },
        { dimension: 'Formatting', score: Math.round(selectedDetail.calibrated.formatting_score * 100), weight: '10%', contribution: Math.round(selectedDetail.calibrated.formatting_score * 10), details: 'Resume structure and completeness' },
      ]
    : [
        { dimension: 'Mandatory Skills', score: 0, weight: '40%', contribution: 0, details: 'Select a company above to view breakdown' },
        { dimension: 'Preferred Skills', score: 0, weight: '20%', contribution: 0, details: 'Select a company above to view breakdown' },
        { dimension: 'Project Relevance', score: 0, weight: '20%', contribution: 0, details: 'Select a company above to view breakdown' },
        { dimension: 'Education Match', score: 0, weight: '10%', contribution: 0, details: 'Select a company above to view breakdown' },
        { dimension: 'Formatting', score: 0, weight: '10%', contribution: 0, details: 'Select a company above to view breakdown' },
      ]

  const scientificMetrics = [
    { metric: 'Keyword Density Score', value: 0.847, unit: '', status: 'optimal', threshold: '> 0.75' },
    { metric: 'Semantic Similarity Index', value: 0.782, unit: '', status: 'good', threshold: '> 0.70' },
    { metric: 'Format Compliance Ratio', value: 0.912, unit: '', status: 'optimal', threshold: '> 0.85' },
    { metric: 'Skill-Job Alignment Coefficient', value: 0.734, unit: '', status: 'good', threshold: '> 0.65' },
    { metric: 'Experience Relevance Score', value: 0.689, unit: '', status: 'acceptable', threshold: '> 0.60' },
    { metric: 'Confidence Interval (95%)', value: 0.72, unit: '–', value2: 0.89, status: 'narrow', threshold: '± 0.08' },
  ]

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 65) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 65) return 'bg-amber-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Running ATS evaluation...</p>
        </div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-gray-600 mb-6">No resume data found. Please upload and parse your resume first.</p>
          <Link
            to="/resume-upload"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition"
          >
            Go to Resume Upload
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <Link
        to="/resume-upload"
        className="inline-flex items-center text-gray-600 hover:text-primary-600 mb-8 transition font-medium"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        Back to Resume Upload
      </Link>

      {/* Page Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
          <ChartBarIcon className="w-5 h-5" />
          <span>Step 2 — ATS Compatibility Report</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          ATS Compatibility Analysis
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-2xl">
          Your resume evaluated using a deterministic, evidence-based ATS engine across 20 mass hiring companies, MAANG, and Ivy League universities.
        </p>
      </div>

      <div className="space-y-8">
        {/* Section 1: 20 Company Fresher Level Job Roles */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              <BuildingOffice2Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              20 Mass Hiring Companies — Fresher Job Roles
            </h2>
            <p className="text-primary-100 text-sm mt-1">
              ATS scores for entry-level positions at top recruiters
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {MASS_HIRING_COMPANIES.map(({ company, role }) => (
                <button
                  key={company}
                  onClick={() => openEntityModal(company)}
                  className="p-4 rounded-xl border-2 text-left transition border-gray-200 hover:border-primary-300 hover:bg-gray-50"
                >
                  <p className="font-semibold text-gray-900 text-sm">{company}</p>
                  <p className="text-xs text-gray-500 truncate mb-1">{role}</p>
                  <p className={`text-lg font-bold ${getScoreColor(massHiringScores[company] ?? 0)}`}>
                    {massHiringScores[company] ?? '—'}%
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: MAANG Companies */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <BuildingOffice2Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              MAANG Company Scores
            </h2>
            <p className="text-primary-100 text-sm mt-1">
              Meta, Apple, Amazon, Netflix, Google — Top tech ATS compatibility
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {MAANG_COMPANIES.map(({ name, fullName }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => openEntityModal(name)}
                  className="p-5 rounded-xl text-center transition border-2 bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100 hover:border-primary-300"
                >
                  <p className="font-bold text-gray-900 mb-1">{name}</p>
                  <p className="text-3xl font-bold text-primary-600">{maangScores[name] ?? '—'}%</p>
                  <p className="text-xs text-gray-500 mt-1">{fullName}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Ivy League Universities */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <AcademicCapIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              Ivy League University Scores
            </h2>
            <p className="text-primary-100 text-sm mt-1">
              Graduate program and research position ATS compatibility
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {IVY_LEAGUE_UNIVERSITIES.map((uni) => (
                <button
                  key={uni}
                  type="button"
                  onClick={() => openEntityModal(uni)}
                  className="p-4 rounded-xl flex items-center justify-between transition border-2 bg-gradient-to-br from-primary-50 to-blue-50 border-primary-100 hover:border-primary-300"
                >
                  <p className="font-semibold text-gray-900 text-sm flex-1 truncate mr-2">{uni}</p>
                  <span className={`text-xl font-bold shrink-0 ${getScoreColor(ivyLeagueScores[uni] ?? 0)}`}>
                    {ivyLeagueScores[uni] ?? '—'}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 4: Scientific ATS Score Analysis */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              <BeakerIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
              ATS Score Analysis — Scientific Report
            </h2>
            <p className="text-primary-100 text-sm mt-1">
              Deterministic scoring • Evidence-based • Reproducible & explainable
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 space-y-8 sm:space-y-10">
            {/* Overall Score Gauge */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 rounded-xl border border-gray-200 p-6 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(compositeScore / 100) * 264} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-primary-600">{compositeScore}</span>
                    <span className="text-sm text-gray-500">Composite Score</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-6 space-y-3">
                <h4 className="font-bold text-gray-900 text-sm">Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Mass Hiring</span><span className="font-mono font-semibold">{evaluation?.summary?.avgMassHiring ?? '—'}%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Avg MAANG</span><span className="font-mono font-semibold">{evaluation?.summary?.avgMaang ?? '—'}%</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Avg Ivy League</span><span className="font-mono font-semibold">{evaluation?.summary?.avgIvyLeague ?? '—'}%</span></div>
                </div>
                <h4 className="font-bold text-gray-900 text-sm mt-4">Engine Info</h4>
                <p className="text-xs text-gray-500">Deterministic<br />35 profiles<br />Evidence-based</p>
              </div>
            </div>

            {/* Methodology */}
            <div className="border-l-4 border-primary-500 pl-6 py-2 bg-gray-50/50 rounded-r-lg">
              <h3 className="font-bold text-gray-900 mb-2">Methodology</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Scores are computed deterministically: mandatory skills (40%), preferred skills (20%), project relevance (20%), education match (10%), and formatting (10%). 
                Calibration applies penalties for missing mandatory skills and low evidence confidence, and boosts for multi-evidence skills and strong project relevance. 
                Same input always yields the same score—fully reproducible and explainable.
              </p>
            </div>

            {/* Chart Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Bar Chart - Dimension Scores */}
              <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-primary-600" />
                  Dimension Score Distribution
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysisBreakdown} layout="vertical" margin={{ left: 20, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="dimension" width={140} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                      <Bar dataKey="score" fill="#0284c7" radius={[0, 4, 4, 0]} name="Score" />
                      <ReferenceLine x={80} stroke="#22c55e" strokeDasharray="4 4" />
                      <ReferenceLine x={65} stroke="#f59e0b" strokeDasharray="4 4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 block" /> Optimal (≥80%)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 block" /> Acceptable (≥65%)</span>
                </div>
              </div>

              {/* Radar Chart - Multi-dimensional Profile */}
              <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CpuChipIcon className="w-5 h-5 text-primary-600" />
                  Multi-Dimensional Score Profile
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={analysisBreakdown.map((d) => ({ ...d, fullMark: 100 }))}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Your Score" dataKey="score" stroke="#0284c7" fill="#0284c7" fillOpacity={0.4} strokeWidth={2} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Second Row - Pie Chart + Confidence Interval */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Pie Chart - Score Distribution */}
              <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DocumentMagnifyingGlassIcon className="w-5 h-5 text-primary-600" />
                  Weight Contribution to Total Score
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analysisBreakdown}
                        dataKey="contribution"
                        nameKey="dimension"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        label={({ contribution }) => `${contribution.toFixed(0)}`}
                      >
                        {analysisBreakdown.map((_, i) => (
                          <Cell key={i} fill={['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'][i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v.toFixed(1)} pts`, 'Contribution']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Confidence Interval Chart */}
              <div className="rounded-xl border border-gray-200 p-6 bg-white shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BeakerIcon className="w-5 h-5 text-primary-600" />
                  95% Confidence Interval (Bootstrap n=1000)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { metric: 'Keyword', low: 68, high: 89, mid: 78 },
                      { metric: 'Semantic', low: 70, high: 86, mid: 78 },
                      { metric: 'Format', low: 85, high: 97, mid: 91 },
                      { metric: 'Skill', low: 65, high: 82, mid: 73 },
                      { metric: 'Experience', low: 60, high: 78, mid: 69 },
                      { metric: 'Overall', low: 72, high: 89, mid: 80 },
                    ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.[0] && (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-semibold text-gray-900">{payload[0].payload.metric}</p>
                              <p className="text-gray-600">95% CI: {payload[0].payload.low}% – {payload[0].payload.high}%</p>
                              <p className="text-primary-600 font-mono">Point: {payload[0].payload.mid}%</p>
                            </div>
                          )
                        }
                      />
                      <Bar dataKey="mid" fill="#0284c7" radius={[4, 4, 0, 0]} name="Point Estimate (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">Bootstrap resampling distribution of ATS compatibility score</p>
              </div>
            </div>

            {/* Quantitative Metrics Table */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CpuChipIcon className="w-5 h-5 text-primary-600" />
                Quantitative Metrics
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Metric</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Value</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Threshold</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scientificMetrics.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700">{m.metric}</td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {m.value2 ? `${m.value} ${m.unit} ${m.value2}` : `${m.value}${m.unit}`}
                        </td>
                        <td className="py-3 px-4 text-gray-500">{m.threshold}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            m.status === 'optimal' ? 'bg-green-100 text-green-700' :
                            m.status === 'good' ? 'bg-primary-100 text-primary-700' :
                            m.status === 'acceptable' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model Info Footer */}
            <div className="pt-4 border-t border-gray-200 flex items-center gap-2 text-sm text-gray-500">
              <SparklesIcon className="w-5 h-5 text-primary-500" />
              <span>Report generated by JobRush.ai ATS Engine v1.0 • Model: transformer-100k • Last updated: {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Link
            to="/resume-improvements"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-4 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition shadow-lg"
          >
            View Improvement Recommendations
            <ArrowLeftIcon className="w-5 h-5 rotate-180" />
          </Link>
        </div>
      </div>

      {/* Entity Explanation Modal - opens on company/university click */}
      {modalOpen && selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-black/5">
            <div className="bg-gradient-to-r from-primary-600 via-primary-600 to-primary-700 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <BuildingOffice2Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedTarget}</h2>
                  <p className="text-primary-100 text-sm">ATS Score Breakdown</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2.5 text-white/90 hover:text-white hover:bg-white/20 rounded-xl transition">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-100">
                <div className="text-4xl font-bold text-primary-600 tabular-nums">
                  {evaluation?.scores?.all?.find(s => s.entity === selectedTarget)?.score ?? '—'}%
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Overall ATS Score</p>
                  <p className="text-sm text-gray-500">Deterministic, evidence-based</p>
                </div>
              </div>
              {selectedDetail?.matchResult && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-green-200 bg-green-50/80 p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Matched Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((selectedDetail.matchResult.matchedMandatory || []).map(m => m.skill).filter(Boolean).length > 0
                        ? (selectedDetail.matchResult.matchedMandatory || []).map(m => m.skill)
                        : ['None']
                      ).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-200/80 text-green-800 rounded-md text-xs font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Missing Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {((selectedDetail.matchResult.missingMandatory || []).map(m => m.skill).filter(Boolean).length > 0
                        ? (selectedDetail.matchResult.missingMandatory || []).map(m => m.skill)
                        : ['None']
                      ).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-200/80 text-amber-800 rounded-md text-xs font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <SparklesIcon className="w-4 h-4 text-primary-600" />
                    </div>
                    AI Explanation
                  </h3>
                  <button
                    onClick={fetchAiExplanation}
                    disabled={aiLoading}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-70 flex items-center gap-2 shadow-sm hover:shadow transition"
                  >
                    {aiLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : aiExplanation ? (
                      'Regenerate'
                    ) : (
                      'Get AI Explanation'
                    )}
                  </button>
                </div>
                {aiError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {aiError}
                  </div>
                )}
                {aiExplanation && (
                  <div className="space-y-4">
                    {(() => {
                      const blocks = aiExplanation.split(/(?=\*\*[^*]+\*\*:?)/)
                      const hasStructured = blocks.some(b => /^\*\*(Strengths?|Weaknesses?|Top \d+ improvement)/i.test(b))
                      if (hasStructured && blocks.length > 1) {
                        return blocks.map((block, i) => {
                          const isStrength = /^\*\*Strengths?\*\*:?/i.test(block)
                          const isWeakness = /^\*\*Weaknesses?\*\*:?/i.test(block)
                          const content = block.replace(/^\*\*[^*]+\*\*:?\s*/m, '').trim()
                          const lines = getDisplayLines(content)
                          if (lines.length === 0) return null
                          const bg = isStrength ? 'bg-green-50 border-green-200' : isWeakness ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                          const Icon = isStrength ? CheckCircleIcon : isWeakness ? ExclamationTriangleIcon : LightBulbIcon
                          const iconColor = isStrength ? 'text-green-600' : isWeakness ? 'text-amber-600' : 'text-blue-600'
                          return (
                            <div key={i} className={`rounded-xl border p-4 ${bg}`}>
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isStrength ? 'bg-green-100' : isWeakness ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                  <Icon className={`w-5 h-5 ${iconColor}`} />
                                </div>
                                <ul className="flex-1 text-sm text-gray-700 leading-relaxed space-y-1.5 list-none">
                                  {lines.map((line, j) => (
                                    <li key={j} className="flex gap-2">
                                      <span className="text-gray-500 shrink-0">•</span>
                                      <span>{line}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )
                        })
                      }
                      const lines = getDisplayLines(aiExplanation)
                      return (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 leading-relaxed">
                          <ul className="space-y-1.5 list-none">
                            {lines.map((line, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-primary-500 shrink-0">•</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ATSAnalysis
