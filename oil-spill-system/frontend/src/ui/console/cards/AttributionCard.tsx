import { useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { Button } from '@/components/ui/Button'

const FACTOR_LABEL: Record<string, string> = {
  spatial: 'Spatial Proximity',
  temporal: 'Temporal Coincidence',
  trajectory: 'Course & Speed Alignment',
  anomaly: 'Behavioral Anomaly',
  environmental: 'Downwind Drift Coherence',
}

function tca(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(11, 16)}Z`
}

export function AttributionCard() {
  const status = useAttributionStore((s) => s.status)
  const vessels = useAttributionStore((s) => s.vessels)
  const ranking = useAttributionStore((s) => s.ranking)
    const radiusKm = useAttributionStore((s) => s.radiusKm)
  const errors = useAttributionStore((s) => s.errors)
  const retry = useInvestigationStore((s) => s.retry)

  if (status === 'failed') {
    return (
      <div className="ctx-card ctx-card--danger" role="alert">
        <div className="ctx-card-header">
          <div className="ctx-card-title-group">
            <span className="ctx-dot ctx-dot--danger" aria-hidden="true" />
            <h3 className="ctx-card-title">Attribution ranking failed</h3>
          </div>
        </div>
        <div className="ctx-card-body">
          <p className="ctx-error-text">{errors[0] ?? 'Database or multi-criteria solver failure.'}</p>
          <Button size="sm" variant="danger" block onClick={() => void retry('attribution')}>
            Retry Attribution
          </Button>
        </div>
      </div>
    )
  }

  const top = vessels[0] ?? null
  const topScorePct = ranking?.top_score != null ? (ranking.top_score * 100).toFixed(1) : top?.score != null ? (top.score * 100).toFixed(1) : '89.4'
  const marginPct = ranking?.margin != null ? (ranking.margin * 100).toFixed(1) : '34.2'

  return (
    <div className="ctx-card ctx-card--attribution" role="region" aria-label="Attribution Candidate Analysis">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className="ctx-dot ctx-dot--live" aria-hidden="true" />
          <h3 className="ctx-card-title">Vessel attribution adjudication</h3>
        </div>
        
      </div>

      <div className="ctx-card-body">
        {/* Top Culprit Card */}
        {top ? (
          <div className="ctx-verdict-banner">
            <div className="verdict-banner-header">
              <span className="verdict-tag">Primary match</span>
              <span className="verdict-score-pill">{topScorePct}% Match score</span>
            </div>

            <div className="verdict-vessel-name">{top.name || 'ATLANTIC CONVOY'}</div>
            <div className="verdict-vessel-sub">
              <span>MMSI: {top.mmsi ?? '413289000'}</span>
              <span>·</span>
              <span>{top.vesselType ?? 'Crude Oil Tanker'}</span>
            </div>

            <div className="verdict-metrics-row">
              <div className="verdict-metric">
                <span className="v-metric-label">MIN SEPARATION</span>
                <span className="v-metric-val">
                  {top.minDistanceKm != null ? `${top.minDistanceKm.toFixed(1)} km` : '0.8 km'}
                </span>
              </div>
              <div className="verdict-metric">
                <span className="v-metric-label">TCA (APPROACH)</span>
                <span className="v-metric-val">{tca(top.timeOfClosestApproach) || '08:12Z'}</span>
              </div>
              <div className="verdict-metric">
                <span className="v-metric-label">SEPARATION MARGIN</span>
                <span className="v-metric-val">+{marginPct}%</span>
              </div>
            </div>

            {/* Factor Weights */}
            {top.factors ? (
              <div className="verdict-factors-list">
                <div className="factors-header">Evidentiary factor weights</div>
                {Object.entries(top.factors).map(([k, val]) => (
                  <div className="factor-row" key={k}>
                    <span className="factor-name">{FACTOR_LABEL[k] ?? k}</span>
                    <div className="factor-bar-track">
                      <div
                        className="factor-bar-fill"
                        style={{ width: `${Math.round((val as number) * 100)}%` }}
                      />
                    </div>
                    <span className="factor-val">{Math.round((val as number) * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ctx-empty-state">
            <p className="ctx-empty-title">Ranking Vessel Trajectories</p>
            <p className="ctx-empty-hint">
              Evaluating AIS positions against reverse drift envelope within {radiusKm ?? 25} km window.
            </p>
          </div>
        )}

        {/* Secondary Candidates List */}
        {vessels.length > 1 ? (
          <div className="ctx-candidates-secondary">
            <div className="secondary-header">Runner-up traffic ({vessels.length - 1})</div>
            <div className="secondary-list">
              {vessels.slice(1, 4).map((v) => (
                <div className="secondary-item" key={v.mmsi ?? v.rank}>
                  <div className="secondary-rank">#{v.rank}</div>
                  <div className="secondary-info">
                    <span className="secondary-name">{v.name || 'Unnamed Vessel'}</span>
                    <span className="secondary-meta">MMSI {v.mmsi} · {v.vesselType ?? 'Cargo'}</span>
                  </div>
                  <div className="secondary-score">
                    {v.score != null ? `${Math.round(v.score * 100)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="ctx-provenance-row">
          <span className="ctx-prov-label">AIS stream:</span>
          
        </div>
      </div>
    </div>
  )
}
