import { useBacktrackingStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'

function formatLatLng(loc: { lon: number; lat: number } | null): string {
  if (!loc) return '—'
  return `${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°`
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

function ConcentrationDot({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  const color =
    level === 'HIGH'
      ? 'bg-emerald-400 text-emerald-300'
      : level === 'MEDIUM'
        ? 'bg-amber-400 text-amber-300'
        : 'bg-rose-400 text-rose-300'
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono">
      <span className={`w-1.5 h-1.5 rounded ${color}`} />
      <span className="text-ink-1">{level ?? '—'}</span>
    </span>
  )
}

export function BacktrackingConsole({
  rightCollapsed,
  setRightCollapsed,
}: {
  rightCollapsed: boolean
  setRightCollapsed: (v: boolean) => void
}) {
  const origin = useBacktrackingStore((s) => s.origin)
  const uncertaintyKm = useBacktrackingStore((s) => s.uncertaintyKm)
  const sourceConcentration = useBacktrackingStore((s) => s.sourceConcentration)
  const environmentalQuality = useBacktrackingStore((s) => s.environmentalQuality)
  const trajectoryAgreement = useBacktrackingStore((s) => s.trajectoryAgreement)
  const ensembleStability = useBacktrackingStore((s) => s.ensembleStability)
  const originTimeRange = useBacktrackingStore((s) => s.originTimeRange)
  const ensembleSummary = useBacktrackingStore((s) => s.ensembleSummary)
  const quality = useBacktrackingStore((s) => s.quality)
  const warnings = useBacktrackingStore((s) => s.warnings)
  const environmentSource = useBacktrackingStore((s) => s.environmentSource)
  const status = useBacktrackingStore((s) => s.status)

  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)

  if (rightCollapsed) {
    return (
      <button
        type="button"
        className="h-full w-full flex items-center justify-center p-2 text-ink-3 hover:text-ink-1 hover:bg-[var(--bg-panel)] transition-colors"
        onClick={() => setRightCollapsed(false)}
        title="Expand Source Estimation Console"
        aria-label="Expand Source Estimation Console"
      >
        <span className="text-xs font-semibold tracking-wider uppercase rotate-90 whitespace-nowrap">
          Source Console
        </span>
      </button>
    )
  }

  const isCompleted = status === 'completed' && origin !== null

  return (
    <section
      className="h-full flex flex-col bg-[var(--bg-canvas)] overflow-hidden"
      aria-label="Source estimation intelligence console"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-default)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-ink-1 uppercase tracking-wider">
            Source Estimation
          </h2>
          <span className="text-[10px] font-mono text-ink-3">
            {isCompleted ? '90% Contour Solved' : 'Awaiting solver'}
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
      <div
        className="flex-1 overflow-y-auto p-3.5 space-y-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-blue"
        tabIndex={0}
        role="region"
        aria-label="Backtracking Telemetry Feed"
      >
        {/* Map Selection Alert Banner */}
        {selection && (
          <div className="rounded border border-sonar/40 bg-sonar/10 p-2.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-sonar font-semibold uppercase tracking-wider block">
                Map selection
              </span>
              <span className="text-ink-1 font-mono text-[11px]">
                {selection.kind === 'origin'
                  ? 'Estimated Origin Point'
                  : selection.kind === 'source_region'
                    ? '90% Source Region'
                    : selection.kind}
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
                  ? 'Calculating backward trajectories…'
                  : status === 'failed'
                    ? 'Backtracking calculation failed'
                    : 'Awaiting backtracking run'}
              </h3>
              <p className="text-[11px] text-ink-3 leading-relaxed max-w-[240px] mx-auto">
                {status === 'running'
                  ? 'Ensemble particles are advecting under inverted environmental forcing fields.'
                  : status === 'failed'
                    ? 'The reverse drift solver reported an error. Check logs or rerun with alternate parameters.'
                    : 'Run backtracking from the control rail to generate origin coordinates, 90% confidence contours, and uncertainty spread.'}
              </p>
              <div className="pt-2">
                <ProvenanceLabel
                  kind={status === 'running' ? 'simulated' : 'uncalculated'}
                />
              </div>
            </div>

            {/* Environmental Quality Readiness */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Forcing provenance
              </span>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-ink-3">Dataset:</span>
                <span className="font-mono text-ink-1">{environmentSource ?? 'CONTROLLED'}</span>
              </div>
              <p className="text-[10px] text-ink-muted leading-relaxed border-t border-[var(--border-default)] pt-1.5">
                {environmentSource === 'CONTROLLED'
                  ? 'Controlled synthetic currents and wind fields. Honest simulated baseline without real forcing credentials.'
                  : 'Real atmospheric and hydrodynamic model data.'}
              </p>
            </div>
          </div>
        ) : (
          /* Active Results View */
          <>
            {/* 1. Origin Estimate & Uncertainty */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Probable Source Origin
                </span>
                <span className="text-[10px] font-mono text-ok">2σ Solved</span>
              </div>

              <div className="space-y-1">
                <div className="text-[13px] font-mono text-ink-1 font-semibold">
                  {formatLatLng(origin)}
                </div>
                <div className="text-[11px] font-mono text-sonar">
                  {uncertaintyKm != null ? `Uncertainty: ±${uncertaintyKm.toFixed(1)} km` : '—'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-default)] text-[11px]">
                <div>
                  <span className="text-ink-3 block text-[10px]">Concentration:</span>
                  <ConcentrationDot level={sourceConcentration} />
                </div>
                <div>
                  <span className="text-ink-3 block text-[10px]">Forcing Quality:</span>
                  <ConcentrationDot level={environmentalQuality} />
                </div>
                <div>
                  <span className="text-ink-3 block text-[10px]">Trajectory Agreement:</span>
                  <span className="font-mono text-ink-1">
                    {trajectoryAgreement != null
                      ? `${(trajectoryAgreement * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[10px]">Ensemble Stability:</span>
                  <span className="font-mono text-ink-1">
                    {ensembleStability != null ? ensembleStability.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Source Time Window */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Source Time Window
              </span>
              {originTimeRange ? (
                <div className="space-y-1 font-mono text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-ink-3">Earliest:</span>
                    <span className="text-ink-1">{formatTime(originTimeRange.earliest)}</span>
                  </div>
                  <div className="flex justify-between text-sonar font-semibold">
                    <span>Preferred:</span>
                    <span>{formatTime(originTimeRange.preferred)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">Latest:</span>
                    <span className="text-ink-1">{formatTime(originTimeRange.latest)}</span>
                  </div>
                </div>
              ) : (
                <span className="text-ink-muted italic text-[11px]">Time window unconstrained</span>
              )}
              <p className="text-[10px] text-ink-muted leading-tight border-t border-[var(--border-default)] pt-1.5">
                The release event is statistically bounded inside this window; pinpoint single-second
                time is not claimed.
              </p>
            </div>

            {/* 3. Ensemble Dispersion & Quality */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Ensemble Convergence
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Members evaluated:</span>
                  <span className="font-mono text-ink-1">
                    {ensembleSummary?.member_count ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Converged endpoints:</span>
                  <span className="font-mono text-ink-1">
                    {ensembleSummary?.converged_count ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Mean endpoint dispersion:</span>
                  <span className="font-mono text-ink-1">
                    {ensembleSummary?.mean_endpoint_distance_km != null
                      ? `${ensembleSummary.mean_endpoint_distance_km.toFixed(1)} km`
                      : '—'}
                  </span>
                </div>
                {quality && (
                  <div className="flex justify-between pt-1 border-t border-[var(--border-default)]">
                    <span className="text-ink-3">Invalid / Land / Domain:</span>
                    <span className="font-mono text-ink-1">
                      {quality.invalid_particles} / {quality.land_hits} / {quality.domain_exits}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Forensic Evidence Basis */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Forensic Evidence Basis
              </span>
              <ul className="space-y-1 text-[11px] text-ink-2 leading-relaxed list-disc list-inside">
                <li>
                  {sourceConcentration === 'HIGH'
                    ? 'Endpoints are tightly concentrated with high trajectory convergence.'
                    : sourceConcentration === 'MEDIUM'
                      ? 'Endpoints exhibit moderate spatial clustering.'
                      : 'Endpoints are widely dispersed — source is weakly constrained.'}
                </li>
                {trajectoryAgreement != null && (
                  <li>
                    {(trajectoryAgreement * 100).toFixed(0)}% of simulated endpoints converge inside the
                    90% confidence contour.
                  </li>
                )}
                {uncertaintyKm != null && (
                  <li>
                    Estimated spatial uncertainty is ±{uncertaintyKm.toFixed(1)} km based on 2σ
                    ensemble spread.
                  </li>
                )}
              </ul>
              {warnings.length > 0 && (
                <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] text-amber-300 leading-tight space-y-0.5">
                  <span className="font-semibold block">Solver notice:</span>
                  {warnings.slice(0, 2).map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Provenance */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Scientific Provenance
                </span>
                <ProvenanceLabel
                  kind={environmentSource === 'CONTROLLED' ? 'controlled' : 'simulated'}
                />
              </div>
              <p className="text-[10px] text-ink-muted leading-tight">
                {environmentSource === 'CONTROLLED'
                  ? 'Derived from deterministic controlled forcing fields. Synthetic scenario without live Copernicus/HYCOM credentials.'
                  : 'Derived from live hydrodynamic and atmospheric numerical weather prediction models.'}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
