import { useMemo } from 'react'
import {
  useInvestigationStore,
  STAGE_LABEL,
  STAGE_ORDER,
} from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { Button } from '@/components/ui/Button'
import type { InvestigationStageStatus } from '@/types/domain'

const STAGE_SUBTITLES: Record<string, string> = {
  detection: 'SAR radar backscatter scan',
  characterization: 'Spill volume & classification',
  environment: 'ERA5 wind & CMEMS currents',
  drift: 'Forward particle dispersion',
  backtracking: 'Lagrangian reverse solver',
  candidates: 'AIS spatial-temporal filter',
  attribution: '5-factor Bayesian ranking',
  conclusion: 'Adjudicated legal finding',
}

function stageGlyph(status: InvestigationStageStatus): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '●'
    case 'failed':
      return '✕'
    case 'skipped':
    case 'unavailable':
      return '∅'
    default:
      return '○'
  }
}

export function FlightpathRail() {
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)
  const progress = useInvestigationStore((s) => s.progress)
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const start = useInvestigationStore((s) => s.start)
  const cancel = useInvestigationStore((s) => s.cancel)
  const retry = useInvestigationStore((s) => s.retry)
  const busy = useInvestigationStore((s) => s.busy)
  const incidentId = useSimulationStore((s) => s.spill?.incidentId ?? null)

  const active = status === 'CREATED' || status === 'RUNNING'
  const completed = status === 'COMPLETED'
  const failed = status === 'FAILED'

  const counts = useMemo(() => {
    let done = 0
    let fail = 0
    let run = 0
    for (const st of stages) {
      if (st.status === 'completed') done++
      else if (st.status === 'failed') fail++
      else if (st.status === 'running') run++
    }
    return { done, fail, run, total: STAGE_ORDER.length }
  }, [stages])

  const statusTone =
    status === 'COMPLETED'
      ? 'ok'
      : status === 'FAILED'
        ? 'danger'
        : active
          ? 'run'
          : 'idle'

  return (
    <nav className="flightpath-rail" role="region" aria-label="Forensic Investigation Flightpath">
      {/* Flightpath Rail Header */}
      <div className="flightpath-header">
        <div className="flightpath-title-row">
          <span className={`flightpath-beacon flightpath-beacon--${statusTone}`} aria-hidden="true" />
          <div className="flightpath-title-group">
            <h2 className="flightpath-heading">FORENSIC FLIGHTPATH</h2>
            <span className="flightpath-sub">8-STAGE RECONSTRUCTION</span>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="flightpath-progress-container">
          <div className="flightpath-progress-meta">
            <span className="progress-label">PIPELINE CONVERGENCE</span>
            <span className="progress-stat">
              {counts.done}/{counts.total} ({Math.round((progress ?? 0) * 100)}%)
            </span>
          </div>
          <div className="flightpath-progress-track" role="progressbar" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`flightpath-progress-fill flightpath-progress-fill--${statusTone}`}
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vertical Sequence Nodes */}
      <div className="flightpath-nodes-list" role="list">
        {STAGE_ORDER.map((stageId, idx) => {
          const step = stages.find((s) => s.stageId === stageId)
          const stat = step?.status ?? 'pending'
          const isFocused = focusedStageId === stageId
          const isRunning = stat === 'running'
          const isDone = stat === 'completed'
          const isFail = stat === 'failed'

          return (
            <div
              key={stageId}
              role="listitem"
              className={`flightpath-node-wrap ${isFocused ? 'flightpath-node-wrap--focused' : ''}`}
            >
              {/* Vertical connecting line */}
              {idx < STAGE_ORDER.length - 1 ? (
                <div
                  className={`flightpath-spine-line ${isDone ? 'flightpath-spine-line--done' : isRunning ? 'flightpath-spine-line--running' : ''}`}
                  aria-hidden="true"
                />
              ) : null}

              <button
                type="button"
                className={`flightpath-node flightpath-node--${stat} ${isFocused ? 'flightpath-node--active' : ''}`}
                onClick={() => {
                  if (isFail) {
                    void retry(stageId)
                  } else {
                    setFocusedStageId(isFocused ? null : stageId)
                  }
                }}
                title={`${STAGE_LABEL[stageId] ?? stageId} (${stat})`}
                aria-current={isRunning ? 'step' : undefined}
                aria-label={`${STAGE_LABEL[stageId] ?? stageId}: ${stat}`}
              >
                <div className="node-indicator">
                  <span className="node-glyph" aria-hidden="true">
                    {stageGlyph(stat)}
                  </span>
                  {isRunning ? <span className="radar-sweep" aria-hidden="true" /> : null}
                </div>

                <div className="node-content">
                  <div className="node-name-row">
                    <span className="node-title">{STAGE_LABEL[stageId] ?? stageId}</span>
                    <span className={`node-stat-pill node-stat-pill--${stat}`}>
                      {stat.toUpperCase()}
                    </span>
                  </div>
                  <span className="node-subtitle">{STAGE_SUBTITLES[stageId] ?? ''}</span>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Flightpath Bottom Controls */}
      <div className="flightpath-footer">
        {!active && !completed && incidentId ? (
          <Button
            variant="primary"
            size="sm"
            block
            disabled={busy}
            onClick={() => incidentId && void start(incidentId)}
          >
            Launch Investigation
          </Button>
        ) : null}

        {active ? (
          <Button
            variant="danger"
            size="sm"
            block
            disabled={busy}
            onClick={() => void cancel()}
          >
            Abort Execution
          </Button>
        ) : null}

        {failed ? (
          <Button
            variant="danger"
            size="sm"
            block
            disabled={busy}
            onClick={() => void retry()}
          >
            Retry Failed Stages ({counts.fail})
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
