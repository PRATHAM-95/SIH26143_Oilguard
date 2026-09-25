/**
 * M11 Phase 7 — JourneyOverviewCard (+ ReportCompletionBanner).
 *
 * Command Center journey card: a compact floating overview of where the case
 * sits (phase, headline, facts, recommended next action) overlaid on the
 * Command Center deck. Rendered as a sibling overlay so it survives both the
 * closed (StationOverview) and open (MaritimeMapTheater) map states and never
 * steals map interaction.
 *
 * ReportCompletionBanner is the same narrative completing on the Incident
 * Dossier: a slim conclusive strip shown only when the pipeline finished.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useJourneyState } from './useDemoJourney'
import { useInvestigationStore } from '@/store/investigationStore'
import '@/styles/journey.css'

export function JourneyOverviewCard() {
  const journey = useJourneyState()
  const navigate = useNavigate()

  if (!journey.active) return null

  const completedStages = journey.pipeline
    ? journey.pipeline.filter((n) => n.status === 'completed').length
    : 0
  const spillMilestone = journey.preflight.find((n) => n.id === 'spill')
  const driftMilestone = journey.preflight.find((n) => n.id === 'drift')

  return (
    <section className="journey-card" aria-label="Incident journey overview">
      <div className="journey-card__head">
        <span className="journey-kicker">Journey status</span>
        <span className="journey-card__phase">{journey.guidance.title}</span>
      </div>
      <p className="journey-card__context">{journey.guidance.context}</p>
      <div className="journey-card__facts">
        <span className="journey-chip">Fleet {journey.fleetSize}</span>
        {spillMilestone && (
          <span className={`journey-chip${spillMilestone.done ? ' journey-chip--ok' : ''}`}>
            {spillMilestone.done ? 'Spill' : 'No spill'}
          </span>
        )}
        {driftMilestone && (
          <span className={`journey-chip${driftMilestone.done ? ' journey-chip--ok' : ''}`}>
            {driftMilestone.done ? 'Drift' : 'No drift'}
          </span>
        )}
        {journey.pipeline && (
          <span className="journey-chip">
            {completedStages}/{journey.pipeline.length} stages
          </span>
        )}
        {journey.matchedVessels > 0 && (
          <span className="journey-chip">AIS {journey.matchedVessels} matched</span>
        )}
      </div>
      {journey.guidance.nextRoute && journey.guidance.nextAction ? (
        <button
          type="button"
          className="journey-cta journey-cta--card"
          onClick={() => navigate(journey.guidance.nextRoute!)}
        >
          <span className="journey-cta__label">{journey.guidance.nextAction}</span>
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </section>
  )
}

/** Slim conclusive strip shown on the Incident Dossier once the pipeline ends. */
export function ReportCompletionBanner() {
  const invStatus = useInvestigationStore((s) => s.status)

  if (invStatus !== 'COMPLETED') return null

  return (
    <div className="journey-report-banner" role="status" aria-label="Investigation complete">
      <div>
        <span className="journey-kicker">Investigation pipeline complete</span>
        <p className="journey-report-banner__text">
          All pipeline stages finished. This dossier presents the evidence chain from detection
          through attribution.
        </p>
      </div>
      <Link className="journey-report-link" to="/investigation">
        Revisit pipeline →
      </Link>
    </div>
  )
}