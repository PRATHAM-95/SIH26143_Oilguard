import { useMemo } from 'react'
import { Fragment } from 'react'
import { StatusChip } from '@/components/Status'
import { useInvestigationStore, STAGE_LABEL, STAGE_ORDER } from '@/store/investigationStore'
import type { InvestigationStageStatus } from '@/types/domain'

/** Glyph per stage status — status is never read from colour alone. */
function stageMark(status: InvestigationStageStatus): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '…'
    case 'failed':
      return '✕'
    case 'skipped':
    case 'unavailable':
      return '∅'
    default:
      return ''
  }
}

/**
 * Bottom investigation timeline dock. Eight fixed nodes with live status
 * (running nodes pulse), a progress bar, and per-node actions (retry on
 * failed/skipped). Clicking a node focuses it in the pipeline stage ledger.
 */
export function InvestigationTimeline() {
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)
  const progress = useInvestigationStore((s) => s.progress)
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  const retry = useInvestigationStore((s) => s.retry)

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const st of stages) counts[st.status] = (counts[st.status] ?? 0) + 1
    return counts
  }, [stages])

  const tone =
    status === 'COMPLETED'
      ? 'ok'
      : status === 'FAILED'
        ? 'danger'
        : status === 'CANCELLED'
          ? 'warn'
          : 'run'

  return (
    <div className="timeline-dock" aria-label="Investigation timeline">
      <div className="timeline-tag">
        <span className="timeline-tag-label">Investigation</span>
        <StatusChip tone={tone} label={status ?? 'Idle'}>
          {status ?? 'Idle'}
        </StatusChip>
      </div>
      <div className="inv-chain" role="list">
        {STAGE_ORDER.map((id, i) => {
          const step = stages.find((s) => s.stageId === id)
          const stat = step?.status ?? 'pending'
          const failed = stat === 'failed' || stat === 'skipped' || stat === 'unavailable'
          return (
            <Fragment key={id}>
              {i > 0 ? <span className="inv-link" aria-hidden="true" /> : null}
              <button
                type="button"
                role="listitem"
                className={`inv-node inv-node--${stat}${focusedStageId === id ? ' inv-node--focused' : ''}`}
                title={`${STAGE_LABEL[id] ?? id} — ${stat}${failed ? ' (click to retry)' : ''}`}
                aria-label={`${STAGE_LABEL[id] ?? id} — ${stat}${failed ? '. Click to retry.' : '. Click to show in ledger.'}`}
                aria-current={stat === 'running' ? 'step' : undefined}
                onClick={() => {
                  if (failed) {
                    void retry(id)
                    return
                  }
                  setFocusedStageId(focusedStageId === id ? null : id)
                }}
              >
                <span className="inv-node-mark" aria-hidden="true">
                  {stageMark(stat)}
                </span>
                <span className="inv-node-label">{STAGE_LABEL[id] ?? id}</span>
              </button>
            </Fragment>
          )
        })}
      </div>
      <div className="dock-progress">
        <div className="dock-progress-track">
          <span
            className="dock-progress-fill"
            style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
          />
        </div>
        <span className="dock-progress-num">
          {countByStatus.completed ?? 0}/{STAGE_ORDER.length} stages ·{' '}
          {Math.round((progress ?? 0) * 100)}%
        </span>
      </div>
    </div>
  )
}

/** Small inline steering buttons used where space is tight. */
export function TimelineFacet() {
  const status = useInvestigationStore((s) => s.status)
  const progress = useInvestigationStore((s) => s.progress)
  return (
    <div className="row" style={{ gap: 8 }}>
      <StatusChip tone={status === 'COMPLETED' ? 'ok' : status === 'FAILED' ? 'danger' : 'run'} label={status ?? 'Idle'}>
        {status ?? 'Idle'}
      </StatusChip>
      <div className="dock-progress-track">
        <span className="dock-progress-fill" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
      </div>
    </div>
  )
}