import { useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { ReportProvenance } from './primitives'

/**
 * 01 — INCIDENT DOSSIER HERO
 * Full-width editorial opening. Newsreader for the title and lead statement,
 * Schibsted Grotesk for metadata, JetBrains Mono for IDs and timestamps.
 */
export function DossierHero() {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const status = useInvestigationStore((s) => s.status)
  const params = useInvestigationStore((s) => s.params)
  const createdAt = useInvestigationStore((s) => s.createdAt)
  const completedAt = useInvestigationStore((s) => s.completedAt)
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const spill = useSimulationStore((s) => s.spill)

  const statusText = status ?? 'Not started'
  const hasCandidate = conclusion?.status === 'candidate'

  return (
    <section id="dossier-hero" className="report-hero">
      <div className="report-hero__eyebrow">Incident Dossier</div>

      <h1 className="report-hero__title">
        Marine Oil Spill<br />
        <span className="report-hero__subtitle">Forensic Investigation Report</span>
      </h1>

      {hasCandidate && conclusion?.candidate && (
        <p className="report-hero__lead">
          Attribution analysis identified a primary candidate vessel with a composite score of{' '}
          <span className="font-mono">
            {conclusion.topScore != null ? `${(conclusion.topScore * 100).toFixed(1)}%` : '—'}
          </span>
          {conclusion.margin != null && (
            <> and a decisiveness margin of{' '}
              <span className="font-mono">{(conclusion.margin * 100).toFixed(1)}%</span>
            </>
          )}.
        </p>
      )}

      {!hasCandidate && status === 'COMPLETED' && (
        <p className="report-hero__lead">
          The investigation pipeline completed without identifying a decisive attribution candidate.
          Evidence convergence and limitations are documented in the sections below.
        </p>
      )}

      {!status || status === 'CREATED' || status === 'RUNNING' ? (
        <p className="report-hero__lead report-hero__lead--pending">
          This investigation has not yet completed. The report below reflects partial or pending state.
        </p>
      ) : null}

      <div className="report-hero__meta">
        <div className="report-hero__meta-row">
          <span className="report-hero__meta-label">Status</span>
          <span className="report-hero__meta-value">{statusText}</span>
        </div>
        {investigationId && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Investigation</span>
            <span className="report-hero__meta-value font-mono text-xs">{investigationId}</span>
          </div>
        )}
        {simulationId && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Simulation</span>
            <span className="report-hero__meta-value font-mono text-xs">{simulationId}</span>
          </div>
        )}
        {spill?.location && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Spill location</span>
            <span className="report-hero__meta-value font-mono text-xs">
              {spill.location.lat.toFixed(4)}°, {spill.location.lon.toFixed(4)}°
            </span>
          </div>
        )}
        {spill?.time && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Spill time</span>
            <span className="report-hero__meta-value font-mono text-xs">
              {new Date(spill.time).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
            </span>
          </div>
        )}
        {createdAt && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Initiated</span>
            <span className="report-hero__meta-value font-mono text-xs">
              {new Date(createdAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
            </span>
          </div>
        )}
        {completedAt && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Completed</span>
            <span className="report-hero__meta-value font-mono text-xs">
              {new Date(completedAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
            </span>
          </div>
        )}
        {params?.seed != null && (
          <div className="report-hero__meta-row">
            <span className="report-hero__meta-label">Seed</span>
            <span className="report-hero__meta-value font-mono text-xs">{params.seed}</span>
          </div>
        )}
      </div>

      <div className="report-hero__provenance">
        Report aggregated from the recorded investigation state.
        Every figure carries provenance — controlled or simulated data is always labelled.
        Scores are composite likelihoods for the search window and are <em>not</em> probabilities.
      </div>
    </section>
  )
}

/**
 * 02 — EXECUTIVE FINDING
 * The most important result. Quiet narrative space with editorial weight.
 */
export function ExecutiveFinding() {
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const status = useInvestigationStore((s) => s.status)
  const provenance = useInvestigationStore((s) => s.provenance)

  if (!status || status === 'CREATED') {
    return (
      <section id="executive-finding" className="report-finding">
        <div className="report-finding__badge report-finding__badge--pending">
          Investigation not started
        </div>
        <p className="report-finding__text">
          No investigation has been initiated. Run the investigation pipeline from the Investigation
          workspace, then return here to view the forensic report.
        </p>
      </section>
    )
  }

  if (status === 'RUNNING') {
    return (
      <section id="executive-finding" className="report-finding">
        <div className="report-finding__badge report-finding__badge--running">
          Investigation in progress
        </div>
        <p className="report-finding__text">
          The investigation pipeline is currently executing. This report will update when the pipeline
          completes.
        </p>
      </section>
    )
  }

  if (status === 'FAILED') {
    return (
      <section id="executive-finding" className="report-finding">
        <div className="report-finding__badge report-finding__badge--failed">
          Investigation failed
        </div>
        <p className="report-finding__text">
          The investigation pipeline encountered a fatal error and could not complete.
          See the Limitations section for details.
        </p>
      </section>
    )
  }

  if (status === 'CANCELLED') {
    return (
      <section id="executive-finding" className="report-finding">
        <div className="report-finding__badge report-finding__badge--cancelled">
          Investigation cancelled
        </div>
        <p className="report-finding__text">
          The investigation was cancelled before completion. Partial results may be available below.
        </p>
      </section>
    )
  }

  const hasCandidate = conclusion?.status === 'candidate'
  const candidateName = hasCandidate && conclusion?.candidate
    ? String((conclusion.candidate as Record<string, unknown>).name ?? (conclusion.candidate as Record<string, unknown>).mmsi ?? '—')
    : null

  return (
    <section id="executive-finding" className="report-finding">
      <div className={`report-finding__badge ${hasCandidate ? 'report-finding__badge--candidate' : 'report-finding__badge--inconclusive'}`}>
        {hasCandidate ? 'Primary candidate identified' : 'Attribution inconclusive'}
      </div>

      {hasCandidate && candidateName && (
        <div className="report-finding__vessel">{candidateName}</div>
      )}

      {conclusion?.topScore != null && (
        <div className="report-finding__scores">
          <span>
            Composite score:{' '}
            <strong className="font-mono">{(conclusion.topScore * 100).toFixed(1)}%</strong>
          </span>
          {conclusion.margin != null && (
            <span>
              Margin:{' '}
              <strong className="font-mono">{(conclusion.margin * 100).toFixed(1)}%</strong>
            </span>
          )}
          {conclusion.decisive != null && (
            <span>
              Decisive: <strong>{conclusion.decisive ? 'Yes' : 'No'}</strong>
            </span>
          )}
        </div>
      )}

      {conclusion?.reason && (
        <p className="report-finding__reason">{conclusion.reason}</p>
      )}

      {conclusion?.why && (
        <p className="report-finding__why">{conclusion.why}</p>
      )}

      {provenance?.aggregation && (
        <div className="report-finding__provenance">
          Data basis: <ReportProvenance value={provenance.aggregation} />
        </div>
      )}
    </section>
  )
}
