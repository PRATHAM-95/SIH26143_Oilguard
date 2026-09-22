import { useBacktrackingStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { Button } from '@/components/ui/Button'

function hhmm(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const hm = d.toISOString().slice(11, 16)
  return `${day} ${hm}Z`
}

export function BacktrackingCard() {
  const status = useBacktrackingStore((s) => s.status)
  const origin = useBacktrackingStore((s) => s.origin)
  const uncertaintyKm = useBacktrackingStore((s) => s.uncertaintyKm)
  const originTimeRange = useBacktrackingStore((s) => s.originTimeRange)
    const ensembleSummary = useBacktrackingStore((s) => s.ensembleSummary)
    const trajectoryAgreement = useBacktrackingStore((s) => s.trajectoryAgreement)
  const sourceConcentration = useBacktrackingStore((s) => s.sourceConcentration)
  const errors = useBacktrackingStore((s) => s.errors)
  const retry = useInvestigationStore((s) => s.retry)

  if (status === 'failed') {
    return (
      <div className="ctx-card ctx-card--danger" role="alert">
        <div className="ctx-card-header">
          <div className="ctx-card-title-group">
            <span className="ctx-dot ctx-dot--danger" aria-hidden="true" />
            <h3 className="ctx-card-title">SOURCE Backtracking failed</h3>
          </div>
        </div>
        <div className="ctx-card-body">
          <p className="ctx-error-text">{errors[0] ?? 'Inverse Lagrangian solver failed to converge.'}</p>
          <Button variant="danger" size="sm" block onClick={() => void retry('backtracking')}>
            Retry Backtracking Solver
          </Button>
        </div>
      </div>
    )
  }

  const latStr = origin ? `${Math.abs(origin.lat).toFixed(4)}°${origin.lat >= 0 ? 'N' : 'S'}` : null
  const lonStr = origin ? `${Math.abs(origin.lon).toFixed(4)}°${origin.lon >= 0 ? 'E' : 'W'}` : null
  const radius = uncertaintyKm != null ? uncertaintyKm.toFixed(1) : null
  const agreement = trajectoryAgreement != null ? `${Math.round(trajectoryAgreement * 100)}%` : '—'
  const conv = ensembleSummary ? `${ensembleSummary.converged_count}/${ensembleSummary.member_count}` : null

  return (
    <div className="ctx-card ctx-card--backtracking" role="region" aria-label="Probable Source Region">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className={`ctx-dot ${origin ? 'ctx-dot--ok' : 'ctx-dot--idle'}`} aria-hidden="true" />
          <h3 className="ctx-card-title">PROBABLE SOURCE REGION</h3>
        </div>
      </div>

      <div className="ctx-card-body">
        <div className="ctx-telemetry-grid">
          <div className="ctx-field ctx-field--highlight-box">
            <div className="ctx-coords-large">
              {origin ? (
                <>
                  <span className="coord-point">{latStr}</span>
                  <span className="coord-divider">,</span>
                  <span className="coord-point">{lonStr}</span>
                </>
              ) : (
                <span className="coord-point text-ink-3">Not yet calculated</span>
              )}
            </div>
            <div className="ctx-coords-sub">
              <span className="uncertainty-pill">
                {radius != null ? `±${radius} km uncertainty radius` : 'Uncertainty: Not yet calculated'}
              </span>
            </div>
          </div>

          <div className="ctx-field-grid">
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">EARLIEST DISCHARGE</span>
              <span className="ctx-mini-val">{originTimeRange?.earliest ? hhmm(originTimeRange.earliest) : '—'}</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">PREFERRED WINDOW</span>
              <span className="ctx-mini-val ctx-mini-val--accent">
                {originTimeRange?.preferred ? hhmm(originTimeRange.preferred) : '—'}
              </span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">LATEST DISCHARGE</span>
              <span className="ctx-mini-val">{originTimeRange?.latest ? hhmm(originTimeRange.latest) : '—'}</span>
            </div>
          </div>

          <div className="ctx-field-grid">
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">ENSEMBLE SOLVER</span>
              <span className="ctx-mini-val">{conv ? `${conv} converged` : 'Not yet calculated'}</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">TRAJECTORY MATCH</span>
              <span className="ctx-mini-val">{agreement}</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">CONCENTRATION</span>
              <span className="ctx-mini-val">{sourceConcentration ?? '—'}</span>
            </div>
          </div>

          <div className="ctx-note-box">
            <span className="ctx-note-icon" aria-hidden="true">⊙</span>
            <span>
              Probable source represents a bounded reverse-dispersal probability envelope calculated via Monte Carlo reverse drift.
            </span>
          </div>

          <div className="ctx-provenance-row">
            <span className="ctx-prov-label">MODEL PROVENANCE:</span>
            
          </div>
        </div>
      </div>
    </div>
  )
}
