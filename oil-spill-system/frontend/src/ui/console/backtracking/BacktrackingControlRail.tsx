import { useSimulationStore } from '@/store/simulationStore'
import { useBacktrackingStore } from '@/store/featureStores'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'

/**
 * Presentation-level solver defaults. These mirror the backend backtracking
 * defaults (BacktrackingService: durationHours 6.0, ensembleSize 20,
 * particlesPerMember 200, environmentSource "CONTROLLED") and are shown only
 * before a completed result is available. A run issued without explicit options
 * (run(simulationId)) executes exactly these values, so the display and the
 * executed configuration always agree. After completion the persisted DTO
 * values are authoritative and replace these fallbacks.
 */
const DEFAULT_BACKTRACKING_DURATION_HOURS = 6
const DEFAULT_BACKTRACKING_ENSEMBLE_SIZE = 20
const DEFAULT_BACKTRACKING_PARTICLES_PER_MEMBER = 200
const DEFAULT_BACKTRACKING_ENVIRONMENT_SOURCE = 'CONTROLLED'

function btTone(status: string): OperationalStatusTone {
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

export function BacktrackingControlRail({ collapsed }: { collapsed: boolean }) {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const spill = useSimulationStore((s) => s.spill)
  const status = useBacktrackingStore((s) => s.status)
  const busy = useBacktrackingStore((s) => s.busy)
  const durationHours =
    useBacktrackingStore((s) => s.durationHours) ?? DEFAULT_BACKTRACKING_DURATION_HOURS
  const ensembleSize =
    useBacktrackingStore((s) => s.ensembleSize) ?? DEFAULT_BACKTRACKING_ENSEMBLE_SIZE
  const particlesPerMember =
    useBacktrackingStore((s) => s.particlesPerMember) ??
    DEFAULT_BACKTRACKING_PARTICLES_PER_MEMBER
  const environmentSource =
    useBacktrackingStore((s) => s.environmentSource) ?? DEFAULT_BACKTRACKING_ENVIRONMENT_SOURCE
  const clear = useBacktrackingStore((s) => s.clear)

  const running = busy || status === 'running'
  const hasResult = status === 'completed'

  const handleRun = () => {
    if (!simulationId || running) return
    void useBacktrackingStore.getState().run(simulationId)
  }

  // Reverse timeline milestones
  const steps: number[] =
    durationHours <= 1
      ? [0, 1]
      : [0, Math.ceil(durationHours / 3), Math.ceil((2 * durationHours) / 3), durationHours]

  return (
    <nav
      className="h-full flex flex-col bg-[var(--bg-canvas)] select-none"
      aria-label="Backtracking solver controls"
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
                Backtracking
              </h2>
              <StatusBadge tone={btTone(status)}>
                {status === 'running'
                  ? 'Advecting…'
                  : status === 'completed'
                    ? 'Completed'
                    : status === 'failed'
                      ? 'Failed'
                      : 'Idle'}
              </StatusBadge>
            </div>
            <p className="text-[10px] text-ink-3 mt-0.5">Lagrangian reverse solver</p>
          </div>
        ) : (
          <div
            className="w-7 h-7 rounded flex items-center justify-center bg-[var(--border-default)]/40 text-sonar"
            title="Backtracking Solver"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
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
                aria-label="Run reverse backtracking simulation"
              >
                {running ? (
                  <>
                    <span className="w-2 h-2 rounded bg-sonar animate-ping" />
                    <span>Advecting reverse drift…</span>
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
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span>Run backtracking</span>
                  </>
                )}
              </button>

              {hasResult && (
                <button
                  type="button"
                  className="w-full py-1.5 px-3 rounded text-xs text-ink-3 border border-[var(--border-default)] hover:text-ink-1 hover:border-ink-muted transition-colors"
                  onClick={clear}
                  disabled={running}
                  aria-label="Clear current backtracking estimate"
                >
                  Clear estimate
                </button>
              )}
            </div>

            {/* Slick Origin Seed Context */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-1.5">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Observed slick anchor
              </span>
              {spill?.location ? (
                <div className="font-mono text-ink-1 text-[11px]">
                  {spill.location.lat.toFixed(4)}°, {spill.location.lon.toFixed(4)}°
                </div>
              ) : (
                <span className="text-ink-muted italic text-[11px]">Awaiting observation</span>
              )}
              {spill?.time && (
                <div className="text-[10px] text-ink-3">
                  T₀: {new Date(spill.time).toISOString().slice(0, 19).replace('T', ' ')} UTC
                </div>
              )}
            </div>

            {/* Reverse Timeline Scrubber Display */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Reverse window
                </span>
                <span className="text-[10px] font-mono text-sonar">{durationHours}h backward</span>
              </div>
              <div
                className="grid grid-cols-4 gap-1 text-center font-mono text-[9.5px]"
                aria-label="Timeline steps"
              >
                {steps.map((t, idx) => (
                  <div
                    key={t}
                    className={`py-1 px-0.5 rounded border ${
                      idx === steps.length - 1
                        ? 'border-sonar/50 bg-sonar/10 text-sonar font-semibold'
                        : 'border-[var(--border-default)] text-ink-3'
                    }`}
                  >
                    {t === 0 ? 'T-0' : `-${t}h`}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-ink-muted leading-tight">
                Particles drift backward under inverted hydrodynamic forcing to isolate the release
                window.
              </p>
            </div>

            {/* Solver Ensemble Parameters */}
            <div className="rounded border border-[var(--border-default)] bg-[var(--bg-panel)]/50 p-2.5 text-xs space-y-2">
              <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider block">
                Ensemble parameters
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Members:</span>
                  <span className="font-mono text-ink-1">{ensembleSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Particles/member:</span>
                  <span className="font-mono text-ink-1">{particlesPerMember}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[var(--border-default)]">
                  <span className="text-ink-3">Forcing:</span>
                  <ProvenanceLabel
                    kind={environmentSource === 'CONTROLLED' ? 'controlled' : 'simulated'}
                  />
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
              title={running ? 'Advecting reverse drift…' : 'Run backtracking'}
              aria-label="Run backtracking"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <div
              className="text-[9px] font-mono text-ink-3 py-1 px-1 rounded border border-[var(--border-default)] text-center"
              title={`${durationHours} hours reverse window`}
            >
              -{durationHours}h
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
