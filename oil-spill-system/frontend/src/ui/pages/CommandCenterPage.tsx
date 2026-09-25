import { useEffect, useRef } from 'react'
import { OilGuardShell } from '../command-center/OilGuardShell'
import { useDemoOperationalScene } from '../command-center/useDemoOperationalScene'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useChallengeStore } from '../console/ChallengeRunner'

/**
 * Command center route.
 *
 * The data spine is unchanged from the previous implementation: the same two
 * WebSocket connection hooks, the same cold-open bootstrap, and the same
 * re-hydration effects. Only the presentation changed — the map-centric
 * `OilGuardShell` replaces the `WorkstationShell` + `FlightpathRail` +
 * `ContextualConsole` + closed-map-deck composition.
 */
export default function CommandCenterPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const booted = useRef(false)

  // Controlled-demo hydration (no-op outside ?demo=1).
  useDemoOperationalScene()

  // Real-time WebSocket connection sync
  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  // Cold-open bootstrap
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
    }
  }, [refreshState, loadForSimulation])

  useEffect(() => {
    if (simulationId) void refreshState()
  }, [simulationId, refreshState])

  useEffect(() => {
    if (simulationId) void loadForSimulation(simulationId)
  }, [simulationId, loadForSimulation])

  // Feature layers must follow the active simulation, not just the cold open —
  // otherwise a simulation adopted later (or the controlled demo) shows an
  // empty chart.
  useEffect(() => {
    if (!simulationId) return
    void useSarStore.getState().loadObservation(simulationId)
    void useBacktrackingStore.getState().loadRuns(simulationId)
    void useAttributionStore.getState().loadRuns(simulationId)
  }, [simulationId])

  return <OilGuardShell />
}
