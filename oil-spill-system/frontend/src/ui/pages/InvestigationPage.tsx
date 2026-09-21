import { useEffect, useRef, useState } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import { FlightpathRail } from '../console/FlightpathRail'
import { InvestigationConsole } from '../console/investigation/InvestigationConsole'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'

export default function InvestigationPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const booted = useRef(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Live WebSocket connections
  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  // Cold-open bootstrap: load existing state
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    if (simId) {
      void refreshState()
      void loadForSimulation(simId)
      void useSarStore.getState().loadObservation(simId)
      void useBacktrackingStore.getState().loadRuns(simId)
      void useAttributionStore.getState().loadRuns(simId)
      void useAttributionStore.getState().loadProviders()
    }
  }, [refreshState, loadForSimulation])

  // Sync on simulationId changes
  useEffect(() => {
    if (simulationId) {
      void refreshState()
      void loadForSimulation(simulationId)
    }
  }, [simulationId, refreshState, loadForSimulation])

  return (
    <WorkstationShell
      leftPanel={<FlightpathRail leftCollapsed={leftCollapsed} />}
      rightPanel={<InvestigationConsole rightCollapsed={rightCollapsed} setRightCollapsed={setRightCollapsed} />}
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      setLeftCollapsed={setLeftCollapsed}
      setRightCollapsed={setRightCollapsed}
    >
      <MaritimeMapTheater />
    </WorkstationShell>
  )
}
