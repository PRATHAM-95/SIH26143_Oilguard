import { useAttributionStore } from '@/store/featureStores'
import {
  ReportSection,
  ReportMetric,
  ReportMetricGrid,
  ReportEmpty,
  ReportTable,
  ReportFigure,
  ReportProvenance,
  ReportNarrative,
} from './primitives'

/**
 * 08 — AIS / VESSEL TRAFFIC
 * AIS evidence: search parameters, corridor, vessel candidate list.
 */
export function AISSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const attr = useAttributionStore()

  const aisData = reportData?.['9_ais'] as Record<string, unknown> | undefined
  const aisSummary = aisData?.summary ? String(aisData.summary) : null

  if (attr.status === 'idle' && !attr.runId) {
    return (
      <ReportSection id="ais-traffic" number="08" title="AIS Vessel Traffic">
        <ReportEmpty
          label="No AIS data"
          hint="Attribution / AIS analysis has not been executed."
        />
      </ReportSection>
    )
  }

  return (
    <ReportSection id="ais-traffic" number="08" title="AIS Vessel Traffic">
      <ReportNarrative>
        {aisSummary ? (
          <p>{aisSummary}</p>
        ) : (
          <p>
            The AIS analysis module queries historical vessel traffic within a spatial-temporal
            corridor around the estimated source position and time window. Vessels transiting
            this corridor are filtered and scored for attribution candidacy.
          </p>
        )}
      </ReportNarrative>

      <h3 className="report-subsection-title">Search Parameters</h3>
      <ReportMetricGrid columns={3}>
        <ReportMetric label="Corridor radius" value={attr.radiusKm} unit="km" mono />
        <ReportMetric label="Max gap tolerance" value={attr.maxGapMin} unit="min" mono />
        <ReportMetric label="AIS source" value={attr.aisSource} />
        <ReportMetric label="Vessels queried" value={attr.vesselCount} mono />
        <ReportMetric label="Retained" value={attr.kept} mono />
        <ReportMetric label="Filtered out" value={attr.dropped} mono />
      </ReportMetricGrid>

      {/* AIS Search Corridor Analytical Plate */}
      {attr.origin && (
        <ReportFigure
          title="AIS Corridor & Vessel Distribution"
          description={`Spatial distribution of ${attr.vessels.length} candidate vessel(s) within the ${attr.radiusKm ?? 25} km search corridor relative to estimated source origin.`}
          provenance={attr.aisSource ?? 'AIS Stream'}
          timeRef={attr.timeRange ? `${new Date(attr.timeRange.earliest).toISOString().slice(11, 16)}Z — ${new Date(attr.timeRange.latest).toISOString().slice(11, 16)}Z` : undefined}
        >
          <AISCorridorAnalyticalPlate
            origin={attr.origin}
            radiusKm={attr.radiusKm ?? 25}
            vessels={attr.vessels}
          />
        </ReportFigure>
      )}

      {attr.origin && (
        <div className="report-env-source">
          <span className="report-env-source__label">Search anchor</span>
          <span className="report-env-source__note font-mono text-xs">
            {attr.origin.lat.toFixed(4)}°, {attr.origin.lon.toFixed(4)}°
          </span>
        </div>
      )}

      {attr.timeRange && (
        <div className="report-env-source">
          <span className="report-env-source__label">Time window</span>
          <span className="report-env-source__note font-mono text-xs">
            {new Date(attr.timeRange.earliest).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')} —{' '}
            {new Date(attr.timeRange.latest).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}
          </span>
        </div>
      )}

      {attr.aisQuery && (
        <div className="report-env-source">
          <span className="report-env-source__label">Query provenance</span>
          <span className="report-env-source__note">
            <ReportProvenance value={attr.aisQuery.sourceState ?? attr.sourceState} />
            {attr.aisQuery.provider && ` · Provider: ${attr.aisQuery.provider}`}
            {attr.aisQuery.dataset && ` · Dataset: ${attr.aisQuery.dataset}`}
            {attr.aisQuery.elapsedMs != null && ` · ${attr.aisQuery.elapsedMs} ms`}
          </span>
        </div>
      )}

      {attr.vessels.length > 0 && (
        <>
          <h3 className="report-subsection-title">Candidate Vessels</h3>
          <ReportTable
            columns={[
              { key: 'rank', label: '#', align: 'center', mono: true },
              { key: 'name', label: 'Vessel' },
              { key: 'mmsi', label: 'MMSI', mono: true },
              { key: 'type', label: 'Type' },
              { key: 'distance', label: 'Min distance', align: 'right', mono: true },
              { key: 'approach', label: 'Closest approach', mono: true },
            ]}
            rows={attr.vessels.map((v) => ({
              rank: v.rank,
              name: v.name ?? '—',
              mmsi: v.mmsi ?? '—',
              type: v.vesselType ?? '—',
              distance: v.minDistanceKm != null ? `${v.minDistanceKm.toFixed(2)} km` : '—',
              approach: v.timeOfClosestApproach
                ? new Date(v.timeOfClosestApproach).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
                : '—',
            }))}
            caption={`${attr.vessels.length} candidate vessel(s) within the search corridor.${attr.sourceState ? ` AIS source: ${attr.sourceState}` : ''}`}
          />
        </>
      )}
    </ReportSection>
  )
}

/**
 * Static SVG analytical plate representing the AIS search corridor and candidate vessels.
 * Works in both screen and print without WebGL.
 */
function AISCorridorAnalyticalPlate({
  origin,
  radiusKm,
  vessels,
}: {
  origin: { lon: number; lat: number }
  radiusKm: number
  vessels: { rank: number; name: string | null; mmsi: string | null; minDistanceKm: number | null }[]
}) {
  const width = 360
  const height = 220
  const cx = 160
  const cy = 110
  const maxR = 85

  return (
    <div className="analytical-plate">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytical-plate__svg" aria-label="AIS Search corridor and candidate positions">
        <rect width={width} height={height} fill="var(--color-trench, #0B1118)" rx={3} />

        {/* Range rings (e.g. 50%, 100%) */}
        <circle cx={cx} cy={cy} r={maxR * 0.5} fill="none" stroke="var(--color-chartline, #273340)" strokeWidth={0.5} strokeDasharray="3 3" />
        <circle cx={cx} cy={cy} r={maxR} fill="rgba(0, 87, 255, 0.05)" stroke="#0057FF" strokeWidth={1} />

        {/* Crosshair axes */}
        <line x1={cx - maxR - 10} y1={cy} x2={cx + maxR + 10} y2={cy} stroke="var(--color-chartline, #273340)" strokeWidth={0.5} />
        <line x1={cx} y1={cy - maxR - 10} x2={cx} y2={cy + maxR + 10} stroke="var(--color-chartline, #273340)" strokeWidth={0.5} />

        {/* Search anchor center point */}
        <circle cx={cx} cy={cy} r={3} fill="#F8F7F4" />
        <circle cx={cx} cy={cy} r={6} fill="none" stroke="#F8F7F4" strokeWidth={1} />
        <text x={cx + 8} y={cy - 6} fill="var(--color-porcelain, #F8F7F4)" fontSize={8} fontFamily="'JetBrains Mono Variable', monospace">
          Origin
        </text>

        {/* Range labels */}
        <text x={cx + maxR * 0.5 + 2} y={cy - 3} fill="var(--color-dim, #727D89)" fontSize={7} fontFamily="'JetBrains Mono Variable', monospace">
          {(radiusKm * 0.5).toFixed(0)} km
        </text>
        <text x={cx + maxR + 2} y={cy - 3} fill="var(--color-dim, #727D89)" fontSize={7} fontFamily="'JetBrains Mono Variable', monospace">
          {radiusKm.toFixed(0)} km corridor
        </text>

        {/* Candidate vessels */}
        {vessels.slice(0, 5).map((v, i) => {
          const dist = v.minDistanceKm ?? (radiusKm * (0.3 + i * 0.15))
          const rPos = Math.min(maxR - 5, Math.max(15, (dist / radiusKm) * maxR))
          // Distribute angles deterministically around center
          const angle = (i * 1.35) + 0.5
          const vx = cx + Math.cos(angle) * rPos
          const vy = cy + Math.sin(angle) * rPos
          const isTop = v.rank === 1

          return (
            <g key={v.mmsi ?? i}>
              {/* Radial approach line */}
              <line x1={cx} y1={cy} x2={vx} y2={vy} stroke={isTop ? '#0057FF' : '#727D89'} strokeWidth={0.8} strokeDasharray={isTop ? 'none' : '2 2'} opacity={0.6} />
              {/* Vessel marker */}
              <circle cx={vx} cy={vy} r={isTop ? 5 : 3.5} fill={isTop ? '#0057FF' : 'var(--color-deck, #16202B)'} stroke={isTop ? '#F8F7F4' : '#727D89'} strokeWidth={isTop ? 1.5 : 1} />
              {/* Label */}
              <text
                x={vx + (Math.cos(angle) > 0 ? 7 : -7)}
                y={vy + (Math.sin(angle) > 0 ? 8 : -4)}
                textAnchor={Math.cos(angle) > 0 ? 'start' : 'end'}
                fill={isTop ? 'var(--color-porcelain, #F8F7F4)' : 'var(--color-mist, #B2BBC5)'}
                fontSize={isTop ? 9 : 8}
                fontWeight={isTop ? 'bold' : 'normal'}
                fontFamily="'Schibsted Grotesk Variable', sans-serif"
              >
                #{v.rank} {v.name ? v.name.slice(0, 10) : (v.mmsi ?? 'Vessel')} ({dist.toFixed(1)} km)
              </text>
            </g>
          )
        })}

        {/* Legend / Coordinate label */}
        <text x="14" y={height - 12} fill="var(--color-dim, #727D89)" fontSize={8} fontFamily="'JetBrains Mono Variable', monospace">
          Anchor: {origin.lat.toFixed(3)}°, {origin.lon.toFixed(3)}°
        </text>
        <text x={width - 14} y={height - 12} textAnchor="end" fill="var(--color-dim, #727D89)" fontSize={8} fontFamily="'JetBrains Mono Variable', monospace">
          Radius: {radiusKm} km
        </text>
      </svg>
    </div>
  )
}

/**
 * 09 — ATTRIBUTION
 * Full attribution analysis with five-factor score breakdown.
 */
export function AttributionSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const attr = useAttributionStore()

  const attrData = reportData?.['10_attribution'] as Record<string, unknown> | undefined
  const attrSummary = attrData?.summary ? String(attrData.summary) : null

  if (attr.status === 'idle' && !attr.runId) {
    return (
      <ReportSection id="attribution" number="09" title="Multi-Factor Attribution">
        <ReportEmpty
          label="No attribution data"
          hint="Attribution scoring has not been executed."
        />
      </ReportSection>
    )
  }

  const primaryCandidate = attr.vessels.length > 0 ? attr.vessels[0] : null
  const FACTOR_LABELS: Record<string, string> = {
    spatial: 'Spatial match',
    temporal: 'Temporal match',
    trajectory: 'Trajectory consistency',
    anomaly: 'Behavioral anomaly',
    environmental: 'Environmental agreement',
  }

  return (
    <ReportSection id="attribution" number="09" title="Multi-Factor Attribution">
      <ReportNarrative>
        {attrSummary ? (
          <p>{attrSummary}</p>
        ) : (
          <p>
            Attribution scoring evaluates each candidate vessel against five forensic evidence
            factors: spatial proximity to the estimated source, temporal coincidence with the
            estimated release time, trajectory consistency with modelled drift paths, behavioral
            anomaly detection (speed changes, AIS gaps), and environmental drift agreement.
            The composite score is a weighted product of these factors.
          </p>
        )}
      </ReportNarrative>

      {/* Attribution conclusion */}
      {attr.conclusion && (
        <div className={`report-attribution-verdict ${attr.conclusion === 'candidate' ? 'report-attribution-verdict--candidate' : 'report-attribution-verdict--inconclusive'}`}>
          <span className="report-attribution-verdict__label">
            {attr.conclusion === 'candidate' ? 'Primary candidate identified' : 'Attribution inconclusive'}
          </span>
          {attr.ranking && (
            <span className="report-attribution-verdict__detail font-mono">
              Top: {(attr.ranking.top_score * 100).toFixed(1)}% · 
              Second: {(attr.ranking.second_score * 100).toFixed(1)}% · 
              Margin: {(attr.ranking.margin * 100).toFixed(1)}% · 
              Decisive: {attr.ranking.decisive ? 'Yes' : 'No'}
            </span>
          )}
        </div>
      )}

      {/* Primary candidate detail */}
      {primaryCandidate && (
        <>
          <h3 className="report-subsection-title">Primary Candidate</h3>
          <ReportMetricGrid columns={3}>
            <ReportMetric label="Vessel" value={primaryCandidate.name ?? primaryCandidate.mmsi} />
            <ReportMetric label="MMSI" value={primaryCandidate.mmsi} mono />
            <ReportMetric label="Type" value={primaryCandidate.vesselType} />
            <ReportMetric
              label="Composite score"
              value={primaryCandidate.score != null ? `${(primaryCandidate.score * 100).toFixed(1)}%` : null}
              mono
            />
            <ReportMetric
              label="Closest distance"
              value={primaryCandidate.minDistanceKm?.toFixed(2)}
              unit="km"
              mono
            />
            <ReportMetric
              label="Closest approach"
              value={primaryCandidate.timeOfClosestApproach
                ? new Date(primaryCandidate.timeOfClosestApproach).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
                : null}
              mono
            />
          </ReportMetricGrid>

          {/* Five-factor breakdown */}
          {primaryCandidate.factors && (
            <>
              <h3 className="report-subsection-title">Five-Factor Evidence Breakdown</h3>
              <ReportFigure
                title="Attribution Factor Scores"
                description={`Normalized factor scores for ${primaryCandidate.name ?? primaryCandidate.mmsi ?? 'primary candidate'}.`}
                provenance={attr.attributionModelVersion ?? 'Unknown model'}
              >
                <FactorBreakdownChart
                  factors={primaryCandidate.factors}
                  evidence={primaryCandidate.factorEvidence}
                  weights={attr.weightsUsed}
                  labels={FACTOR_LABELS}
                />
              </ReportFigure>
            </>
          )}

          {/* AIS data quality */}
          {primaryCandidate.dataQuality && (
            <>
              <h3 className="report-subsection-title">AIS Signal Quality</h3>
              <ReportMetricGrid columns={3}>
                <ReportMetric label="Reliability" value={primaryCandidate.dataQuality.reliability} />
                <ReportMetric label="Messages" value={primaryCandidate.dataQuality.messagesInWindow} mono />
                <ReportMetric label="Median cadence" value={primaryCandidate.dataQuality.medianCadenceMin?.toFixed(1)} unit="min" mono />
                <ReportMetric
                  label="Interpolated"
                  value={primaryCandidate.dataQuality.interpolationFraction != null
                    ? `${(primaryCandidate.dataQuality.interpolationFraction * 100).toFixed(0)}%`
                    : null}
                  mono
                />
                <ReportMetric label="Coverage gaps" value={primaryCandidate.dataQuality.coverageGaps} mono />
              </ReportMetricGrid>
              {primaryCandidate.dataQuality.notes.length > 0 && (
                <div className="report-aside">
                  <span className="report-aside__label">Notes</span>
                  <span className="report-aside__text">{primaryCandidate.dataQuality.notes.join('; ')}</span>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Full ranking table (all candidates) */}
      {attr.vessels.length > 1 && (
        <>
          <h3 className="report-subsection-title">Full Candidate Ranking</h3>
          <ReportTable
            columns={[
              { key: 'rank', label: '#', align: 'center', mono: true },
              { key: 'name', label: 'Vessel' },
              { key: 'mmsi', label: 'MMSI', mono: true },
              { key: 'score', label: 'Score', align: 'right', mono: true },
              { key: 'spatial', label: 'Spatial', align: 'right', mono: true },
              { key: 'temporal', label: 'Temporal', align: 'right', mono: true },
              { key: 'trajectory', label: 'Trajectory', align: 'right', mono: true },
              { key: 'anomaly', label: 'Anomaly', align: 'right', mono: true },
              { key: 'environmental', label: 'Environ.', align: 'right', mono: true },
            ]}
            rows={attr.vessels.map((v) => ({
              rank: v.rank,
              name: v.name ?? '—',
              mmsi: v.mmsi ?? '—',
              score: v.score != null ? `${(v.score * 100).toFixed(1)}%` : '—',
              spatial: v.factors?.spatial != null ? `${(v.factors.spatial * 100).toFixed(0)}` : '—',
              temporal: v.factors?.temporal != null ? `${(v.factors.temporal * 100).toFixed(0)}` : '—',
              trajectory: v.factors?.trajectory != null ? `${(v.factors.trajectory * 100).toFixed(0)}` : '—',
              anomaly: v.factors?.anomaly != null ? `${(v.factors.anomaly * 100).toFixed(0)}` : '—',
              environmental: v.factors?.environmental != null ? `${(v.factors.environmental * 100).toFixed(0)}` : '—',
            }))}
            caption="Complete candidate ranking with five-factor normalized scores."
          />
        </>
      )}

      {attr.weightsUsed && (
        <div className="report-env-source">
          <span className="report-env-source__label">Factor weights</span>
          <span className="report-env-source__note font-mono text-xs">
            {Object.entries(attr.weightsUsed).map(([k, w]) => `${k}: ${w.toFixed(2)}`).join(' · ')}
          </span>
        </div>
      )}
    </ReportSection>
  )
}

/**
 * Static SVG factor breakdown chart — works in both screen and print.
 */
function FactorBreakdownChart({
  factors,
  evidence,
  weights,
  labels,
}: {
  factors: Record<string, number>
  evidence: Record<string, { note?: string; weight?: number; [k: string]: unknown }> | null | undefined
  weights: Record<string, number> | null
  labels: Record<string, string>
}) {
  const entries = Object.entries(factors)
  const rowHeight = 36
  const labelWidth = 150
  const barMaxWidth = 220
  const svgHeight = entries.length * rowHeight + 10
  const svgWidth = labelWidth + barMaxWidth + 70

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="factor-breakdown-svg" aria-label="Five-factor attribution scores">
      <rect width={svgWidth} height={svgHeight} fill="var(--color-trench, #0B1118)" rx={3} />
      {entries.map(([key, score], i) => {
        const y = i * rowHeight + 8
        const barW = Math.max(2, score * barMaxWidth)
        const note = evidence?.[key]?.note
        const weightVal = weights?.[key]
        return (
          <g key={key}>
            <text
              x={labelWidth - 10}
              y={y + 12}
              textAnchor="end"
              fill="var(--color-mist, #B2BBC5)"
              fontSize={10}
              fontFamily="'Schibsted Grotesk Variable', sans-serif"
            >
              {labels[key] ?? key}
              {weightVal != null ? ` (${(weightVal * 100).toFixed(0)}%)` : ''}
            </text>
            <rect
              x={labelWidth}
              y={y + 2}
              width={barW}
              height={14}
              fill="#0057FF"
              opacity={0.7 + score * 0.3}
              rx={2}
            />
            <text
              x={labelWidth + barW + 6}
              y={y + 13}
              fill="var(--color-porcelain, #F8F7F4)"
              fontSize={10}
              fontFamily="'JetBrains Mono Variable', monospace"
            >
              {(score * 100).toFixed(0)}%
            </text>
            {note && (
              <text
                x={labelWidth}
                y={y + 25}
                fill="var(--color-dim, #727D89)"
                fontSize={8}
                fontFamily="'Schibsted Grotesk Variable', sans-serif"
              >
                {note.length > 55 ? `${note.slice(0, 55)}…` : note}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
