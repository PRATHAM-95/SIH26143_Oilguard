import { Fragment, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { ProvenancePill, fmtTime } from '@/components/ui/primitives'
import { useInvestigationStore, STAGE_LABEL, STAGE_ORDER } from '@/store/investigationStore'
import { useMapStore } from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { InvestigationStageState } from '@/types/domain'

/**
 * Auto-reveals the scientific map layer when its pipeline stage completes
 * (SAR → slicks, backtracking → uncertainty region, attribution → candidates).
 * Layers are never force-hidden; user toggles win from that point on.
 */
export function AutoEnableLayers() {
  const stages = useInvestigationStore((s) => s.stages)
  const setLayer = useMapStore((s) => s.setLayer)
  const detectionDone = stages.find((s) => s.stageId === 'detection')?.status === 'completed'
  const backtrackDone = stages.find((s) => s.stageId === 'backtracking')?.status === 'completed'
  const attributionDone = stages.find((s) => s.stageId === 'attribution')?.status === 'completed'

  useEffect(() => {
    if (detectionDone) {
      setLayer('sarSlicks', true)
      setLayer('sarFootprint', true)
    }
  }, [detectionDone, setLayer])
  useEffect(() => {
    if (backtrackDone) setLayer('uncertainty', true)
  }, [backtrackDone, setLayer])
  useEffect(() => {
    if (attributionDone) setLayer('attribution', true)
  }, [attributionDone, setLayer])

  return null
}

function stageSymbol(status: InvestigationStageState['status']) {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '·'
    case 'failed':
      return '✕'
    case 'skipped':
    case 'unavailable':
      return '∅'
    default:
      return '○'
  }
}

/**
 * Horizontal 8-stage investigation stepper for the workspace top strip.
 * Each stage's colour state is mirrored by a symbol so status is never read
 * from colour alone.
 */
export function InvestigationStepper() {
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)
  const progress = useInvestigationStore((s) => s.progress)

  return (
    <div className="stepper" aria-label="Investigation stages">
      <ol className="stepper-track">
        {STAGE_ORDER.map((id, i) => {
          const step = stages.find((s) => s.stageId === id)
          const stat = step?.status ?? 'pending'
          return (
            <Fragment key={id}>
              {i > 0 ? <li className="stepper-link" aria-hidden="true" /> : null}
              <li className={`stepper-node stepper-node--${stat}`} data-stage={id}>
                <span className="stepper-node-mark" aria-hidden="true">
                  {stageSymbol(stat)}
                </span>
                <span className="stepper-node-label">{STAGE_LABEL[id] ?? id}</span>
              </li>
            </Fragment>
          )
        })}
      </ol>
      <div className="stepper-meta">
        <span className={`status-chip ${status === 'FAILED' ? 'status-chip--danger' : status === 'COMPLETED' ? 'status-chip--ok' : status ? 'status-chip--run' : ''}`}>
          {status ?? 'Idle'}
        </span>
        {status === 'CREATED' || status === 'RUNNING' ? (
          <span className="progress">
            <span className="progress-fill" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Start / cancel / retry / reveal — shared by the workspace pages. */
export function InvestigationControls({ align = 'row' }: { align?: 'row' | 'stack' }) {
  const incidentId = useSimulationStore((s) => s.spill?.incidentId ?? null)
  const status = useInvestigationStore((s) => s.status)
  const busy = useInvestigationStore((s) => s.busy)
  const reveal = useInvestigationStore((s) => s.reveal)
  const actionError = useInvestigationStore((s) => s.actionError)
  const start = useInvestigationStore((s) => s.start)
  const retry = useInvestigationStore((s) => s.retry)
  const cancel = useInvestigationStore((s) => s.cancel)
  const revealNow = useInvestigationStore((s) => s.revealGroundTruth)

  const active = status === 'CREATED' || status === 'RUNNING'
  const completed = status === 'COMPLETED'
  const failed = status === 'FAILED'
  const canStart = !!incidentId && !active && !completed && !busy

  return (
    <div className={align === 'row' ? 'row controls-row' : 'stack controls-stack'}>
      <Button
        variant="primary"
        block
        disabled={!canStart}
        title={incidentId ? 'Start the full investigation pipeline' : 'Release a spill first (Simulation page)'}
        onClick={() => incidentId && void start(incidentId)}
      >
        {active ? 'Running…' : completed ? 'Investigation complete' : 'Start investigation'}
      </Button>
      {active ? (
        <Button block disabled={busy} onClick={() => void cancel()}>
          Cancel
        </Button>
      ) : null}
      {failed ? (
        <Button block disabled={busy} onClick={() => void retry()}>
          Retry failed stages
        </Button>
      ) : null}
      {completed ? (
        <Button
          block
          disabled={busy || reveal.revealed}
          onClick={() => void revealNow()}
          className={reveal.revealed ? 'is-muted' : undefined}
        >
          {reveal.revealed ? 'Ground truth revealed' : 'Reveal ground truth'}
        </Button>
      ) : null}
      {actionError ? <div className="text-danger">{actionError}</div> : null}
    </div>
  )
}

/** Connected evidence chain — appended as the investigation progresses. */
export function EvidenceChain({ limit = 12 }: { limit?: number }) {
  const evidence = useInvestigationStore((s) => s.evidence)

  if (evidence.length === 0) {
    return (
      <div className="empty">
        <span className="empty-label">No evidence links yet</span>
        <span className="text-faint">Evidence is appended as each stage of the pipeline completes.</span>
      </div>
    )
  }

  const list = evidence.slice(-limit)

  return (
    <div className="evidence-chain" aria-label="Evidence chain">
      {list.map((e, i) => (
        <div className="evidence-chain-node" key={e.id ?? `ev-${i}`}>
          <div className="evidence-chain-rail">
            <span className={`evidence-chain-dot${i === list.length - 1 ? ' evidence-chain-dot--latest' : ''}`} aria-hidden="true" />
            {i < list.length - 1 ? <span className="evidence-chain-line" aria-hidden="true" /> : null}
          </div>
          <div className="evidence-chain-body">
            <div className="evidence-chain-head">
              <span className="evidence-label">{e.label}</span>
              <ProvenancePill value={e.provenance} />
            </div>
            <div className="evidence-value">
              {e.stageId ? STAGE_LABEL[e.stageId] ?? e.stageId : ''}
              {e.referenceId ? ` · ${e.referenceId}` : ''}
              {e.at ? ` · ${fmtTime(e.at)}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}