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

const AcceptabilityPreview = ({ evaluation, recommendations }) => {
  const recommendationImpact = React.useMemo(
    () =>
      (recommendations || [])
        .map((rec, idx) => ({
          key: `${idx}-${rec?.section || 'recommendation'}`,
          section: rec?.section || 'Recommendation',
          where: rec?.where || rec?.section || 'Resume section',
          companies: buildLikelyCompaniesForRecommendation(evaluation, rec),
        }))
        .filter((entry) => entry.companies.length > 0),
    [evaluation, recommendations]
  )

  if (!recommendationImpact.length) return null

  return (
    <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-700" />
        <h2 className="text-lg font-semibold text-emerald-900">
          Company acceptability impact by recommendation
        </h2>
      </div>
      <div className="space-y-4">
        {recommendationImpact.map((entry) => (
          <div key={entry.key} className="rounded-xl border border-emerald-200 bg-white p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-emerald-900">{entry.section}</p>
              <p className="text-xs text-gray-600">Apply in: {entry.where}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entry.companies.map((company) => (
                <div key={`${entry.key}-${company.entity}`} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
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
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-emerald-900/80">
        Each block shows projected gains if that single recommendation is applied well.
      </p>
            {/* end recommendation impact */}
    </section>
  )
}

export default AcceptabilityPreview
