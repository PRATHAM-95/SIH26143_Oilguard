import { useSimulationStore } from '@/store/simulationStore'
import { useMapStore } from '@/store/mapStore'
import { useDataProvenance } from '@/ui/hooks/useDataProvenance'
import { Button } from '@/ui/design-system/Button'
import { Panel } from '@/ui/design-system/Panel'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'
import { TimeScrubber } from './TimeScrubber'
import { SelectionInspectorCard } from '../cards/SelectionInspectorCard'
import { VesselContext } from '@/ui/journey/VesselContext'
import { ChevronDownIcon } from '@/components/ui/Icon'



function VesselSelector() {
  const vessels = useSimulationStore((s) => s.vessels)
  const selected = useSimulationStore((s) => s.selectedVesselId)
  const selectVessel = useSimulationStore((s) => s.selectVessel)

  return (
    <div className="flex flex-col gap-2">
      <select
        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded-sm px-2 py-1.5 text-xs text-foam focus:outline-none focus:ring-1 focus:ring-sonar"
        value={selected ?? ''}
        onChange={(e) => selectVessel(e.target.value)}
        disabled={vessels.length === 0}
        aria-label="Select vessel"
      >
        <option value="">Select vessel…</option>
        {vessels.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      {vessels.length === 0 && (
        <p className="text-[10px] text-ink-muted">No vessels yet. Create a simulation to seed the fleet.</p>
      )}
    </div>
  )
}

function VesselDetail() {
  const vessels = useSimulationStore((s) => s.vessels)
  const selected = useSimulationStore((s) => s.selectedVesselId)
  const vessel = vessels.find((v) => v.id === selected)

  if (!vessel) {
    if (vessels.length > 0) {
      return <p className="text-[10px] text-ink-muted">Select a vessel from the fleet above to inspect telemetry.</p>
    }
    return null
  }

  return <VesselContext vessel={vessel} />
}

function SpillSection() {
  const spill = useSimulationStore((s) => s.spill)

  if (!spill?.spillEventId) {
    return <p className="text-[10px] text-ink-muted">Select a vessel and release a spill to create the incident.</p>
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex justify-between"><span className="text-mist">Event</span><span className="font-mono text-foam tabular-nums text-[10px]">{spill.spillEventId}</span></div>
      <div className="flex justify-between"><span className="text-mist">Oil type</span><span className="text-foam">{spill.oilType ?? 'Unspecified'}</span></div>
      <div className="flex justify-between"><span className="text-mist">Quantity</span><span className="font-mono text-foam tabular-nums">{spill.quantityKg != null ? `${spill.quantityKg} kg` : '—'}</span></div>
      {spill.location && (
        <div className="flex justify-between"><span className="text-mist">Location</span><span className="font-mono text-foam tabular-nums">{spill.location.lat.toFixed(4)}°, {spill.location.lon.toFixed(4)}°</span></div>
      )}
    </div>
  )
}

function DriftSection() {
  const drift = useSimulationStore((s) => s.drift)

  if (drift.status === 'idle') {
    return <p className="text-[10px] text-ink-muted">Release a spill then run forward drift.</p>
  }

  const driftTone: OperationalStatusTone =
    drift.status === 'completed' ? 'ok'
    : drift.status === 'running' ? 'run'
    : drift.status === 'failed' ? 'danger'
    : 'idle'

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-mist">Status</span>
        <StatusBadge tone={driftTone}>{drift.status}</StatusBadge>
      </div>
      {drift.runId && (
        <div className="flex justify-between"><span className="text-mist">Run</span><span className="font-mono text-foam tabular-nums text-[10px]">{drift.runId}</span></div>
      )}
      {drift.durationHours != null && (
        <div className="flex justify-between"><span className="text-mist">Duration</span><span className="font-mono text-foam tabular-nums">{drift.durationHours} h</span></div>
      )}
      {drift.particleCount != null && (
        <div className="flex justify-between"><span className="text-mist">Particles</span><span className="font-mono text-foam tabular-nums">{drift.particleCount}</span></div>
      )}
      {drift.environmentSource && (
        <div className="flex justify-between">
          <span className="text-mist">Environment</span>
          <ProvenanceLabel kind={drift.environmentSource.includes('SYNTH') || drift.environmentSource.includes('MODEL') ? 'simulated' : 'controlled'} text={drift.environmentSource} />
        </div>
      )}
      {drift.massBalance && (
        <div className="mt-1 flex flex-col gap-1 border-t border-[var(--border-default)] pt-2">
          <span className="text-[10px] text-mist">Mass balance</span>
          <div className="flex justify-between"><span className="text-mist">Remaining</span><span className="font-mono text-foam tabular-nums">{drift.massBalance.remainingKg.toFixed(1)} kg</span></div>
          <div className="flex justify-between"><span className="text-mist">Evaporated</span><span className="font-mono text-foam tabular-nums">{drift.massBalance.evaporatedKg.toFixed(1)} kg</span></div>
          <div className="flex justify-between"><span className="text-mist">Dispersed</span><span className="font-mono text-foam tabular-nums">{drift.massBalance.dispersedKg.toFixed(1)} kg</span></div>
        </div>
      )}
      {drift.error && <p className="text-xs text-danger">{drift.error}</p>}
    </div>
  )
}

export function SimulationConsole({ rightCollapsed, setRightCollapsed }: { rightCollapsed: boolean; setRightCollapsed: (v: boolean) => void }) {
  const status = useSimulationStore((s) => s.status)
  const busy = useSimulationStore((s) => s.busy)
  const error = useSimulationStore((s) => s.error)
  const spill = useSimulationStore((s) => s.spill)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const hasVessel = useSimulationStore((s) => s.selectedVesselId != null)
  const createSimulation = useSimulationStore((s) => s.createSimulation)
  const start = useSimulationStore((s) => s.start)
  const releaseSpill = useSimulationStore((s) => s.releaseSpill)
  const runForwardDrift = useSimulationStore((s) => s.runForwardDrift)
  const hasSelection = useMapStore((s) => s.selection != null)
  const provenance = useDataProvenance()

  const simulating = status === 'simulating'
  const canSpill = simulating && hasVessel
  const hasSpill = !!spill?.spillEventId
  const canDrift = hasSpill && driftStatus !== 'running'

  if (rightCollapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-4">
        <button
          className="text-ink-3 hover:text-ink-1 transition-colors rotate-90"
          onClick={() => setRightCollapsed(false)}
          title="Expand console"
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center space-x-2">
          <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <h2 className="text-xs font-semibold text-ink-1 tracking-wider">Simulation console</h2>
            <p className="text-[10px] text-ink-3 mt-0.5">
              <ProvenanceLabel kind={provenance.kind === 'no-data' ? 'empty' : provenance.kind === 'controlled' ? 'controlled' : provenance.kind === 'simulated' ? 'simulated' : 'empty'} />
            </p>
          </div>
        </div>
        <button
          className="text-ink-3 hover:text-ink-1 transition-colors"
          onClick={() => setRightCollapsed(true)}
          title="Collapse console"
        >
          <ChevronDownIcon size={16} className="-rotate-90" />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-surface)] focus:outline-none focus-visible:ring-1 focus-visible:ring-signal-blue"
        tabIndex={0}
        role="region"
        aria-label="Simulation Console Controls"
      >
        {hasSelection && (
          <div>
            <SelectionInspectorCard />
          </div>
        )}

        {/* Scenario controls */}
        <Panel title="Scenario controls">
          <div className="flex flex-col gap-2">
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={busy || status === 'simulating' || status === 'observation'}
                onClick={() => void createSimulation()}
              >
                Create simulation
              </Button>
              <Button
                size="sm"
                disabled={busy || status !== 'captain_mode'}
                onClick={() => void start()}
              >
                Start simulation
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || !canSpill}
                onClick={() => void releaseSpill()}
              >
                Release oil spill
              </Button>
              <Button
                size="sm"
                disabled={!canDrift}
                isLoading={driftStatus === 'running'}
                onClick={() => void runForwardDrift()}
              >
                {driftStatus === 'running' ? 'Running drift…' : 'Run forward drift'}
              </Button>
            </div>
          </div>
        </Panel>

        {/* Time scrubber */}
        <Panel title="Time">
          <TimeScrubber />
        </Panel>

        {/* Fleet & vessel */}
        <Panel title="Fleet">
          <VesselSelector />
          <div className="mt-3">
            <VesselDetail />
          </div>
        </Panel>

        {/* Spill event */}
        <Panel title="Spill event">
          <SpillSection />
        </Panel>

        {/* Forward drift */}
        <Panel title="Forward drift">
          <DriftSection />
        </Panel>

        {/* Footer */}
        <div className="mt-8 text-center px-4">
          <p className="text-[10px] text-ink-muted">
            {!status
              ? 'No active scenario. Create a simulation to begin.'
              : status === 'captain_mode'
                ? 'Captain mode — configure the scenario, then start the simulation.'
                : status === 'simulating'
                  ? 'Simulation running. Advance the clock, release a spill, or run forward drift.'
                  : 'Scenario complete.'}
          </p>
        </div>
      </div>
    </div>
  )
}
