import { useInvestigationStore } from '@/store/investigationStore'
import { useMapStore } from '@/store/mapStore'
import { IncidentCard } from './cards/IncidentCard'
import { DetectionCard } from './cards/DetectionCard'
import { EnvironmentDriftCard } from './cards/EnvironmentDriftCard'
import { BacktrackingCard } from './cards/BacktrackingCard'
import { AttributionCard } from './cards/AttributionCard'
import { ConclusionCard } from './cards/ConclusionCard'
import { SelectionInspectorCard } from './cards/SelectionInspectorCard'
import { ChevronDownIcon, RadarIcon } from '@/components/ui/Icon'
import { useShellStore } from '../shell/shellStore'

export function ContextualConsole() {
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)
  const hasSelection = useMapStore((s) => s.selection != null)
  
  const { rightCollapsed, setRightCollapsed } = useShellStore()

  // Determine which stage card to display
  const currentRunning = stages.find((s) => s.status === 'running')?.stageId
  const completedStages = stages.filter((s) => s.status === 'completed').map((s) => s.stageId)
  const highestCompleted = completedStages[completedStages.length - 1]

  const activeStageId = focusedStageId || currentRunning || highestCompleted || 'incident'

  const renderStageCard = () => {
    switch (activeStageId) {
      case 'detection':
        return <DetectionCard />
      case 'characterization':
      case 'environment':
            case 'forward_drift':
        return <EnvironmentDriftCard />
      case 'backtracking':
        return <BacktrackingCard />
            case 'ais':
      case 'attribution':
        return <AttributionCard />
      case 'conclusion':
        return <ConclusionCard />
      default:
        return status === 'COMPLETED' ? <ConclusionCard /> : <IncidentCard />
    }
  }

  if (rightCollapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-4">
        <button
          className="text-ink-3 hover:text-ink-1 transition-colors rotate-90"
          onClick={() => setRightCollapsed(false)}
          title="Expand console"
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Console Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1a2636] bg-[#0a0f16]">
        <div className="flex items-center space-x-2">
          <RadarIcon size={14} className="text-accent" />
          <div>
            <h2 className="text-xs font-semibold text-ink-1 uppercase tracking-wider">Contextual Console</h2>
            <p className="text-[10px] font-mono text-ink-3 uppercase mt-0.5">
              {hasSelection ? 'Feature Inspect' : String(activeStageId).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {focusedStageId && (
            <button
              className="text-[10px] font-semibold text-ink-3 hover:text-ink-1 uppercase tracking-wider transition-colors"
              onClick={() => setFocusedStageId(null)}
              title="Reset to live pipeline stage"
            >
              Live Sync
            </button>
          )}

          <button
            className="text-ink-3 hover:text-ink-1 transition-colors"
            onClick={() => setRightCollapsed(true)}
            title="Collapse console"
          >
            <ChevronDownIcon size={16} className="-rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#0a0f16]">
        {hasSelection ? (
          <SelectionInspectorCard />
        ) : (
          renderStageCard()
        )}

        <div className="mt-8 text-center px-4">
          <p className="text-[10px] text-ink-muted">
            Live scientific pipeline — all sensor models and trajectories reflect deterministic numerical computations.
          </p>
        </div>
      </div>
    </div>
  )
}
