import React from 'react'
import { BuildingOffice2Icon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

function estimateLift(scoreRow, recommendation) {
  const b = scoreRow?.breakdown || {}
  const missingMandatory = Array.isArray(scoreRow?.missing_mandatory) ? scoreRow.missing_mandatory.length : 0
  const missingPreferred = Array.isArray(scoreRow?.missing_preferred) ? scoreRow.missing_preferred.length : 0
  const section = String(recommendation?.section || '').toLowerCase()
  const suggestion = String(recommendation?.suggestion || '').toLowerCase()

  let lift = 0
  if (section.includes('skill') || section.includes('keyword')) {
    lift += Math.min(7, missingMandatory * 1.2)
    lift += Math.min(3, missingPreferred * 0.45)
  }
  if (section.includes('experience')) {
    lift += Number(b.project_relevance || 0) < 72 ? 3.2 : 1.4
  }
  if (section.includes('project')) {
    lift += Number(b.project_relevance || 0) < 72 ? 3.5 : 1.6
  }
  if (section.includes('format')) {
    lift += Number(b.formatting_score || 0) < 80 ? 2 : 0.8
  }
  if (section.includes('education')) {
    lift += Number(b.education_match || 0) < 70 ? 1.8 : 0.6
  }
  if (section.includes('summary')) {
    lift += 1.2
  }
  if (/metric|result|quantif|impact|%/.test(suggestion)) {
    lift += 0.8
  }
  if (/keyword|ats|mandatory|missing/.test(suggestion)) {
    lift += 0.9
  }
  return Math.min(12, lift)
}

function buildLikelyCompaniesForRecommendation(evaluation, recommendation) {
  const all = Array.isArray(evaluation?.scores?.all) ? evaluation.scores.all : []
  return all
    .filter((row) => row?.type === 'company')
    .map((row) => {
      const current = Number(row?.score || 0)
      const lift = estimateLift(row, recommendation)
      const projected = Math.min(100, Math.round(current + lift))
      const delta = projected - current
      return {
        entity: row.entity,
        current,
        projected,
        delta,
        missingMandatory: (row?.missing_mandatory || []).slice(0, 2),
      }
    })
    .filter((row) => row.delta >= 2 && row.projected >= 65)
    .sort((a, b) => b.projected - a.projected || b.delta - a.delta)
    .slice(0, 5)
}

const AcceptabilityPreview = ({ evaluation, recommendation }) => {
  const companies = React.useMemo(
    () => buildLikelyCompaniesForRecommendation(evaluation, recommendation),
    [evaluation, recommendation]
  )

  if (!companies.length) return null

  return (
    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ArrowTrendingUpIcon className="h-5 w-5 text-emerald-700" />
        <h4 className="text-sm font-semibold text-emerald-900">
          Likely company impact for this recommendation
        </h4>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {companies.map((company) => (
          <div key={`${recommendation?.section || 'rec'}-${company.entity}`} className="rounded-lg border border-emerald-100 bg-white p-3">
            <div className="mb-1 flex items-center gap-2">
              <BuildingOffice2Icon className="h-4 w-4 text-emerald-700" />
              <p className="font-medium text-gray-900">{company.entity}</p>
            </div>
            <p className="text-sm text-gray-700">
              Score: <span className="font-semibold">{company.current}</span> to{' '}
              <span className="font-semibold text-emerald-700">{company.projected}</span>
              {' '}({company.delta > 0 ? `+${company.delta}` : company.delta})
            </p>
            {company.missingMandatory.length > 0 && (
              <p className="mt-1 text-xs text-gray-600">
                Focus skills: {company.missingMandatory.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default AcceptabilityPreview
