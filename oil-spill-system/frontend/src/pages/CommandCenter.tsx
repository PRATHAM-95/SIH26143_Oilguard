import { useEffect, useMemo, useRef, useState } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { MapLayersPanel } from '@/components/ui/MapLayersPanel'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { ProvenancePill, Disclaimer } from '@/components/ui/primitives'
import { LayersIcon } from '@/components/ui/Icon'
import { MissionWorkspace } from '@/components/workspace/MissionWorkspace'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { InvestigationTimeline } from '@/components/investigation/InvestigationTimeline'
import {
  InvestigationStepper,
  EvidenceChain,
  AutoEnableLayers,
} from '@/components/investigation/Stepper'
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import { useSarLayers, SarObservationPanel } from '@/components/investigation/SarObservation'
import { useInvestigationMapLayers } from '@/components/map/InvestigationMap'
import { useSelectionRingLayers } from '@/components/workspace/selection'
import { CaseHeader } from '@/components/commandcenter/CaseHeader'
import { SourceHero } from '@/components/commandcenter/SourceHero'
import { CandidateRail } from '@/components/commandcenter/CandidateRail'
import { useChallengeStore, runLiveChallenge } from '@/components/commandcenter/ChallengeRunner'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { useIncidentStore } from '@/store/incidentStore'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'

/** Live reflection of the Captain Mode simulation, read from the shared store. */
function CaptainSimulationPanel() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const status = useSimulationStore((s) => s.status)
  const clock = useSimulationStore((s) => s.clock)
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const hasSpill = useSimulationStore((s) => s.spill?.spillEventId != null)
  const provenance = useSimulationStore((s) => s.drift.environmentSource)
  if (!simulationId) {
    return (
      <Panel title="Captain simulation">
        <EmptyState label="No simulation running" hint="Start a live challenge to seed the scenario." />
      </Panel>
    )
  }

  return (
    <Panel title="Captain simulation" right={<ProvenancePill value={provenance ?? 'CONTROLLED'} />}>
      <KeyValue label="Simulation" value={simulationId.slice(0, 18) + '…'} />
      <KeyValue label="Status" value={status ?? '—'} />
      <KeyValue
        label="Clock"
        value={clock ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ') + 'Z' : '—'}
      />
      <KeyValue label="Vessels" value={vesselCount} />
      <KeyValue label="Spill event" value={hasSpill ? 'released' : 'none'} />
    </Panel>
  )
}

function IncidentPanel() {
  const incident = useIncidentStore((s) => s)
  const spill = useSimulationStore((s) => s.spill)
  if (incident.status === 'none') {
    return (
      <Panel title="Incident">
        <EmptyState
          label={spill?.incidentId ? 'Incident detected — pipeline ready' : 'No incident yet'}
          hint="The released slick creates the detected incident the investigation traces."
        />
      </Panel>
    )
  }
  return (
    <Panel title="Incident">
      <KeyValue label="Status" value={incident.status} />
      <KeyValue label="Observation" value={incident.observation} />
      {incident.location ? (
        <KeyValue
          label="Location"
          value={`${incident.location.lat.toFixed(4)}°, ${incident.location.lon.toFixed(4)}°`}
        />
      ) : null}
      {incident.observationTime ? <KeyValue label="Observed at" value={incident.observationTime} /> : null}
      {incident.detectionConfidence != null ? (
        <KeyValue
          label="Detection confidence"
          value={`${(incident.detectionConfidence * 100).toFixed(0)}%`}
        />
      ) : null}
    </Panel>
  )
}

export default function CommandCenter() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const hasSelection = useMapStore((s) => s.selection != null)
  const [layersOpen, setLayersOpen] = useState(true)
  const booted = useRef(false)

  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  // Cold-open bootstrap: a remembered simulation is re-hydrated; otherwise a
  // labelled DEMO challenge is auto-run through the real pipeline so the
  // command centre is never an empty shell.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    if (simId) {
      useChallengeStore.getState().setPhase('done')
      void refreshState()
      void loadForSimulation(simId)
      void useSarStore.getState().loadObservation(simId)
      void useBacktrackingStore.getState().loadRuns(simId)
      void useAttributionStore.getState().loadRuns(simId)
      void useAttributionStore.getState().loadProviders()
    } else {
      void runLiveChallenge('DEMO')
    }
  }, [refreshState, loadForSimulation])

  useEffect(() => {
    if (simulationId) void refreshState()
  }, [simulationId, refreshState])
  useEffect(() => {
    if (simulationId) void loadForSimulation(simulationId)
  }, [simulationId, loadForSimulation])

  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const ringLayers = useSelectionRingLayers()

  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const sar = useSarStore((s) => s)
  const stages = useInvestigationStore((s) => s.stages)
  const visibility = useMapStore((s) => s.visibility)

  const regionReady = stages.find((s) => s.stageId === 'backtracking')?.status === 'completed'
  const candidatesReady = stages.find((s) => s.stageId === 'attribution')?.status === 'completed'

  const available: MapLayerId[] = [
    ...(useSimulationStore.getState().vessels.length > 0 ? (['vessels'] as MapLayerId[]) : []),
    ...(spill?.location ? (['slick'] as MapLayerId[]) : []),
    ...(drift.particles.length > 0 || (drift.extent?.length ?? 0) > 0 ? (['drift'] as MapLayerId[]) : []),
    ...(sar.candidates.length > 0 ? (['sarSlicks'] as MapLayerId[]) : []),
    ...(sar.footprint ? (['sarFootprint'] as MapLayerId[]) : []),
    ...(regionReady ? (['uncertainty'] as MapLayerId[]) : []),
    ...(candidatesReady ? (['attribution'] as MapLayerId[]) : []),
  ]

  const availableSet = useMemo(() => new Set<MapLayerId>(available), [available])
  const activeCount = useMemo(
    () =>
      (Object.entries(visibility) as [MapLayerId, boolean][]).filter(
        ([id]) => availableSet.has(id),
      ).filter(([, v]) => v).length,
    [visibility, availableSet],
  )

  const layers = [...simLayers, ...sarLayers, ...invLayers, ...ringLayers]

  return (
    <MissionWorkspace
      toolbar={<CaseHeader />}
      map={
        <div className="map-pane cc-map-pane">
          <MapView
            layers={layers}
            onSelect={(selection) => useMapStore.getState().select(selection)}
          >
            <MapFurniture />
            <AutoEnableLayers />
          </MapView>

          <div className="map-overlay map-overlay--tl">
            <SourceHero />
          </div>

          <div className="map-overlay map-overlay--stepper">
            <div className="cc-stepper cc-glass">
              <InvestigationStepper />
            </div>
          </div>

          <button
            type="button"
            className="cc-layers-toggle"
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen((o) => !o)}
          >
            <LayersIcon size={13} />
            Data &amp; Layers
            <span className="cc-layers-count">{activeCount} on</span>
          </button>
          {layersOpen ? (
            <div className="map-layers-pop">
              <MapLayersPanel available={available} />
            </div>
          ) : null}

          <div className="map-overlay map-overlay--dock">
            <div className="cc-dock cc-glass">
              <InvestigationTimeline />
            </div>
          </div>
        </div>
      }
      rail={
        <div className="rail-stack-inner">
          {hasSelection ? (
            <ContextualPanel />
          ) : (
            <Panel title="Candidate vessels">
              <CandidateRail />
            </Panel>
          )}
          <Panel title="Evidence Chain">
            <EvidenceChain />
          </Panel>
          <Panel title="SAR observation">
            <SarObservationPanel simulationId={simulationId} />
          </Panel>
          <CaptainSimulationPanel />
          <IncidentPanel />
          <div style={{ padding: '4px 4px 10px' }}>
            <Disclaimer>
              Live pipeline — every provenance label reflects the data actually used; nothing is
              fabricated or dressed up as real.
            </Disclaimer>
          </div>
        </div>
      }
    />
  )
}