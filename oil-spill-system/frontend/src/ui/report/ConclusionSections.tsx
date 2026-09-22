import { useInvestigationStore, STAGE_LABEL, STAGE_ORDER } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useSarStore } from '@/store/sarStore'
import {
  ReportSection,
  ReportMetric,
  ReportMetricGrid,
  ReportEmpty,
  ReportNarrative,
  ReportProvenance,
  ReportTable,
} from './primitives'

/**
 * 10 — CONCLUSION
 * Strong editorial conclusion. Uses Newsreader for narrative weight.
 */
export function ConclusionSection() {
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const status = useInvestigationStore((s) => s.status)
  const lastReveal = useInvestigationStore((s) => s.lastReveal)
  const revealed = useInvestigationStore((s) => s.reveal.revealed)

  if (status !== 'COMPLETED') {
    return (
      <ReportSection id="conclusion" number="10" title="Conclusion" variant="conclusion">
        <ReportEmpty
          label="No conclusion available"
          hint="The investigation pipeline has not reached completion."
        />
      </ReportSection>
    )
  }

  const hasCandidate = conclusion?.status === 'candidate'
  const candidateName = hasCandidate && conclusion?.candidate
    ? String((conclusion.candidate as Record<string, unknown>).name ?? (conclusion.candidate as Record<string, unknown>).mmsi ?? '—')
    : null

  return (
    <ReportSection id="conclusion" number="10" title="Conclusion" variant="conclusion">
      <div className="report-conclusion">
        <div className="report-conclusion__verdict">
          {hasCandidate ? (
            <ReportNarrative>
              <p className="report-conclusion__lead">
                The multi-factor forensic attribution analysis identified{' '}
                <strong>{candidateName}</strong> as the primary candidate vessel.
                {conclusion?.topScore != null && (
                  <> The composite attribution score of{' '}
                    <span className="font-mono">{(conclusion.topScore * 100).toFixed(1)}%</span>
                    {conclusion.margin != null && (
                      <> with a {conclusion.decisive ? 'decisive' : 'narrow'} margin of{' '}
                        <span className="font-mono">{(conclusion.margin * 100).toFixed(1)}%</span>
                      </>
                    )}
                    {' '}indicates {conclusion.decisive
                      ? 'a statistically distinguishable primary suspect'
                      : 'a leading candidate, though the margin is narrow and warrants additional verification'
                    }.
                  </>
                )}
              </p>
            </ReportNarrative>
          ) : (
            <ReportNarrative>
              <p className="report-conclusion__lead">
                The investigation pipeline completed without identifying a decisive attribution
                candidate. The evidence available was insufficient to distinguish a single vessel
                with adequate confidence. This may reflect limited AIS coverage, inadequate
                environmental forcing data, or genuine ambiguity in the observed evidence.
              </p>
            </ReportNarrative>
          )}

          {conclusion?.reason && (
            <p className="report-conclusion__reason">{conclusion.reason}</p>
          )}
        </div>

        <div className="report-conclusion__caveat">
          A ranked candidate is never a confirmed culprit. The composite score represents
          the relative likelihood within the candidate set and the search window, not an
          absolute probability of responsibility. Further investigation, including flag state
          notification, port state control, and physical inspection, may be required to
          establish legal culpability.
        </div>
      </div>

      {/* Ground truth evaluation (if revealed) */}
      {revealed && lastReveal && (
        <>
          <h3 className="report-subsection-title">Ground Truth Evaluation</h3>
          <ReportMetricGrid columns={4}>
            <ReportMetric
              label="Position error"
              value={lastReveal.positionError_km?.toFixed(2)}
              unit="km"
              mono
            />
            <ReportMetric
              label="Time error"
              value={lastReveal.timeError_min != null ? `${lastReveal.timeError_min.toFixed(0)}` : null}
              unit="min"
              mono
            />
            <ReportMetric
              label="Attribution correct"
              value={lastReveal.attributionCorrect ? 'Yes' : 'No'}
            />
            <ReportMetric
              label="Score margin"
              value={lastReveal.scoreMargin?.toFixed(3)}
              mono
            />
          </ReportMetricGrid>
        </>
      )}
    </ReportSection>
  )
}

/**
 * 11 — EVIDENCE & PROVENANCE
 * Evidence chain + per-stage provenance.
 */
export function ProvenanceSection() {
  const evidence = useInvestigationStore((s) => s.evidence)
  const provenance = useInvestigationStore((s) => s.provenance)
  const stages = useInvestigationStore((s) => s.stages)

  return (
    <ReportSection id="provenance" number="11" title="Evidence & Provenance">
      <ReportNarrative>
        <p>
          This section documents the provenance of each evidence link in the investigation
          chain. Provenance labels distinguish live operational data, controlled demonstration
          scenarios, and simulated model outputs. No controlled or simulated source is
          presented as a real operational observation.
        </p>
      </ReportNarrative>

      {/* Per-stage provenance */}
      {provenance?.perStage && Object.keys(provenance.perStage).length > 0 && (
        <>
          <h3 className="report-subsection-title">Stage Provenance</h3>
          <ReportTable
            columns={[
              { key: 'stage', label: 'Stage' },
              { key: 'provenance', label: 'Provenance' },
              { key: 'status', label: 'Status' },
            ]}
            rows={STAGE_ORDER.map((stageId) => {
              const st = stages.find((s) => s.stageId === stageId)
              return {
                stage: STAGE_LABEL[stageId] ?? stageId,
                provenance: (
                  <ReportProvenance value={provenance.perStage[stageId] ?? st?.provenance ?? st?.sourceState} />
                ),
                status: st?.status ?? 'pending',
              }
            })}
            caption={`Investigation provenance — Aggregation: ${provenance.aggregation ?? 'Unknown'}`}
          />
        </>
      )}

      {/* Evidence chain */}
      {evidence.length > 0 && (
        <>
          <h3 className="report-subsection-title">Evidence Chain</h3>
          <ReportTable
            columns={[
              { key: 'label', label: 'Evidence' },
              { key: 'stage', label: 'Stage' },
              { key: 'type', label: 'Reference type' },
              { key: 'id', label: 'Reference ID', mono: true },
              { key: 'provenance', label: 'Provenance' },
              { key: 'at', label: 'Timestamp', mono: true },
            ]}
            rows={evidence.map((e) => ({
              label: e.label,
              stage: e.stageId ? (STAGE_LABEL[e.stageId] ?? e.stageId) : '—',
              type: e.referenceType ?? '—',
              id: e.referenceId ?? '—',
              provenance: <ReportProvenance value={e.provenance} />,
              at: e.at ? new Date(e.at).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : '—',
            }))}
            caption={`${evidence.length} evidence link(s) in the investigation chain.`}
          />
        </>
      )}
    </ReportSection>
  )
}

/**
 * 12 — LIMITATIONS / UNCERTAINTY
 * Explicit communication of limitations.
 */
export function LimitationsSection() {
  const warnings = useInvestigationStore((s) => s.warnings)
  const errors = useInvestigationStore((s) => s.errors)
  const stages = useInvestigationStore((s) => s.stages)
  const btWarnings = useBacktrackingStore((s) => s.warnings)
  const btErrors = useBacktrackingStore((s) => s.errors)
  const attrWarnings = useAttributionStore((s) => s.warnings)
  const attrErrors = useAttributionStore((s) => s.errors)
  const sarWarnings = useSarStore((s) => s.warnings)

  const allWarnings = [
    ...warnings.map((w) => ({ source: 'Investigation', text: w })),
    ...btWarnings.map((w) => ({ source: 'Backtracking', text: w })),
    ...attrWarnings.map((w) => ({ source: 'Attribution', text: w })),
    ...sarWarnings.map((w) => ({ source: 'SAR Detection', text: w })),
  ]
  const allErrors = [
    ...errors.map((e) => ({ source: 'Investigation', text: e })),
    ...btErrors.map((e) => ({ source: 'Backtracking', text: e })),
    ...attrErrors.map((e) => ({ source: 'Attribution', text: e })),
  ]
  const failedStages = stages.filter((s) => s.status === 'failed' || s.status === 'skipped' || s.status === 'unavailable')

  return (
    <ReportSection id="limitations" number="12" title="Limitations & Uncertainty">
      <ReportNarrative>
        <p>
          This section communicates known limitations, warnings, and uncertainties in the
          investigation. A forensically credible report must distinguish between established
          fact, derived result, and absence of evidence.
        </p>
      </ReportNarrative>

      <div className="report-limitations">
        <div className="report-limitations__item">
          <h4 className="report-limitations__heading">General Limitations</h4>
          <ul className="report-limitations__list">
            <li>Composite attribution scores are relative likelihoods, not absolute probabilities.</li>
            <li>A ranked candidate is never a confirmed culprit without independent verification.</li>
            <li>Backtracking uncertainty increases with simulation duration and forcing data quality.</li>
            <li>AIS coverage may be incomplete in the search corridor.</li>
          </ul>
        </div>

        {failedStages.length > 0 && (
          <div className="report-limitations__item">
            <h4 className="report-limitations__heading">Incomplete Stages</h4>
            <ul className="report-limitations__list">
              {failedStages.map((s) => (
                <li key={s.stageId}>
                  <strong>{STAGE_LABEL[s.stageId] ?? s.stageId}</strong>: {s.status}
                  {s.error && ` — ${s.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {allWarnings.length > 0 && (
          <div className="report-limitations__item">
            <h4 className="report-limitations__heading">Warnings</h4>
            <ul className="report-limitations__list">
              {allWarnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.source}</strong>: {w.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {allErrors.length > 0 && (
          <div className="report-limitations__item">
            <h4 className="report-limitations__heading">Errors</h4>
            <ul className="report-limitations__list">
              {allErrors.map((e, i) => (
                <li key={i}>
                  <strong>{e.source}</strong>: {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ReportSection>
  )
}

/**
 * 13 — TECHNICAL APPENDIX
 * Dense technical metadata. JetBrains Mono throughout.
 */
export function TechnicalAppendix() {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const incidentId = useInvestigationStore((s) => s.incidentId)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const spillEventId = useInvestigationStore((s) => s.spillEventId)
  const params = useInvestigationStore((s) => s.params)
  const stages = useInvestigationStore((s) => s.stages)
  const btRunId = useBacktrackingStore((s) => s.runId)
  const btEnvSrc = useBacktrackingStore((s) => s.environmentSource)
  const btDuration = useBacktrackingStore((s) => s.durationHours)
  const btEnsemble = useBacktrackingStore((s) => s.ensembleSize)
  const btParticles = useBacktrackingStore((s) => s.particlesPerMember)
  const attrRunId = useAttributionStore((s) => s.runId)
  const attrModel = useAttributionStore((s) => s.attributionModelVersion)
  const sarObsId = useSarStore((s) => s.observationId)
  const sarDetector = useSarStore((s) => s.detector)
  const sarDetectorVer = useSarStore((s) => s.detectorVersion)
  const driftRunId = useSimulationStore((s) => s.drift.runId)
  const driftModel = useSimulationStore((s) => s.drift.modelVersion)

  return (
    <ReportSection id="technical-appendix" number="13" title="Technical Appendix" variant="appendix">
      <div className="report-appendix">
        <h3 className="report-subsection-title">Identifiers</h3>
        <ReportMetricGrid columns={2}>
          <ReportMetric label="Investigation ID" value={investigationId} mono />
          <ReportMetric label="Incident ID" value={incidentId} mono />
          <ReportMetric label="Simulation ID" value={simulationId} mono />
          <ReportMetric label="Spill event ID" value={spillEventId} mono />
          <ReportMetric label="SAR observation ID" value={sarObsId} mono />
          <ReportMetric label="Drift run ID" value={driftRunId} mono />
          <ReportMetric label="Backtrack run ID" value={btRunId} mono />
          <ReportMetric label="Attribution run ID" value={attrRunId} mono />
        </ReportMetricGrid>

        {params && (
          <>
            <h3 className="report-subsection-title">Investigation Parameters</h3>
            <ReportMetricGrid columns={3}>
              <ReportMetric label="SAR source" value={params.sarSource} mono />
              <ReportMetric label="SAR detector" value={params.sarDetector} mono />
              <ReportMetric label="Max candidates" value={params.maxCandidates} mono />
              <ReportMetric label="Backtrack ensemble" value={params.backtrackEnsembleSize} mono />
              <ReportMetric label="Particles/member" value={params.backtrackParticlesPerMember} mono />
              <ReportMetric label="Backtrack duration" value={params.backtrackDurationHours} unit="h" mono />
              <ReportMetric label="Forward drift particles" value={params.forwardDriftParticleCount} mono />
              <ReportMetric label="Forward drift duration" value={params.forwardDriftDurationHours} unit="h" mono />
              <ReportMetric label="Environment source" value={params.environmentSource} mono />
              <ReportMetric label="AIS source" value={params.aisSource} mono />
              <ReportMetric label="Radius" value={params.radiusKm} unit="km" mono />
              <ReportMetric label="Max gap" value={params.maxGapMin} unit="min" mono />
              <ReportMetric label="Seed" value={params.seed} mono />
            </ReportMetricGrid>
          </>
        )}

        <h3 className="report-subsection-title">Model Versions</h3>
        <ReportMetricGrid columns={2}>
          <ReportMetric label="SAR detector" value={sarDetector} mono />
          <ReportMetric label="SAR detector version" value={sarDetectorVer} mono />
          <ReportMetric label="Drift model" value={driftModel} mono />
          <ReportMetric label="Attribution model" value={attrModel} mono />
          <ReportMetric label="Backtrack forcing" value={btEnvSrc} mono />
          <ReportMetric label="Backtrack duration" value={btDuration ? `${btDuration}h` : null} mono />
          <ReportMetric label="Ensemble size" value={btEnsemble} mono />
          <ReportMetric label="Particles/member" value={btParticles} mono />
        </ReportMetricGrid>

        <h3 className="report-subsection-title">Stage Execution Timeline</h3>
        <ReportTable
          columns={[
            { key: 'stage', label: 'Stage' },
            { key: 'status', label: 'Status' },
            { key: 'started', label: 'Started', mono: true },
            { key: 'completed', label: 'Completed', mono: true },
            { key: 'attempts', label: 'Attempts', align: 'right', mono: true },
            { key: 'ref', label: 'Reference', mono: true },
          ]}
          rows={stages.map((s) => ({
            stage: STAGE_LABEL[s.stageId] ?? s.stageId,
            status: s.status,
            started: s.stageStartedAt
              ? new Date(s.stageStartedAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
              : '—',
            completed: s.stageCompletedAt
              ? new Date(s.stageCompletedAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
              : '—',
            attempts: s.attemptCount,
            ref: s.referenceId ?? '—',
          }))}
          caption="Stage execution timeline and reference identifiers."
        />
      </div>
    </ReportSection>
  )
}
