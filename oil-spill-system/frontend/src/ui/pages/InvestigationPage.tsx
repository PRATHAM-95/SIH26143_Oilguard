import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { WorkstationShell } from '../shell/WorkstationShell'
import { MaritimeMapTheater } from '../console/map/MaritimeMapTheater'
import { FlightpathRail } from '../console/FlightpathRail'
import { InvestigationConsole } from '../console/investigation/InvestigationConsole'
import { JourneyStrip } from '../journey/JourneyStrip'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'

const EvidenceStackViewport = lazy(() => import('../three/evidence/EvidenceStackViewport'))

export default function InvestigationPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const booted = useRef(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'map' | 'evidence-stack'>('map')

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
      rightPanel={
        <InvestigationConsole
          rightCollapsed={rightCollapsed}
          setRightCollapsed={setRightCollapsed}
          onOpenEvidenceStack={() => setViewMode(viewMode === 'map' ? 'evidence-stack' : 'map')}
          isEvidenceStackOpen={viewMode === 'evidence-stack'}
        />
      }
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      setLeftCollapsed={setLeftCollapsed}
      setRightCollapsed={setRightCollapsed}
    >
      <div className="flex flex-col w-full h-full">
        <JourneyStrip />
        <div className="relative flex-1 min-h-0">
          {viewMode === 'evidence-stack' ? (
            <Suspense
              fallback={
                <div className="w-full h-full bg-[#070b10] flex items-center justify-center font-mono text-xs text-[#727d89]">
                  CALIBRATING EVIDENCE VIEWPORT...
                </div>
              }
            >
              <EvidenceStackViewport onReturnToMap={() => setViewMode('map')} />
            </Suspense>
          ) : (
            <div className="relative w-full h-full">
              <MaritimeMapTheater />
              <div className="absolute top-3 right-3 z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('evidence-stack')}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider uppercase rounded border border-[#0057ff]/60 bg-[#0b1118]/90 hover:bg-[#0057ff] text-[#f8f7f4] shadow-lg transition-all cursor-pointer backdrop-blur-sm"
                  title="Decompose current incident into 9-layer 3D Exploded Evidence Stack"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0057ff]" />
                  <span>3D EVIDENCE STACK ↗</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkstationShell>
  )
}

