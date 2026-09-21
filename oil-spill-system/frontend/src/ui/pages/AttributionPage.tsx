import { useEffect, useRef, useState } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import {
  AttributionControlRail,
  type AttributionFilterOptions,
} from '../console/attribution/AttributionControlRail'
import { AttributionConsole } from '../console/attribution/AttributionConsole'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useAttributionStore, useBacktrackingStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'

export default function AttributionPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const status = useAttributionStore((s) => s.status)
  const loadRuns = useAttributionStore((s) => s.loadRuns)
  const loadProviders = useAttributionStore((s) => s.loadProviders)
  const loadBtRuns = useBacktrackingStore((s) => s.loadRuns)
  const setLayer = useMapStore((s) => s.setLayer)

  const booted = useRef(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [filterOptions, setFilterOptions] = useState<AttributionFilterOptions>({
    vesselTypeFilter: 'ALL',
    sortBy: 'rank',
  })

  // Live WebSocket connection
  useSimulationConnection(simulationId)

  // Cold-open bootstrap
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    void loadProviders()
    if (simId) {
      void refreshState()
      void loadRuns(simId)
      void loadBtRuns(simId)
    }
  }, [refreshState, loadRuns, loadProviders, loadBtRuns])

  // Sync on simulationId changes
  useEffect(() => {
    if (simulationId) {
      void refreshState()
      void loadRuns(simulationId)
      void loadBtRuns(simulationId)
    }
  }, [simulationId, refreshState, loadRuns, loadBtRuns])

  // Auto-enable attribution layer when completed
  useEffect(() => {
    if (status === 'completed') {
      setLayer('attribution', true)
    }
  }, [status, setLayer])

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      setLayer('attribution', false)
    }
  }, [setLayer])

  return (
    <WorkstationShell
      leftPanel={
        <AttributionControlRail
          collapsed={leftCollapsed}
          filterOptions={filterOptions}
          setFilterOptions={setFilterOptions}
        />
      }
      rightPanel={
        <AttributionConsole
          rightCollapsed={rightCollapsed}
          setRightCollapsed={setRightCollapsed}
          filterOptions={filterOptions}
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
