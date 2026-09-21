import { useEffect, useRef, useState } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import { BacktrackingControlRail } from '../console/backtracking/BacktrackingControlRail'
import { BacktrackingConsole } from '../console/backtracking/BacktrackingConsole'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useBacktrackingStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'

export default function BacktrackingPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const btStatus = useBacktrackingStore((s) => s.status)
  const loadRuns = useBacktrackingStore((s) => s.loadRuns)
  const setLayer = useMapStore((s) => s.setLayer)

  const booted = useRef(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Live WebSocket connection
  useSimulationConnection(simulationId)

  // Cold-open bootstrap: reload simulation and prior backtracking runs
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    if (simId) {
      void refreshState()
      void loadRuns(simId)
    }
  }, [refreshState, loadRuns])

  // Sync when simulationId changes
  useEffect(() => {
    if (simulationId) {
      void refreshState()
      void loadRuns(simulationId)
    }
  }, [simulationId, refreshState, loadRuns])

  // Auto-enable map layers when backtracking completes
  useEffect(() => {
    if (btStatus === 'completed') {
      setLayer('backtracking', true)
      setLayer('sourceProbability', true)
      setLayer('uncertainty', true)
    }
  }, [btStatus, setLayer])

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      setLayer('backtracking', false)
      setLayer('sourceProbability', false)
      setLayer('uncertainty', false)
    }
  }, [setLayer])

  return (
    <WorkstationShell
      leftPanel={<BacktrackingControlRail collapsed={leftCollapsed} />}
      rightPanel={
        <BacktrackingConsole
          rightCollapsed={rightCollapsed}
          setRightCollapsed={setRightCollapsed}
        />
      }
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      setLeftCollapsed={setLeftCollapsed}
      setRightCollapsed={setRightCollapsed}
    >
      <MaritimeMapTheater />
    </WorkstationShell>
  )
}
