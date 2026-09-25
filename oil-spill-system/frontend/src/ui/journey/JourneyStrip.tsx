/**
 * M11 Phase 7 — JourneyStrip.
 *
 * A slim always-visible status bar for the active case: a leading phase
 * headline, then either the 8-stage investigation pipeline or the pre-flight
 * milestones (scenario → spill → forward drift), then a single contextual CTA
 * that routes to the next workstation. Collapses to glyph-only milestones under
 * 900px so the map never loses chrome below the fold.
 *
 * When there is no simulation and no investigation, nothing renders — the layer
 * degrades honestly instead of implying a fake case.
 */
import { useNavigate } from 'react-router-dom'
import { useJourneyState, type JourneyStageNode } from './useDemoJourney'
import '@/styles/journey.css'

function statusClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'journey-node--done'
    case 'running':
      return 'journey-node--running'
    case 'failed':
    case 'skipped':
    case 'unavailable':
      return 'journey-node--failed'
    default:
      return 'journey-node--idle'
  }
}

function Node({ label, status, current }: { label: string; status: string; current?: boolean }) {
  return (
    <li
      className={`journey-node ${statusClass(status)}`}
      aria-current={current ? 'step' : undefined}
      aria-label={`${label} — ${status}`}
      title={`${label} — ${status}`}
    >
      <span className="journey-node__glyph" aria-hidden="true" />
      <span className="journey-node__label">{label}</span>
    </li>
  )
}

export function JourneyStrip() {
  const journey = useJourneyState()
  const navigate = useNavigate()

  if (!journey.active) return null

  const pipeline = journey.pipeline ?? []
  const runningId = pipeline.find((n: JourneyStageNode) => n.status === 'running')?.id

  return (
    <nav className="journey-strip" aria-label="Incident journey status">
      <div className="journey-strip__inner">
        <div className="journey-strip__phase">
          <span className="journey-kicker journey-strip__eyebrow">Journey</span>
          <span className="journey-strip__title">{journey.guidance.title}</span>
          <span className="journey-strip__context">{journey.guidance.context}</span>
        </div>

        <ol className="journey-strip__nodes">
          {journey.pipeline
            ? pipeline.map((node) => (
                <Node
                  key={node.id}
                  label={node.label}
                  status={node.status}
                  current={node.id === runningId}
                />
              ))
            : journey.preflight.map((node) => (
                <Node
                  key={node.id}
                  label={node.label}
                  status={node.done ? 'completed' : 'pending'}
                />
              ))}
        </ol>

        {journey.guidance.nextRoute && journey.guidance.nextAction ? (
          <button
            type="button"
            className="journey-cta"
            onClick={() => navigate(journey.guidance.nextRoute!)}
          >
            <span className="journey-cta__label">{journey.guidance.nextAction}</span>
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </nav>
  )
}