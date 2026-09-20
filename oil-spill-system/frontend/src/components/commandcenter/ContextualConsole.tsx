import { useState } from 'react'
import { useInvestigationStore } from '@/store/investigationStore'
import { useMapStore } from '@/store/mapStore'
import { IncidentCard } from './contextual/IncidentCard'
import { DetectionCard } from './contextual/DetectionCard'
import { EnvironmentDriftCard } from './contextual/EnvironmentDriftCard'
import { BacktrackingCard } from './contextual/BacktrackingCard'
import { AttributionCard } from './contextual/AttributionCard'
import { ConclusionCard } from './contextual/ConclusionCard'
import { SelectionInspectorCard } from './contextual/SelectionInspectorCard'
import { ChevronDownIcon, RadarIcon } from '@/components/ui/Icon'
import { Disclaimer } from '@/components/ui/primitives'

export function ContextualConsole() {
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)
  const hasSelection = useMapStore((s) => s.selection != null)
  const [collapsed, setCollapsed] = useState(false)

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

  return (
    <aside
      className={`contextual-console ${collapsed ? 'contextual-console--collapsed' : ''}`}
      aria-label="Contextual Intelligence Console"
    >
      {/* Console Floating Header */}
      <div className="console-hud-bar">
        <div className="console-hud-title-wrap">
          <span className="console-radar-icon" aria-hidden="true">
            <RadarIcon size={14} />
          </span>
          <span className="console-hud-title">CONTEXTUAL INTELLIGENCE</span>
          <span className="console-hud-phase">
            {hasSelection ? 'FEATURE INSPECT' : String(activeStageId).toUpperCase()}
          </span>
        </div>

        <div className="console-hud-actions">
          {focusedStageId ? (
            <button
              type="button"
              className="console-hud-reset"
              onClick={() => setFocusedStageId(null)}
              title="Reset to live pipeline stage"
            >
              Live Sync
            </button>
          ) : null}

          <button
            type="button"
            className="console-toggle-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand intelligence console' : 'Collapse intelligence console'}
            title={collapsed ? 'Expand console' : 'Collapse console'}
          >
            <span className={`toggle-chev ${collapsed ? 'toggle-chev--collapsed' : ''}`}>
              <ChevronDownIcon size={13} />
            </span>
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="console-scrollable-body">
          {hasSelection ? (
            <SelectionInspectorCard />
          ) : (
            <div className="console-card-transition">
              {renderStageCard()}
            </div>
          )}

          <div className="console-integrity-footer">
            <Disclaimer>
              Live scientific pipeline — all sensor models and trajectories reflect deterministic numerical computations.
            </Disclaimer>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
