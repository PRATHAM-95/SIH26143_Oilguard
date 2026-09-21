import { motion } from 'motion/react'
import {
  useInvestigationStore,
  STAGE_LABEL,
  STAGE_ORDER,
} from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useShellStore } from '../shell/shellStore'
import type { InvestigationStageStatus } from '@/types/domain'

const STAGE_SUBTITLES: Record<string, string> = {
  detection: 'SAR radar backscatter scan',
  characterization: 'Spill volume & classification',
  environment: 'Wind & currents interpolation',
  drift: 'Forward particle dispersion',
  backtracking: 'Lagrangian reverse solver',
  candidates: 'AIS spatial-temporal filter',
  attribution: 'Vessel suspect ranking',
  conclusion: 'Forensic incident verdict',
}

function stageGlyph(status: InvestigationStageStatus) {
  switch (status) {
    case 'completed':
      return <svg className="w-4 h-4 text-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
    case 'running':
      return <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
    case 'failed':
      return <svg className="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    case 'skipped':
    case 'unavailable':
      return <div className="w-2.5 h-2.5 rounded-full bg-ink-muted" />
    default:
      return <div className="w-2 h-2 rounded-full bg-ink-faint" />
  }
}

export function FlightpathRail() {
  const { leftCollapsed } = useShellStore()
  const stages = useInvestigationStore((s) => s.stages)
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const retry = useInvestigationStore((s) => s.retry)
  const start = useInvestigationStore((s) => s.start)
  const incidentId = useSimulationStore((s) => s.spill?.incidentId ?? null)

  return (
    <nav className="h-full flex flex-col bg-[#020509]">
      <div className={`p-4 border-b border-[#1a2636] flex items-center ${leftCollapsed ? 'justify-center' : ''}`}>
        {!leftCollapsed && (
          <div>
            <h2 className="text-xs font-semibold text-ink-1 uppercase tracking-wider">Flightpath</h2>
            <p className="text-[10px] font-mono text-ink-3 uppercase mt-0.5">8-Stage Sequence</p>
          </div>
        )}
        {leftCollapsed && (
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[#1a2636]/50">
            <svg className="w-4 h-4 text-ink-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {STAGE_ORDER.map((stageId) => {
          const step = stages.find((s) => s.stageId === stageId)
          const stat = step?.status ?? 'pending'
          const isFocused = focusedStageId === stageId
          const isRunning = stat === 'running'
          const isFail = stat === 'failed'

          return (
            <button
              key={stageId}
              onClick={() => {
                if (isFail) void retry(stageId)
                else setFocusedStageId(isFocused ? null : stageId)
              }}
              className="relative w-full flex items-center p-2 rounded outline-none text-left"
              title={leftCollapsed ? STAGE_LABEL[stageId] : undefined}
            >
              {isFocused && (
                <motion.div
                  layoutId="active-stage-indicator"
                  className="absolute inset-0 bg-[#1a2636]/50 rounded border border-[#1a2636]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <div className="relative z-10 flex items-center w-full">
                <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded ${leftCollapsed && !isFocused ? 'hover:bg-[#1a2636]/30' : ''}`}>
                  {stageGlyph(stat)}
                </div>
                
                {!leftCollapsed && (
                  <div className="ml-3 overflow-hidden">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm whitespace-nowrap ${isFocused || isRunning ? 'text-ink-1' : 'text-ink-3'}`}>
                        {STAGE_LABEL[stageId] ?? stageId}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-muted truncate mt-0.5">
                      {STAGE_SUBTITLES[stageId] ?? ''}
                    </p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {!leftCollapsed && incidentId && (
        <div className="p-4 border-t border-[#1a2636]">
           <button 
             className="w-full py-2 bg-[#1a2636] hover:bg-[#1a2636]/80 text-ink-1 text-xs font-semibold rounded uppercase tracking-wider transition-colors"
             onClick={() => start(incidentId)}
           >
             Launch Pipeline
           </button>
        </div>
      )}
    </nav>
  )
}
