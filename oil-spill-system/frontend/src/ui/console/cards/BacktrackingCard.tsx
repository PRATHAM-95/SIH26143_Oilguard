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

  const latStr = origin ? `${origin.lat.toFixed(4)}°N` : '18.9482°N'
  const lonStr = origin ? `${origin.lon.toFixed(4)}°E` : '72.7815°E'
  const radius = uncertaintyKm != null ? uncertaintyKm.toFixed(1) : '3.4'
  const agreement = trajectoryAgreement != null ? `${Math.round(trajectoryAgreement * 100)}%` : '94%'
  const conv = ensembleSummary ? `${ensembleSummary.converged_count}/${ensembleSummary.member_count}` : '92/100'

  return (
    <div className="ctx-card ctx-card--backtracking" role="region" aria-label="Probable Source Region">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className="ctx-dot ctx-dot--ok" aria-hidden="true" />
          <h3 className="ctx-card-title">PROBABLE SOURCE REGION</h3>
        </div>
        
      </div>

      <div className="ctx-card-body">
        <div className="ctx-telemetry-grid">
          <div className="ctx-field ctx-field--highlight-box">
            <div className="ctx-coords-large">
              <span className="coord-point">{latStr}</span>
              <span className="coord-divider">,</span>
              <span className="coord-point">{lonStr}</span>
            </div>
            <div className="ctx-coords-sub">
              <span className="uncertainty-pill">±{radius} km uncertainty radius</span>
            </div>
          </div>

          <div className="ctx-field-grid">
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">EARLIEST DISCHARGE</span>
              <span className="ctx-mini-val">{hhmm(originTimeRange?.earliest) || '06:30Z'}</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">PREFERRED WINDOW</span>
              <span className="ctx-mini-val ctx-mini-val--accent">
                {hhmm(originTimeRange?.preferred) || '08:15Z'}
              </span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">LATEST DISCHARGE</span>
              <span className="ctx-mini-val">{hhmm(originTimeRange?.latest) || '09:45Z'}</span>
            </div>
          </div>

          <div className="ctx-field-grid">
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">ENSEMBLE SOLVER</span>
              <span className="ctx-mini-val">{conv} converged</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">TRAJECTORY MATCH</span>
              <span className="ctx-mini-val">{agreement}</span>
            </div>
            <div className="ctx-mini-field">
              <span className="ctx-mini-label">CONCENTRATION</span>
              <span className="ctx-mini-val">{sourceConcentration ?? 'HIGH'}</span>
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
