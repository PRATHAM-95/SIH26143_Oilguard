import { motion } from 'motion/react'
import {
  useInvestigationStore,
  STAGE_LABEL,
  STAGE_ORDER,
} from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { InvestigationStageStatus } from '@/types/domain'
import { MOTION } from '@/ui/motion/tokens'
import { usePrefersReducedMotion } from '@/ui/motion/usePrefersReducedMotion'

export const STAGE_SUBTITLES: Record<string, string> = {
  detection: 'SAR radar backscatter scan',
  characterization: 'Spill volume & classification',
  environment: 'Wind & currents interpolation',
  forward_drift: 'Forward particle dispersion',
  backtracking: 'Lagrangian reverse solver',
  ais: 'AIS spatial-temporal filter',
  attribution: 'Vessel suspect ranking',
  conclusion: 'Forensic incident verdict',
}

function stageGlyph(status: InvestigationStageStatus) {
  switch (status) {
    case 'completed':
      return (
        <svg
          className="w-4 h-4 text-ok transition-all duration-120 ease-out"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'running':
      return (
        <div
          className="w-2.5 h-2.5 rounded-[2px] bg-signal-blue animate-pulse transition-all duration-120 ease-out"
          aria-hidden="true"
        />
      )
    case 'failed':
      return (
        <svg
          className="w-4 h-4 text-danger transition-all duration-120 ease-out"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )
    case 'skipped':
    case 'unavailable':
      return <div className="w-2.5 h-2.5 rounded-[2px] bg-ink-muted transition-all duration-120 ease-out" />
    default:
      return <div className="w-2 h-2 rounded-full bg-ink-faint transition-all duration-120 ease-out" />
  }
}

export function FlightpathRail({ leftCollapsed }: { leftCollapsed: boolean }) {
  const stages = useInvestigationStore((s) => s.stages)
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const retry = useInvestigationStore((s) => s.retry)
  const start = useInvestigationStore((s) => s.start)
  const incidentId = useSimulationStore((s) => s.spill?.incidentId ?? null)
  const reducedMotion = usePrefersReducedMotion()

  const completedCount = stages.filter((s) => s.status === 'completed').length
  const progressRatio = STAGE_ORDER.length > 0 ? completedCount / STAGE_ORDER.length : 0

  return (
    <nav className="h-full flex flex-col bg-[var(--bg-canvas)]" aria-label="Investigation Flightpath">
      <div className={`p-4 border-b border-[var(--border-default)] flex items-center ${leftCollapsed ? 'justify-center' : ''}`}>
        {!leftCollapsed && (
          <div>
            <h2 className="text-xs font-semibold text-ink-1 tracking-wider">Flightpath</h2>
            <p className="text-[10px] font-mono text-ink-3 mt-0.5">8-Stage Sequence</p>
          </div>
        )}
        {leftCollapsed && (
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--border-default)]/50">
            <svg className="w-4 h-4 text-ink-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </div>
        )}
      </div>

      {/* Progress connector using scaleX with origin-left (no width/layout animation) */}
      <div
        className="h-0.5 w-full bg-[var(--border-default)] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progressRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-signal-blue origin-left transition-transform duration-220 ease-out"
          style={{ transform: `scaleX(${progressRatio})` }}
        />
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
              className="relative w-full flex items-center p-2 rounded outline-none text-left active:scale-[0.97] transition-transform duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-1 focus-visible:ring-offset-abyss cursor-pointer"
              title={leftCollapsed ? STAGE_LABEL[stageId] : undefined}
            >
              {isFocused && (
                <motion.div
                  layoutId="active-stage-indicator"
                  className="absolute inset-0 bg-signal-blue/10 rounded-[3px] border border-signal-blue/40"
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: MOTION.duration.ui, ease: MOTION.ease.out }
                  }
                />
              )}

              <div className="relative z-10 flex items-center w-full">
                <div
                  className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded ${
                    leftCollapsed && !isFocused ? 'hover:bg-[var(--border-default)]/30' : ''
                  }`}
                >
                  {stageGlyph(stat)}
                </div>

                {!leftCollapsed && (
                  <div className="ml-3 overflow-hidden">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm whitespace-nowrap font-medium transition-colors duration-220 ease-out ${
                          isFocused ? 'text-porcelain' : isRunning ? 'text-ink-1' : 'text-ink-3'
                        }`}
                      >
                        {STAGE_LABEL[stageId] ?? stageId}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-muted truncate mt-0.5 transition-colors duration-220 ease-out">
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
        <div className="p-4 border-t border-[var(--border-default)]">
          <button
            className="w-full py-2 bg-signal-blue hover:bg-[#0048D9] text-porcelain text-xs font-semibold rounded-[3px] tracking-wider transition-colors active:scale-[0.97] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-blue focus-visible:ring-offset-1 focus-visible:ring-offset-abyss shadow-sm cursor-pointer"
            onClick={() => start(incidentId)}
          >
            Launch Pipeline
          </button>
        </div>
      )}
    </nav>
  )
}
