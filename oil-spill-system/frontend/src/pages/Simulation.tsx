import MapView, { MapFurniture } from '@/components/map/MapView'
import { MapLayersPanel } from '@/components/ui/MapLayersPanel'
import { KeyValue, EmptyState } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { StatusChip } from '@/components/Status'
import { ProvenancePill } from '@/components/ui/primitives'
import { MissionWorkspace } from '@/components/workspace/MissionWorkspace'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { OverviewIntel } from '@/components/intel/IntelPanel'
import { ClockIcon, CrosshairIcon } from '@/components/ui/Icon'
import { useSimulationStore } from '@/store/simulationStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useSelectionRingLayers } from '@/components/workspace/selection'

function VesselSelector() {
  const vessels = useSimulationStore((s) => s.vessels)
  const selected = useSimulationStore((s) => s.selectedVesselId)
  const selectVessel = useSimulationStore((s) => s.selectVessel)

  return (
    <div className="stack">
      <select
        className="input"
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
        <EmptyState label="No vessels yet" hint="Create a simulation to seed the demo fleet." />
      )}
    </div>
  )
}

function VesselDetails() {
  const vessels = useSimulationStore((s) => s.vessels)
  const selected = useSimulationStore((s) => s.selectedVesselId)
  const vessel = vessels.find((v) => v.id === selected)

  if (!vessel) return null

  return (
    <div className="stack">
      <KeyValue label="Vessel" value={vessel.name} />
      <KeyValue label="Type" value={vessel.type} />
      <KeyValue label="MMSI" value={vessel.mmsi} />
      <KeyValue label="Speed" value={vessel.speed !== 0 ? `${vessel.speed.toFixed(1)} kn` : '—'} />
      <KeyValue label="Heading" value={vessel.heading !== 0 ? `${vessel.heading.toFixed(0)}°` : '—'} />
      <KeyValue label="Position" value={`${vessel.position.lat.toFixed(4)}°, ${vessel.position.lon.toFixed(4)}°`} />
    </div>
  )
}

function SpillPanel() {
  const spill = useSimulationStore((s) => s.spill)
  if (!spill || !spill.spillEventId) {
    return <EmptyState label="No spill released" hint="Select a vessel and press 'Release oil spill' in the dock." />
  }
  return (
    <div className="stack">
      <KeyValue label="Event" value={spill.spillEventId} />
      <KeyValue label="Oil type" value={spill.oilType ?? 'GENERIC CRUDE'} />
      <KeyValue label="Quantity" value={spill.quantityKg !== null ? `${spill.quantityKg} kg` : '—'} />
      <KeyValue
        label="Location"
        value={spill.location ? `${spill.location.lat.toFixed(4)}°, ${spill.location.lon.toFixed(4)}°` : '—'}
      />
    </div>
  )
}

function DriftPanel() {
  const drift = useSimulationStore((s) => s.drift)
  const status = drift.status
  const envSource = drift.environmentSource
  const hasData = drift.status !== 'idle' && drift.status !== 'failed'

  if (!hasData && status !== 'failed') {
    return <EmptyState label="No drift run yet" hint="Release a spill then run Forward Drift." />
  }

  return (
    <div className="stack">
      <div className="row">
        <span className="field-label" style={{ marginRight: 4 }}>Status</span>
        <StatusChip
          tone={status === 'completed' ? 'ok' : status === 'running' ? 'run' : status === 'failed' ? 'danger' : 'idle'}
          label={status}
        />
      </div>

      {drift.runId && <KeyValue label="Run ID" value={drift.runId} />}
      {drift.oilType && <KeyValue label="Oil type" value={drift.oilType} />}
      {drift.durationHours !== null && <KeyValue label="Duration" value={`${drift.durationHours} h`} />}
      {drift.particleCount !== null && <KeyValue label="Particles" value={String(drift.particleCount)} />}
      {drift.environmentSource && (
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="field-label">Environment</span>
            <ProvenancePill value={envSource} />
          </div>
          {drift.environmentDataset ? <KeyValue label="Dataset" value={drift.environmentDataset} /> : null}
        </div>
      )}
      {drift.modelVersion && <KeyValue label="Model" value={drift.modelVersion} />}
      {drift.timestepSeconds !== null && <KeyValue label="Timestep" value={`${drift.timestepSeconds} s`} />}

      {drift.massBalance && (
        <div style={{ marginTop: 4 }}>
          <div className="field-label" style={{ marginBottom: 2 }}>Mass balance</div>
          <KeyValue label="Remaining" value={`${drift.massBalance.remainingKg.toFixed(1)} kg`} />
          <KeyValue label="Evaporated" value={`${drift.massBalance.evaporatedKg.toFixed(1)} kg`} />
          <KeyValue label="Dispersed" value={`${drift.massBalance.dispersedKg.toFixed(1)} kg`} />
        </div>
      )}

      {drift.particles.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div className="field-label" style={{ marginBottom: 2 }}>Map info</div>
          <KeyValue label="Particles" value={`${drift.particles.length} in view`} />
          <KeyValue label="Label" value="SIMULATED OIL DRIFT" />
        </div>
      )}

      {drift.error && <div className="alert">{drift.error}</div>}
    </div>
  )
}

function CaptainDock() {
  const status = useSimulationStore((s) => s.status)
  const clock = useSimulationStore((s) => s.clock)
  const busy = useSimulationStore((s) => s.busy)
  const error = useSimulationStore((s) => s.error)
  const spill = useSimulationStore((s) => s.spill)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const createSimulation = useSimulationStore((s) => s.createSimulation)
  const start = useSimulationStore((s) => s.start)
  const advance = useSimulationStore((s) => s.advance)
  const releaseSpill = useSimulationStore((s) => s.releaseSpill)
  const runForwardDrift = useSimulationStore((s) => s.runForwardDrift)
  const hasVessel = useSimulationStore((s) => s.selectedVesselId !== null)

  const simulating = status === 'simulating'
  const canSpill = simulating && hasVessel
  const hasSpill = !!spill?.spillEventId
  const canDrift = hasSpill && driftStatus !== 'running'

  const clockLabel = clock ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ').replace('Z', '') + ' UTC' : '—'

  const simTone =
    status === 'simulating'
      ? 'run'
      : status === 'observation'
        ? 'ok'
        : status === 'captain_mode'
          ? 'warn'
          : 'idle'

  return (
    <div className="sim-dock">
      <div className="sim-dock-main">
        <div className="sim-dock-who">
          <span className="sim-dock-eyebrow">Captain Mode</span>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <StatusChip tone={simTone} label={status ?? 'Idle'}>
              {status ?? 'Idle'}
            </StatusChip>
            <span className="clock-readout">
              <ClockIcon size={13} />
              {clockLabel}
            </span>
          </div>
          {error ? <div className="alert" style={{ marginTop: 6 }}>{error}</div> : null}
        </div>

        <div className="sim-dock-controls">
          <Button
            variant="primary"
            disabled={busy || status === 'simulating' || status === 'observation'}
            onClick={() => void createSimulation()}
          >
            Create simulation
          </Button>
          <Button disabled={busy || status !== 'captain_mode'} onClick={() => void start()}>
            Start simulation
          </Button>
          <Button disabled={busy || !canSpill} title="Release an oil spill from the selected vessel" onClick={() => void releaseSpill()}>
            Release oil spill
          </Button>
          <Button
            disabled={!canDrift}
            title="Run OpenOil forward drift (6 h controlled field)"
            onClick={() => void runForwardDrift()}
          >
            {driftStatus === 'running' ? 'Running forward drift…' : 'Run forward drift'}
          </Button>
        </div>

        <div className="sim-dock-advance">
          <span className="sim-dock-caption">
            <CrosshairIcon size={11} /> Advance clock
          </span>
          <Button disabled={busy || !simulating} onClick={() => void advance(1)}>
            +1h
          </Button>
          <Button disabled={busy || !simulating} onClick={() => void advance(6)}>
            +6h
          </Button>
          <Button disabled={busy || !simulating} onClick={() => void advance(12)}>
            +12h
          </Button>
        </div>
      </div>

      <div className="timeline" aria-label="Simulation timeline">
        <span className="timeline-tick">T+0h</span>
        <span className="timeline-tick">T+1h</span>
        <span className="timeline-tick">T+6h</span>
        <span className="timeline-tick">T+12h</span>
      </div>
    </div>
  )
}

export default function Simulation() {
  const vessels = useSimulationStore((s) => s.vessels)
  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const hasSelection = useMapStore((s) => s.selection != null)
  useSimulationConnection(simulationId)

  const layers = useSimulationLayers()
  const ringLayers = useSelectionRingLayers()

  const available: MapLayerId[] = [
    ...(vessels.length > 0 ? (['vessels'] as MapLayerId[]) : []),
    ...(spill?.location ? (['slick'] as MapLayerId[]) : []),
    ...(drift.particles.length > 0 || (drift.extent?.length ?? 0) > 0 || drift.status === 'completed'
      ? (['drift'] as MapLayerId[])
      : []),
  ]

  return (
    <MissionWorkspace
      map={
        <div className="map-pane">
          <MapView
            layers={[...layers, ...ringLayers]}
            onSelect={(s) => useMapStore.getState().select(s)}
          >
            <MapFurniture />
          </MapView>
          <MapLayersPanel available={available} />
          <div className="map-note">
            Live Captain Mode fleet. Click a vessel to inspect it; release a spill to create the incident.
          </div>
        </div>
      }
      dock={<CaptainDock />}
      rail={
        <div className="rail-stack-inner">
          {hasSelection ? <ContextualPanel /> : (
            <section className="rail-section" aria-label="Overview">
              <h3 className="rail-section-title">Overview</h3>
              <OverviewIntel />
            </section>
          )}

          <section className="rail-section" aria-label="Vessel selection">
            <h3 className="rail-section-title">Vessel</h3>
            <VesselSelector />
            <VesselDetails />
          </section>

          <section className="rail-section" aria-label="Spill event">
            <h3 className="rail-section-title">Spill event</h3>
            <SpillPanel />
          </section>

          {drift.status !== 'idle' && (
            <section className="rail-section" aria-label="Forward oil drift">
              <h3 className="rail-section-title">Forward oil drift</h3>
              <DriftPanel />
            </section>
          )}
        </div>
      }
    />
  )
}