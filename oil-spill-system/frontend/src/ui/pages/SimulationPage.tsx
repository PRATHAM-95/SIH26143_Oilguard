import { useEffect, useRef, useState } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import { SimulationControlRail } from '../console/simulation/SimulationControlRail'
import { SimulationConsole } from '../console/simulation/SimulationConsole'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useSimulationStore } from '@/store/simulationStore'

export default function SimulationPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const booted = useRef(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Live WebSocket sync
  useSimulationConnection(simulationId)

  // Cold-open: if a simulation already exists, reload its state
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    if (simId) void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (simulationId) void refreshState()
  }, [simulationId, refreshState])

  return (
    <WorkstationShell
      leftPanel={<SimulationControlRail collapsed={leftCollapsed} />}
      rightPanel={<SimulationConsole rightCollapsed={rightCollapsed} setRightCollapsed={setRightCollapsed} />}
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      setLeftCollapsed={setLeftCollapsed}
      setRightCollapsed={setRightCollapsed}
    >
      <MaritimeMapTheater />
    </WorkstationShell>
  )
}
