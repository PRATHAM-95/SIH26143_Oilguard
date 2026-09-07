import { useBacktrackingStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { ProvenancePill } from '@/components/ui/primitives'
import { Button } from '@/components/ui/Button'

function dms(lat: number, lon: number): { lat: string; latDir: 'N' | 'S'; lon: string; lonDir: 'E' | 'W' } {
  return {
    lat: Math.abs(lat).toFixed(2),
    latDir: lat >= 0 ? 'N' : 'S',
    lon: Math.abs(lon).toFixed(2),
    lonDir: lon >= 0 ? 'E' : 'W',
  }
}

function hhmm(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const hm = d.toISOString().slice(11, 16)
  return `${day} ${hm}Z`
}

function qualityChip(q: 'HIGH' | 'MEDIUM' | 'LOW' | null | undefined) {
  if (!q) return <span className="chip chip--faint">quality —</span>
  const tone = q === 'HIGH' ? 'chip--ok' : q === 'MEDIUM' ? 'chip--warn' : 'chip--danger'
  return <span className={`chip ${tone}`}>quality {q}</span>
}

/**
 * Source-region hero card, overlaid top-left of the map. Reads the live
 * backtracking store; keeps the honesty wording "a region, not a single
 * point" whenever a region is present.
 */
export function SourceHero() {
  const status = useBacktrackingStore((s) => s.status)
  const origin = useBacktrackingStore((s) => s.origin)
  const uncertaintyKm = useBacktrackingStore((s) => s.uncertaintyKm)
  const originTimeRange = useBacktrackingStore((s) => s.originTimeRange)
  const environmentalQuality = useBacktrackingStore((s) => s.environmentalQuality)
  const ensembleSummary = useBacktrackingStore((s) => s.ensembleSummary)
  const environmentSource = useBacktrackingStore((s) => s.environmentSource)
  const trajectoryAgreement = useBacktrackingStore((s) => s.trajectoryAgreement)
  const sourceConcentration = useBacktrackingStore((s) => s.sourceConcentration)
  const warnings = useBacktrackingStore((s) => s.warnings)
  const errors = useBacktrackingStore((s) => s.errors)
  const retry = useInvestigationStore((s) => s.retry)

  if (status === 'idle' || status === 'running') {
    return (
      <div className="cc-glass cc-source-hero">
        <div className="cc-hero-head">
          <span className="cc-hero-eyebrow">
            <span className="cc-prov-dot" aria-hidden="true" />
            Source analysis
          </span>
        </div>
        <div className="cc-hero-state">
          <span className={status === 'running' ? 'cc-loader' : ''}>
            {status === 'running' ? 'Backtracking ensemble in progress…' : 'Awaiting backtracking.'}
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
            Ensemble backward trajectories animate into the map when the stage completes.
          </span>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="cc-glass cc-source-hero">
        <div className="cc-hero-head">
          <span className="cc-hero-eyebrow">
            <span className="cc-prov-dot" aria-hidden="true" />
            Source analysis
          </span>
        </div>
        <div className="cc-hero-state">
          <span style={{ color: 'var(--danger)' }}>
            Backtracking failed{errors[0] ? ` — ${errors[0]}` : '.'}
          </span>
          <Button onClick={() => void retry('backtracking')}>Retry backtracking</Button>
        </div>
      </div>
    )
  }

  if (!origin) {
    return (
      <div className="cc-glass cc-source-hero">
        <div className="cc-hero-head">
          <span className="cc-hero-eyebrow">
            <span className="cc-prov-dot" aria-hidden="true" />
            Source analysis
          </span>
        </div>
        <div className="cc-hero-state">
          <span>Backtracking completed without an origin estimate.</span>
          {warnings.length > 0 ? (
            <span style={{ fontSize: 9.5, color: 'var(--warn)' }}>{warnings.join(' · ')}</span>
          ) : null}
        </div>
      </div>
    )
  }

  const pos = dms(origin.lat, origin.lon)

  return (
    <div className="cc-glass cc-source-hero">
      <div className="cc-hero-head">
        <span className="cc-hero-eyebrow">
          <span className="cc-prov-dot" aria-hidden="true" />
          Source region
        </span>
        {qualityChip(environmentalQuality)}
      </div>

      <div className="cc-hero-body">
        <div className="cc-hero-coord">
          <span>
            {pos.lat}<span className="c-dir">{pos.latDir}</span>
          </span>
          <span>
            {pos.lon}<span className="c-dir">{pos.lonDir}</span>
          </span>
          <span className="c-sub">est. origin</span>
        </div>

        <div className="cc-hero-uncert">
          <b>± {uncertaintyKm != null ? `${uncertaintyKm.toFixed(1)} km` : 'n/a'}</b>
          <span> uncertainty — a region, not a single point</span>
        </div>

        <div className="cc-hero-grid">
          <div>
            <div className="cc-hero-lbl">Earliest</div>
            <div className="cc-hero-val">{hhmm(originTimeRange?.earliest)}</div>
          </div>
          <div>
            <div className="cc-hero-lbl">Preferred</div>
            <div className="cc-hero-val">{hhmm(originTimeRange?.preferred)}</div>
          </div>
          <div>
            <div className="cc-hero-lbl">Latest</div>
            <div className="cc-hero-val">{hhmm(originTimeRange?.latest)}</div>
          </div>
          <div>
            <div className="cc-hero-lbl">Ensemble</div>
            <div className="cc-hero-val">
              {ensembleSummary ? `${ensembleSummary.converged_count}/${ensembleSummary.member_count} converged` : '—'}
            </div>
          </div>
          <div>
            <div className="cc-hero-lbl">Agreement</div>
            <div className="cc-hero-val">
              {trajectoryAgreement != null ? `${(trajectoryAgreement * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="cc-hero-lbl">Concentration</div>
            <div className="cc-hero-val">{sourceConcentration ?? '—'}</div>
          </div>
        </div>

        <div className="cc-hero-note">
          <span className="n-mark">◉</span>
          <span>
            The probable source is a region bounded by the uncertainty radius — not a single
            point on the water.
          </span>
        </div>
      </div>

      <div className="cc-hero-foot">
        <ProvenancePill value={environmentSource ?? 'UNAVAILABLE'} />
        {uncertaintyKm != null ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-2)' }}>
            ±{uncertaintyKm.toFixed(1)} km
          </span>
        ) : null}
      </div>
    </div>
  )
}