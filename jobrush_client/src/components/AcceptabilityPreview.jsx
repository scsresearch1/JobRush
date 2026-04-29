import React from 'react'
import { BuildingOffice2Icon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

function estimateLift(scoreRow, recommendations) {
  const b = scoreRow?.breakdown || {}
  const missingMandatory = Array.isArray(scoreRow?.missing_mandatory) ? scoreRow.missing_mandatory.length : 0
  const missingPreferred = Array.isArray(scoreRow?.missing_preferred) ? scoreRow.missing_preferred.length : 0
  const recSections = new Set((recommendations || []).map((r) => String(r?.section || '').toLowerCase()))

  let lift = 0
  lift += Math.min(10, missingMandatory * 1.4)
  lift += Math.min(4, missingPreferred * 0.5)
  if (recSections.has('skills') && (missingMandatory + missingPreferred > 0)) lift += 2.5
  if (recSections.has('experience') && Number(b.project_relevance || 0) < 72) lift += 2
  if (recSections.has('projects') && Number(b.project_relevance || 0) < 72) lift += 2
  if (recSections.has('formatting') && Number(b.formatting_score || 0) < 80) lift += 1.5
  if (recSections.has('education') && Number(b.education_match || 0) < 70) lift += 1
  if (recSections.has('summary') || recSections.has('keyword coverage')) lift += 1

  return Math.min(18, lift)
}

function buildLikelyCompanies(evaluation, recommendations) {
  const all = Array.isArray(evaluation?.scores?.all) ? evaluation.scores.all : []
  return all
    .filter((row) => row?.type === 'company')
    .map((row) => {
      const current = Number(row?.score || 0)
      const lift = estimateLift(row, recommendations)
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
    .filter((row) => row.delta >= 4 && row.projected >= 65)
    .sort((a, b) => b.projected - a.projected || b.delta - a.delta)
    .slice(0, 12)
}

const AcceptabilityPreview = ({ evaluation, recommendations }) => {
  const companies = React.useMemo(
    () => buildLikelyCompanies(evaluation, recommendations),
    [evaluation, recommendations]
  )

  if (!companies.length) return null

  return (
    <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-700" />
        <h2 className="text-lg font-semibold text-emerald-900">
          Companies likely to become more acceptable
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {companies.map((company) => (
          <div key={company.entity} className="rounded-xl border border-emerald-200 bg-white p-3">
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
