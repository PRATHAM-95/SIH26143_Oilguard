import type { ReactNode } from 'react'
import { useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { ProvenancePill, RankBadge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'
import type { AttributionFactorKey, AttributionVesselEntry } from '@/types/domain'

const FACTOR_LABEL: Record<string, string> = {
  spatial: 'Spatial',
  temporal: 'Temporal',
  trajectory: 'Trajectory',
  anomaly: 'Anomaly',
  environmental: 'Environmental',
}

function tca(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(11, 16)}Z`
}

function CandidateRow({ v }: { v: AttributionVesselEntry }) {
  const top = v.rank === 1
  const factorEntries = v.factors
    ? (Object.entries(v.factors) as [AttributionFactorKey, number][])
        .filter(([, value]) => typeof value === 'number')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : []
  const reliability = v.dataQuality?.reliability ?? null
  const reliabilityTone = !reliability
    ? undefined
    : reliability === 'HIGH'
      ? 'chip--ok'
      : reliability === 'MEDIUM'
        ? 'chip--warn'
        : 'chip--danger'

  return (
    <div className={`cand${top ? ' cand--top' : ''}`}>
      <span className={`cand-rank${v.rank === 2 ? ' cand-rank--2' : v.rank >= 3 ? ' cand-rank--3' : ''}`}>
        #{v.rank}
      </span>
      <div className="cand-body">
        <div className="cand-title">
          <span className="cand-name">{v.name ?? 'Vessel'}</span>
          {top ? (
            <span className="cand-flag" title="Highest-ranked — not yet a confirmed culprit">
              top candidate
            </span>
          ) : null}
        </div>
        <div className="cand-mmsi">
          {v.mmsi ?? '—'} · {v.vesselType ?? 'type n/a'}
        </div>
        <div className="cand-meta">
          <span>
            dist <b>{v.minDistanceKm != null ? `${v.minDistanceKm.toFixed(1)} km` : '—'}</b>
          </span>
          <span>
            TCA <b>{tca(v.timeOfClosestApproach)}</b>
          </span>
          {v.rank === 1 ? OptionalReliabilityChip(reliability, reliabilityTone) : null}
        </div>
        <div className="cand-score">
          <span className="score-track" aria-hidden="true">
            <span
              className={`score-fill${top ? '' : ' score-fill--dim'}`}
              style={{ width: `${v.score != null ? Math.max(0, Math.min(1, v.score)) * 100 : 0}%` }}
            />
          </span>
          <span className="cand-score-pct">
            {v.score != null ? `${(v.score * 100).toFixed(0)}%` : '—'}
          </span>
        </div>
        {factorEntries.length > 0 ? (
          <div className="cand-factors">
            {factorEntries.map(([k, value]) => (
              <span className="chip chip--faint" key={k}>
                {FACTOR_LABEL[k] ?? k} {(value * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function OptionalReliabilityChip(reliability: string | null, tone?: string): ReactNode {
  return <span className={`chip ${tone ?? 'chip--faint'}`}>q {reliability ?? '—'}</span>
}

/**
 * Right-rail candidate ranking + verdict. Attribution results are rankings —
 * the verdict never over-claims ("not yet a confirmed culprit").
 */
export function CandidateRail() {
  const status = useAttributionStore((s) => s.status)
  const vessels = useAttributionStore((s) => s.vessels)
  const conclusion = useAttributionStore((s) => s.conclusion)
  const ranking = useAttributionStore((s) => s.ranking)
  const aisSource = useAttributionStore((s) => s.aisSource)
  const radiusKm = useAttributionStore((s) => s.radiusKm)
  const errors = useAttributionStore((s) => s.errors)
  const warnings = useAttributionStore((s) => s.warnings)
  const busy = useAttributionStore((s) => s.busy)
  const invStatus = useInvestigationStore((s) => s.status)
  const retry = useInvestigationStore((s) => s.retry)

  if (status !== 'completed' && status !== 'failed') {
    const running = status === 'running' || busy
    return (
      <div className="cand-empty">
        {running ? (
          <>
            <b style={{ color: 'var(--accent-strong)' }}>Ranking vessels…</b>
            <br />
            AIS search + factor scoring are live — candidates drop in as scores land.
          </>
        ) : invStatus === 'COMPLETED' ? (
          <>
            <b>Ranking produced no candidates.</b>
            <br />
            No vessel matched the source region within the search window. Nothing is fabricated —
            there is simply no candidate to rank.
          </>
        ) : (
          <>
            <b>No candidate ranking yet.</b>
            <br />
            Run the challenge (or start the investigation) to fill AIS <em style={{ fontStyle: 'normal' }}>→</em>{' '}
            backtracking <em style={{ fontStyle: 'normal' }}>→</em> attribution.
          </>
        )}
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="cand-empty" style={{ color: 'var(--danger)' }}>
        <b>Attribution failed.</b>
        <br />
        {errors[0] ?? 'See the stage ledger for detail.'}
        <div style={{ marginTop: 8 }}>
          <Button onClick={() => void retry('attribution')}>Retry attribution</Button>
        </div>
      </div>
    )
  }

  const top = vessels[0] ?? null
  const marginPct = ranking?.margin != null ? ranking.margin * 100 : null
  const topScorePct = ranking?.top_score != null ? ranking.top_score * 100 : null

  return (
    <>
      <div className="cc-cand-list" aria-label="Ranked candidate vessels">
        {vessels.slice(0, 5).map((v) => (
          <CandidateRow key={v.mmsi ?? v.rank} v={v} />
        ))}
      </div>

      {conclusion === 'candidate' && top ? (
        <div className="verdict" aria-label="Attribution verdict">
          <div className="verdict-eyebrow">
            <RankBadge rank={top.rank} /> Attributed vessel
          </div>
          <div className="verdict-line">
            {top.name ?? 'Vessel'} <em>(score {topScorePct != null ? `${topScorePct.toFixed(1)}%` : '—'})</em>
          </div>
          <div className="verdict-line" style={{ fontWeight: 500 }}>
            Highest-ranked candidate — not yet a confirmed culprit.
          </div>
          <div className="verdict-sub">
            Scores combine spatial, temporal, trajectory, anomaly and environmental factors; the
            ranking is for adjudication, not proof.
          </div>
          <div className="verdict-metrics">
            <div>
              <div className="verdict-metric-label">Top score</div>
              <div className="verdict-metric-value">{topScorePct != null ? `${topScorePct.toFixed(1)}%` : '—'}</div>
            </div>
            <div>
              <div className="verdict-metric-label">Margin</div>
              <div className={`verdict-metric-value${ranking?.decisive ? '' : ' verdict-metric-value--warn'}`}>
                {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="verdict-metric-label">Decisive</div>
              <div className="verdict-metric-value">{ranking?.decisive ? 'YES' : 'NO'}</div>
            </div>
          </div>
          {warnings.length > 0 ? (
            <div className="verdict-sub" style={{ marginTop: 8, color: 'var(--warn)' }}>
              {warnings.join(' · ')}
            </div>
          ) : null}
        </div>
      ) : conclusion === 'inconclusive' ? (
        <div className="verdict">
          <div className="verdict-eyebrow">Attribution</div>
          <div className="verdict-line">Investigation inconclusive — no decisive candidate.</div>
          <div className="verdict-sub">The spread between candidates was too narrow to separate a source vessel with confidence.</div>
          {marginPct != null ? (
            <div className="verdict-metrics">
              <div>
                <div className="verdict-metric-label">Top score</div>
                <div className="verdict-metric-value">{topScorePct?.toFixed(1)}%</div>
              </div>
              <div>
                <div className="verdict-metric-label">Margin</div>
                <div className="verdict-metric-value verdict-metric-value--warn">{marginPct.toFixed(1)}%</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cc-prov-footer">
        <div className="cc-prov-row">
          AIS source <ProvenancePill value={aisSource} />
        </div>
        <div className="cc-prov-row">
          Search radius <b>{radiusKm != null ? `${radiusKm} km` : '—'}</b>
        </div>
        <div className="cc-prov-row" style={{ color: 'var(--ink-3)' }}>
          Presented for adjudication — not proof
        </div>
      </div>
    </>
  )
}