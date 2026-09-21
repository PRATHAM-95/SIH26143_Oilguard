import { useEffect, useRef } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import { FlightpathRail } from '../console/FlightpathRail'
import { ContextualConsole } from '../console/ContextualConsole'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useChallengeStore, runLiveChallenge } from '../console/ChallengeRunner'

export default function CommandCenterPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const booted = useRef(false)

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

  return (
    <WorkstationShell
      leftPanel={<FlightpathRail />}
      rightPanel={<ContextualConsole />}
    >
      <MaritimeMapTheater />
    </WorkstationShell>
  )
}
