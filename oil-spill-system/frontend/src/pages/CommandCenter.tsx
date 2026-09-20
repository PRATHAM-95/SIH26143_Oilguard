import { useEffect, useMemo, useRef } from 'react'
import { WorkstationShell } from '@/components/commandcenter/WorkstationShell'
import { MaritimeMap } from '@/components/commandcenter/MaritimeMap'
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import { useSarLayers } from '@/components/investigation/SarObservation'
import { useInvestigationMapLayers } from '@/components/map/InvestigationMap'
import { useSelectionRingLayers } from '@/components/workspace/selection'
import { useChallengeStore, runLiveChallenge } from '@/components/commandcenter/ChallengeRunner'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { type MapLayerId } from '@/store/mapStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'

export default function CommandCenter() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const booted = useRef(false)

  // Real-time WebSocket connection sync
  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  // Cold-open bootstrap: rehydrate remembered simulation or seed default DEMO challenge
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

  // Deck.gl WebGL layer arrays
  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const ringLayers = useSelectionRingLayers()

  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const sar = useSarStore((s) => s)
  const stages = useInvestigationStore((s) => s.stages)

  const regionReady = stages.find((s) => s.stageId === 'backtracking')?.status === 'completed'
  const candidatesReady = stages.find((s) => s.stageId === 'attribution')?.status === 'completed'

  // Dynamic layer availability detection
  const available: MapLayerId[] = useMemo(() => [
    ...(useSimulationStore.getState().vessels.length > 0 ? (['vessels'] as MapLayerId[]) : []),
    ...(spill?.location ? (['slick'] as MapLayerId[]) : []),
    ...(drift.particles.length > 0 || (drift.extent?.length ?? 0) > 0 ? (['drift'] as MapLayerId[]) : []),
    ...(sar.candidates.length > 0 ? (['sarSlicks'] as MapLayerId[]) : []),
    ...(sar.footprint ? (['sarFootprint'] as MapLayerId[]) : []),
    ...(regionReady ? (['uncertainty'] as MapLayerId[]) : []),
    ...(candidatesReady ? (['attribution'] as MapLayerId[]) : []),
  ], [spill?.location, drift.particles.length, drift.extent?.length, sar.candidates.length, sar.footprint, regionReady, candidatesReady])

  const layers = useMemo(
    () => [...simLayers, ...sarLayers, ...invLayers, ...ringLayers],
    [simLayers, sarLayers, invLayers, ringLayers]
  )

  return (
    <WorkstationShell
      map={<MaritimeMap layers={layers} />}
      availableLayers={available}
    />
  )
}