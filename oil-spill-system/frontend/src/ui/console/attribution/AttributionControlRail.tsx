import { useSimulationStore } from '@/store/simulationStore'
import { useAttributionStore, useBacktrackingStore } from '@/store/featureStores'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'

function attTone(status: string): OperationalStatusTone {
  switch (status) {
    case 'running':
      return 'run'
    case 'completed':
      return 'ok'
    case 'failed':
      return 'danger'
    default:
      return 'idle'
  }
}

export interface AttributionFilterOptions {
  vesselTypeFilter: 'ALL' | 'TANKER' | 'CARGO' | 'OTHER'
  sortBy: 'rank' | 'score' | 'distance'
}

export function AttributionControlRail({
  collapsed,
  filterOptions,
  setFilterOptions,
}: {
  collapsed: boolean
  filterOptions: AttributionFilterOptions
  setFilterOptions: React.Dispatch<React.SetStateAction<AttributionFilterOptions>>
}) {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const backtrackRunId = useBacktrackingStore((s) => s.runId)
  const btOrigin = useBacktrackingStore((s) => s.origin)

  const status = useAttributionStore((s) => s.status)
  const busy = useAttributionStore((s) => s.busy)
  const clear = useAttributionStore((s) => s.clear)
  const vesselCount = useAttributionStore((s) => s.vesselCount)
  const kept = useAttributionStore((s) => s.kept)
  const dropped = useAttributionStore((s) => s.dropped)
  const radiusKm = useAttributionStore((s) => s.radiusKm) ?? 50
  const aisSource = useAttributionStore((s) => s.aisSource) ?? 'CONTROLLED'
  const aisQuery = useAttributionStore((s) => s.aisQuery)
  const origin = useAttributionStore((s) => s.origin) ?? btOrigin

  const running = busy || status === 'running'
  const hasResult = status === 'completed'

  const handleRun = () => {
    if (!simulationId || running) return
    void useAttributionStore.getState().run(simulationId, {
      backtrackRunId: backtrackRunId ?? undefined,
    })
  }

  const pipelineStages = [
    {
      id: 'query',
      label: 'AIS corridor query',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? vesselCount != null
              ? 'done'
              : 'active'
            : 'pending',
      detail: aisQuery?.provider ? `${aisQuery.provider} · ${aisQuery.dataset ?? 'ais'}` : `${vesselCount ?? 0} queried`,
    },
    {
      id: 'filter',
      label: 'Spatial-temporal filter',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? kept != null || dropped != null
              ? 'done'
              : 'active'
            : 'pending',
      detail: kept != null ? `${kept} candidates · ${dropped ?? 0} excluded` : undefined,
    },
    {
      id: 'score',
      label: 'Five-factor scoring',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? kept != null
              ? 'active'
              : 'pending'
            : 'pending',
      detail: status === 'completed' ? 'Forensic composite ranked' : undefined,
    },
  ]

  return (
    <nav
      className="h-full flex flex-col bg-[var(--bg-canvas)] select-none"
      aria-label="Attribution analysis controls"
    >
      {/* Header */}
      <div
        className={`p-4 border-b border-[var(--border-default)] flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed ? (
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-ink-1 uppercase tracking-wider">
                Attribution
              </h2>
              <StatusBadge tone={attTone(status)}>
                {status === 'running'
                  ? 'Analyzing…'
                  : status === 'completed'
                    ? 'Ranked'
                    : status === 'failed'
                      ? 'Failed'
                      : 'Idle'}
              </StatusBadge>
            </div>
            <p className="text-[10px] text-ink-3 mt-0.5">Vessel forensic ranking</p>
          </div>
        ) : (
          <div
            className="w-7 h-7 rounded flex items-center justify-center bg-[var(--border-default)]/40 text-sonar"
            title="Attribution Engine"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 8 8 12 12 16 16 12 12 8" />
            </svg>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!collapsed ? (
          <>
            {/* Primary Action Button */}
            <div className="space-y-2">
              <button
                type="button"
                className={`w-full py-2 px-3 rounded-[3px] text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition-colors ${
                  running
                    ? 'bg-sonar/20 text-sonar border border-sonar/40 cursor-wait'
                    : !simulationId
                      ? 'bg-[var(--border-default)] text-ink-muted cursor-not-allowed'
                      : 'bg-signal-blue text-porcelain hover:bg-[#0048D9] shadow-sm'
                }`}
                disabled={!simulationId || running}
                onClick={handleRun}
                aria-label="Run AIS attribution analysis"
              >
                {running ? (
                  <>
                    <span className="w-2 h-2 rounded bg-sonar animate-ping" />
                    <span>Scoring candidates…</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
                    </svg>
                    <span>Run AIS attribution</span>
                  </>
                )}
              </button>

              {hasResult && (
                <button
                  type="button"
                  className="w-full py-1.5 px-3 rounded text-xs text-ink-3 border border-[var(--border-default)] hover:text-ink-1 hover:border-ink-muted transition-colors"
                  onClick={clear}
                  disabled={running}
                  aria-label="Clear attribution results"
                >
                  Clear result
                </button>
              )}
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Forensic pipeline
              </span>
              <div className="space-y-1.5">
                {pipelineStages.map((stage) => (
                  <div key={stage.id} className="flex items-start gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 mt-0.5 ${
                        stage.state === 'done'
                          ? 'bg-ok/20 text-ok'
                          : stage.state === 'active'
                            ? 'bg-sonar/20 text-sonar animate-pulse'
                            : 'bg-[var(--border-default)] text-ink-muted'
                      }`}
                    >
                      {stage.state === 'done' ? '✓' : stage.state === 'active' ? '●' : '○'}
                    </span>
                    <div className="flex-1 leading-tight">
                      <span className="text-[11px] text-ink-1 block">{stage.label}</span>
                      {stage.detail && (
                        <span className="text-[10px] text-ink-3 font-mono">{stage.detail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter & Sort Controls */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Filter & Sorting
              </span>

              {/* Vessel Class Filter */}
              <div className="space-y-1">
                <span className="text-[10.5px] text-ink-3">Vessel class:</span>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                  {(['ALL', 'TANKER', 'CARGO', 'OTHER'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setFilterOptions((prev) => ({ ...prev, vesselTypeFilter: cat }))
                      }
                      className={`py-1 px-1 text-center rounded border transition-colors ${
                        filterOptions.vesselTypeFilter === cat
                          ? 'border-sonar/60 bg-sonar/10 text-sonar font-semibold'
                          : 'border-[var(--border-default)] text-ink-3 hover:text-ink-1'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By Field */}
              <div className="space-y-1 pt-1 border-t border-[var(--border-default)]">
                <span className="text-[10.5px] text-ink-3">Sort candidates by:</span>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                  {(
                    [
                      { id: 'rank', label: 'Rank' },
                      { id: 'score', label: 'Score' },
                      { id: 'distance', label: 'Dist.' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFilterOptions((prev) => ({ ...prev, sortBy: s.id }))}
                      className={`py-1 px-1 text-center rounded border transition-colors ${
                        filterOptions.sortBy === s.id
                          ? 'border-sonar/60 bg-sonar/10 text-sonar font-semibold'
                          : 'border-[var(--border-default)] text-ink-3 hover:text-ink-1'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Spatial-Temporal Search Parameters */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Search parameters
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Search anchor:</span>
                  <span className="font-mono text-ink-1">
                    {origin ? `${origin.lat.toFixed(3)}°, ${origin.lon.toFixed(3)}°` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Corridor radius:</span>
                  <span className="font-mono text-ink-1">{radiusKm} km</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[var(--border-default)]">
                  <span className="text-ink-3">AIS feed:</span>
                  <ProvenanceLabel kind={aisSource === 'CONTROLLED' ? 'controlled' : 'live'} />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Collapsed Mini Rail */
          <div className="flex flex-col items-center space-y-3">
            <button
              type="button"
              className={`w-9 h-9 rounded-[3px] flex items-center justify-center transition-colors ${
                running
                  ? 'bg-sonar/20 text-sonar'
                  : !simulationId
                    ? 'bg-[var(--border-default)] text-ink-muted cursor-not-allowed'
                    : 'bg-signal-blue text-porcelain hover:bg-[#0048D9]'
              }`}
              disabled={!simulationId || running}
              onClick={handleRun}
              title={running ? 'Scoring candidates…' : 'Run AIS attribution'}
              aria-label="Run AIS attribution"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
              </svg>
            </button>
            <div
              className="text-[9px] font-mono text-ink-3 py-1 px-1 rounded border border-[var(--border-default)] text-center"
              title={`${radiusKm} km search radius`}
            >
              {radiusKm}km
            </div>
            <div
              className="w-2 h-2 rounded"
              title={`Status: ${status}`}
              style={{
                backgroundColor:
                  status === 'completed'
                    ? 'var(--color-ok)'
                    : status === 'running'
                      ? 'var(--color-sonar)'
                      : status === 'failed'
                        ? 'var(--color-danger)'
                        : 'var(--color-dim)',
              }}
            />
          </div>
        )}
      </div>
    </nav>
  )
}
