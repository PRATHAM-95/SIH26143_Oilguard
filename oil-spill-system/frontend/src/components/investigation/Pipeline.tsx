import { Link } from 'react-router-dom'
import { STAGE_LABEL, STAGE_ORDER, useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'

/**
 * Visual investigation pipeline. Reads persistent investigation stages; each
 * stage is driven by backend STEP 11 WebSocket frames (step_complete) and
 * re-hydrated from GET /api/investigation/{id} on reconnect.
 *
 * When the investigation has never started (`status === null`) the fixed
 * stage skeleton is replaced with an action-oriented guide instead of eight
 * frozen "pending" rows, so first-time users understand the current state.
 */
export function InvestigationPipeline({ compact = false }: { compact?: boolean }) {
  const stages = useInvestigationStore((s) => s.stages)
  const status = useInvestigationStore((s) => s.status)

  const hasIncident = useSimulationStore((s) => s.spill?.incidentId != null)

  if (!status) {
    return (
      <div className="pipeline pipeline--empty">
        <div className="pipeline-empty-note">No investigation started yet.</div>
        <ol className="pipeline-guide">
          <li>
            {hasIncident ? (
              <Link className="link" to="/investigation">
                Investigation unlocked — open the workspace
              </Link>
            ) : (
              <Link className="link" to="/simulation">
                Create a simulation and release an oil spill
              </Link>
            )}
          </li>
          <li>
            {hasIncident ? 'Review the detected incident on the map.' : 'Observe the slick from space.'}
          </li>
          <li>Start the investigation to trace the source.</li>
        </ol>
      </div>
    )
  }

  return (
    <div className="pipeline">
      {STAGE_ORDER.map((id) => {
        const step = stages.find((s) => s.stageId === id)
        if (!step) return null
        let cls = 'pipeline-step'
        if (step.status === 'completed') cls += ' pipeline-step--complete'
        if (step.status === 'running') cls += ' pipeline-step--running'
        if (step.status === 'failed') cls += ' pipeline-step--failed'
        if (step.status === 'skipped' || step.status === 'unavailable') {
          cls += ' pipeline-step--skipped'
        }

        const symbol =
          step.status === 'completed' ? (
            <span aria-hidden="true">✓</span>
          ) : step.status === 'running' ? (
            <span aria-hidden="true" className="dot dot--running" />
          ) : step.status === 'failed' ? (
            <span aria-hidden="true">✕</span>
          ) : step.status === 'skipped' || step.status === 'unavailable' ? (
            <span aria-hidden="true">∅</span>
          ) : (
            <span aria-hidden="true" className="dot dot--idle" />
          )

        return (
          <div className={cls} key={id} aria-current={step.status === 'running' ? 'step' : undefined}>
            <span style={{ minWidth: 14, textAlign: 'center' }}>{symbol}</span>
            <span className="step-name">{STAGE_LABEL[id] ?? id}</span>
            {!compact ? (
              <span className="step-tool" style={{ marginLeft: 'auto' }}>
                {step.status}
              </span>
            ) : null}
            {step.status === 'running' && <span className="step-tool">running</span>}
          </div>
        )
      })}
    </div>
  )
}