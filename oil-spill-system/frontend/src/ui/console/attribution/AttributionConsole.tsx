import { useMemo, useState } from 'react'
import { useAttributionStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'
import { NumberTween } from '@/ui/motion/NumberTween'
import type { AttributionFilterOptions } from './AttributionControlRail'
import type { AttributionFactorKey, AttributionVesselEntry } from '@/types/domain'

const FACTOR_LABELS: Record<AttributionFactorKey, string> = {
  spatial: 'Spatial match',
  temporal: 'Temporal match',
  trajectory: 'Trajectory consistency',
  anomaly: 'Behavior anomaly',
  environmental: 'Environmental drift agreement',
}

const DEFAULT_WEIGHTS: Record<AttributionFactorKey, number> = {
  spatial: 0.25,
  temporal: 0.2,
  trajectory: 0.25,
  anomaly: 0.15,
  environmental: 0.15,
}

const FACTORS: AttributionFactorKey[] = [
  'spatial',
  'temporal',
  'trajectory',
  'anomaly',
  'environmental',
]

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

export function AttributionConsole({
  rightCollapsed,
  setRightCollapsed,
  filterOptions,
}: {
  rightCollapsed: boolean
  setRightCollapsed: (v: boolean) => void
  filterOptions: AttributionFilterOptions
}) {
  const status = useAttributionStore((s) => s.status)
  const conclusion = useAttributionStore((s) => s.conclusion)
  const ranking = useAttributionStore((s) => s.ranking)
  const vessels = useAttributionStore((s) => s.vessels)
  const weightsUsed = useAttributionStore((s) => s.weightsUsed)
  const aisSource = useAttributionStore((s) => s.aisSource)
  const attributionModelVersion = useAttributionStore((s) => s.attributionModelVersion)
  const warnings = useAttributionStore((s) => s.warnings)

  const mapSelection = useMapStore((s) => s.selection)
  const selectMap = useMapStore((s) => s.select)
  const clearSelection = useMapStore((s) => s.clearSelection)

  const [selectedRank, setSelectedRank] = useState<number | null>(null)

  // Determine active selected vessel: match map selection if available, else local selection, else top candidate
  const activeCandidate = useMemo(() => {
    if (mapSelection?.kind === 'ais_candidate') {
      const match = vessels.find(
        (v) => v.rank === mapSelection.rank || (mapSelection.mmsi && v.mmsi === mapSelection.mmsi),
      )
      if (match) return match
    }
    if (selectedRank != null) {
      const match = vessels.find((v) => v.rank === selectedRank)
      if (match) return match
    }
    return vessels[0] ?? null
  }, [mapSelection, selectedRank, vessels])

  // Filter & sort candidates
  const processedVessels = useMemo(() => {
    let list = [...vessels]

    // Filter by type
    if (filterOptions.vesselTypeFilter !== 'ALL') {
      const f = filterOptions.vesselTypeFilter.toLowerCase()
      list = list.filter((v) => {
        const t = (v.vesselType ?? '').toLowerCase()
        if (f === 'tanker') return t.includes('tanker')
        if (f === 'cargo') return t.includes('cargo') || t.includes('container')
        return !t.includes('tanker') && !t.includes('cargo') && !t.includes('container')
      })
    }

    // Sort
    list.sort((a, b) => {
      if (filterOptions.sortBy === 'score') {
        return (b.score ?? 0) - (a.score ?? 0)
      }
      if (filterOptions.sortBy === 'distance') {
        return (a.minDistanceKm ?? 9999) - (b.minDistanceKm ?? 9999)
      }
      return (a.rank || 0) - (b.rank || 0)
    })

    return list
  }, [vessels, filterOptions])

  if (rightCollapsed) {
    return (
      <button
        type="button"
        className="h-full w-full flex items-center justify-center p-2 text-ink-3 hover:text-ink-1 hover:bg-[var(--bg-panel)] transition-colors"
        onClick={() => setRightCollapsed(false)}
        title="Expand Vessel Forensics Console"
        aria-label="Expand Vessel Forensics Console"
      >
        <span className="text-xs font-semibold tracking-wider uppercase rotate-90 whitespace-nowrap">
          Vessel Forensics
        </span>
      </button>
    )
  }

  const handleSelectVessel = (v: AttributionVesselEntry) => {
    setSelectedRank(v.rank)
    selectMap({
      kind: 'ais_candidate',
      rank: v.rank,
      mmsi: v.mmsi,
      name: v.name,
    })
  }

  const isCompleted = status === 'completed' && vessels.length > 0
  const weights = weightsUsed ?? DEFAULT_WEIGHTS

  return (
    <section
      className="h-full flex flex-col bg-[var(--bg-canvas)] overflow-hidden"
      aria-label="Vessel attribution intelligence console"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-ink-1 uppercase tracking-wider">
            Vessel Forensics
          </h2>
          <span className="text-[10px] font-mono text-ink-3">
            {isCompleted ? `${vessels.length} Candidate${vessels.length > 1 ? 's' : ''}` : 'Awaiting scoring'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRightCollapsed(true)}
          className="text-ink-muted hover:text-ink-1 p-1 rounded hover:bg-[var(--border-default)]/40 transition-colors"
          title="Collapse console"
          aria-label="Collapse console"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Map Selection Alert Banner */}
        {mapSelection && (
          <div className="rounded border border-sonar/40 bg-sonar/10 p-2.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-sonar font-semibold uppercase tracking-wider block">
                Map selection
              </span>
              <span className="text-ink-1 font-mono text-[11px]">
                {mapSelection.kind === 'ais_candidate'
                  ? `Candidate #${mapSelection.rank ?? '?'} ${mapSelection.name ?? ''}`
                  : mapSelection.kind === 'origin'
                    ? 'Estimated Origin'
                    : mapSelection.kind}
              </span>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] text-sonar/80 hover:text-sonar underline"
              aria-label="Clear map selection"
            >
              Clear
            </button>
          </div>
        )}

        {/* Honest State: When Not Completed */}
        {!isCompleted ? (
          <div className="space-y-4">
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/40 p-4 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-[var(--border-default)]/60 text-ink-3 mx-auto flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-xs font-medium text-ink-1">
                {status === 'running'
                  ? 'Analyzing AIS corridors…'
                  : status === 'failed'
                    ? 'Attribution analysis failed'
                    : 'Awaiting attribution run'}
              </h3>
              <p className="text-[11px] text-ink-3 leading-relaxed max-w-[240px] mx-auto">
                {status === 'running'
                  ? 'Correlating candidate tracks with the backtrack source region and time window.'
                  : status === 'failed'
                    ? 'The AIS scoring pipeline encountered an error. Please verify the simulation run and retry.'
                    : 'Execute attribution from the control rail to rank vessels inside the source corridor against the five-factor matrix.'}
              </p>
              <div className="pt-2">
                <ProvenanceLabel kind={status === 'running' ? 'simulated' : 'uncalculated'} />
              </div>
            </div>

            {/* Scientific Provenance */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                AIS Data Provenance
              </span>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-ink-3">Source feed:</span>
                <span className="font-mono text-ink-1">{aisSource}</span>
              </div>
              <p className="text-[10px] text-ink-muted leading-relaxed border-t border-[var(--border-default)] pt-1.5">
                Deterministic seeded simulated AIS traffic (CONTROLLED). Real AIS feeds report
                UNAVAILABLE and are never fabricated.
              </p>
            </div>
          </div>
        ) : (
          /* Active Results View */
          <>
            {/* 1. Attribution Conclusion Banner */}
            <div
              className={`rounded border p-3 text-xs space-y-2 ${
                conclusion === 'candidate'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-1">
                  {conclusion === 'candidate' ? 'Primary Candidate Identified' : 'Attribution Inconclusive'}
                </span>
                {ranking && (
                  <span className="text-[10px] font-mono text-ink-2">
                    Margin: {ranking.margin.toFixed(3)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                {conclusion === 'candidate'
                  ? 'One vessel is ranked above the corridor cohort with a statistically decisive margin. Ranked candidates are probabilistic evidence, not a declaration of legal culpability.'
                  : ranking
                    ? `Top score is ${ranking.top_score.toFixed(2)} with margin ${ranking.margin.toFixed(3)} — insufficient separation for a decisive conclusion.`
                    : 'Corridor traffic density is high with overlapping spatial-temporal signatures.'}
              </p>
              {warnings.length > 0 && (
                <div className="text-[10px] text-ink-3 border-t border-[var(--border-default)]/40 pt-1.5 space-y-0.5">
                  {warnings.slice(0, 2).map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Candidate Vessel Table */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Ranked Candidates
                </span>
                <span className="text-[10px] font-mono text-ink-3">
                  {processedVessels.length} of {vessels.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse text-[11px]"
                  aria-label="Ranked candidate vessels"
                >
                  <thead>
                    <tr className="border-b border-[var(--border-default)] text-ink-3 text-[10px]">
                      <th className="py-1 px-1 font-semibold w-7">#</th>
                      <th className="py-1 px-1 font-semibold">Vessel</th>
                      <th className="py-1 px-1 font-semibold text-right">Score</th>
                      <th className="py-1 px-1 font-semibold text-right">Dist</th>
                      <th className="py-1 px-1 font-semibold text-center">AIS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedVessels.map((row) => {
                      const isSelected = activeCandidate?.rank === row.rank
                      return (
                        <tr
                          key={`${row.rank}-${row.mmsi}`}
                          tabIndex={0}
                          onClick={() => handleSelectVessel(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleSelectVessel(row)
                            }
                          }}
                          className={`border-b border-[var(--border-default)]/40 cursor-pointer transition-colors focus:outline-none focus:bg-sonar/15 ${
                            isSelected
                              ? 'bg-sonar/15 text-ink-1 font-medium'
                              : 'hover:bg-[var(--border-default)]/30 text-ink-2'
                          }`}
                          aria-selected={isSelected}
                          aria-label={`Rank ${row.rank}: ${row.name ?? 'Unnamed vessel'}, score ${row.score?.toFixed(3) ?? '—'}`}
                        >
                          <td className="py-1.5 px-1 font-mono font-semibold text-sonar">
                            #{row.rank}
                          </td>
                          <td className="py-1.5 px-1">
                            <div className="truncate max-w-[105px]" title={row.name ?? 'Unnamed'}>
                              {row.name ?? 'Unnamed'}
                            </div>
                            <div className="text-[9.5px] font-mono text-ink-3">
                              {row.mmsi ? `MMSI ${row.mmsi}` : '—'}
                            </div>
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono text-ink-1">
                            <NumberTween value={row.score} format={(s) => s.toFixed(3)} placeholder="—" />
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono text-ink-3">
                            {row.minDistanceKm != null ? `${row.minDistanceKm.toFixed(1)}k` : '—'}
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                row.dataQuality?.reliability === 'HIGH'
                                  ? 'bg-emerald-400'
                                  : row.dataQuality?.reliability === 'MEDIUM'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                              }`}
                              title={`AIS Reliability: ${row.dataQuality?.reliability ?? 'Unknown'}`}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {processedVessels.length === 0 && (
                <div className="py-4 text-center text-[11px] text-ink-muted">
                  No candidates match the selected filter.
                </div>
              )}
            </div>

            {/* 3. Attribution Inspector: Selected Vessel Evidence */}
            {activeCandidate && (
              <div className="rounded border border-sonar/40 bg-[var(--bg-panel)]/60 p-3 text-xs space-y-3">
                {/* Vessel Identity Header */}
                <div className="flex items-start justify-between border-b border-[var(--border-default)] pb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sonar font-bold text-xs">
                        #{activeCandidate.rank}
                      </span>
                      <h3 className="text-ink-1 font-semibold text-xs">
                        {activeCandidate.name ?? 'Unnamed vessel'}
                      </h3>
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono mt-0.5">
                      MMSI: {activeCandidate.mmsi ?? 'No data'} · {activeCandidate.vesselType ?? 'Commercial vessel'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-ink-3 block">Composite:</span>
                    <span className="font-mono text-ink-1 font-bold text-sm text-sonar">
                      <NumberTween value={activeCandidate.score} format={(s) => s.toFixed(3)} placeholder="—" />
                    </span>
                  </div>
                </div>

                {/* Closest Approach Telemetry */}
                <div className="rounded bg-[var(--bg-canvas)]/70 p-2 text-[10.5px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-3">Min Distance:</span>
                    <span className="text-ink-1 font-semibold">
                      {activeCandidate.minDistanceKm != null
                        ? `${activeCandidate.minDistanceKm.toFixed(2)} km`
                        : 'No data'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Time of Approach:</span>
                    <span className="text-ink-1">
                      {formatTime(activeCandidate.timeOfClosestApproach)}
                    </span>
                  </div>
                  {activeCandidate.closestPosition && (
                    <div className="flex justify-between">
                      <span className="text-ink-3">Position:</span>
                      <span className="text-ink-1">
                        {activeCandidate.closestPosition.lat.toFixed(4)}°,{' '}
                        {activeCandidate.closestPosition.lon.toFixed(4)}°
                      </span>
                    </div>
                  )}
                </div>

                {/* Five-Factor Score Breakdown */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                    Five-Factor Evidence Matrix
                  </span>
                  {FACTORS.map((factor) => {
                    const score = activeCandidate.factors?.[factor] ?? null
                    const evidence = activeCandidate.factorEvidence?.[factor] ?? {}
                    const weight = weights[factor] ?? DEFAULT_WEIGHTS[factor]
                    const note =
                      typeof evidence.note === 'string' && evidence.note
                        ? evidence.note
                        : (evidence as Record<string, unknown>).time_diff_hours != null
                          ? `|Δt| ${Number((evidence as Record<string, unknown>).time_diff_hours).toFixed(1)} h`
                          : (evidence as Record<string, unknown>).closest_approach_km != null
                            ? `${Number((evidence as Record<string, unknown>).closest_approach_km).toFixed(1)} km at closest approach`
                            : null

                    return (
                      <div key={factor} className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="text-ink-2">
                            {FACTOR_LABELS[factor]}{' '}
                            <span className="text-ink-muted text-[9.5px]">
                              ({(weight * 100).toFixed(0)}%)
                            </span>
                          </span>
                          <span className="font-mono text-ink-1 font-medium">
                            <NumberTween value={score} format={(s) => s.toFixed(3)} placeholder="—" />
                          </span>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="w-full h-1 rounded-full bg-[var(--border-default)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              score != null && score >= 0.7
                                ? 'bg-emerald-400'
                                : score != null && score >= 0.4
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, (score ?? 0) * 100))}%` }}
                          />
                        </div>
                        {note && (
                          <div className="text-[9.5px] text-ink-muted leading-tight">{note}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* AIS Quality & Integrity Assessment */}
                {activeCandidate.dataQuality && (
                  <div className="border-t border-[var(--border-default)] pt-2 space-y-1 text-[10.5px]">
                    <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                      AIS Signal Quality
                    </span>
                    <div className="flex justify-between">
                      <span className="text-ink-3">Reliability Rating:</span>
                      <span className="font-mono text-ink-1">
                        {activeCandidate.dataQuality.reliability ?? 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">Messages in window:</span>
                      <span className="font-mono text-ink-1">
                        {activeCandidate.dataQuality.messagesInWindow ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">Median cadence:</span>
                      <span className="font-mono text-ink-1">
                        {activeCandidate.dataQuality.medianCadenceMin != null
                          ? `${activeCandidate.dataQuality.medianCadenceMin.toFixed(1)} min`
                          : '—'}
                      </span>
                    </div>
                    {activeCandidate.dataQuality.interpolationFraction != null && (
                      <div className="flex justify-between">
                        <span className="text-ink-3">Reconstructed track:</span>
                        <span className="font-mono text-ink-1">
                          {Math.round(activeCandidate.dataQuality.interpolationFraction * 100)}%
                        </span>
                      </div>
                    )}
                    {activeCandidate.dataQuality.notes.length > 0 && (
                      <div className="text-[9.5px] text-ink-muted pt-1 space-y-0.5">
                        {activeCandidate.dataQuality.notes.slice(0, 2).map((n, idx) => (
                          <div key={idx}>• {n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Scientific Provenance Card */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Attribution Provenance
                </span>
                <ProvenanceLabel kind={aisSource === 'CONTROLLED' ? 'controlled' : 'live'} />
              </div>
              <div className="text-[10.5px] text-ink-3 font-mono">
                Model: {attributionModelVersion ?? 'ais-scoring-v1'}
              </div>
              <p className="text-[10px] text-ink-muted leading-tight">
                Candidate scoring uses a normalized 5-factor matrix weighted across geographic proximity,
                temporal overlap, trajectory alignment, behavioral anomalies, and drift models.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
