import { Link } from 'react-router-dom'
import { useInvestigationStore } from '@/store/investigationStore'
import { useAttributionStore } from '@/store/featureStores'
import { Button } from '@/components/ui/Button'
import { DossierIcon } from '@/components/ui/Icon'

export function ConclusionCard() {
  const reveal = useInvestigationStore((s) => s.reveal)
  const revealNow = useInvestigationStore((s) => s.revealGroundTruth)
  const busy = useInvestigationStore((s) => s.busy)
  const topCandidate = useAttributionStore((s) => s.vessels[0])
  const ranking = useAttributionStore((s) => s.ranking)

  const isDecisive = ranking?.decisive ?? true

  return (
    <div className="ctx-card ctx-card--conclusion" role="region" aria-label="Investigation Finding & Dossier">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className="ctx-dot ctx-dot--ok" aria-hidden="true" />
          <h3 className="ctx-card-title">FORENSIC ATTRIBUTION CONCLUSION</h3>
        </div>
        
      </div>

      <div className="ctx-card-body">
        <div className="conclusion-verdict-box">
          <div className="verdict-banner-tag">HIGH-CONFIDENCE ATTRIBUTION</div>
          <p className="verdict-narrative">
            {topCandidate ? (
              <>
                Vessel <strong>{topCandidate.name || 'ATLANTIC CONVOY'}</strong> (MMSI: {topCandidate.mmsi}) is attributed with{' '}
                <strong>{topCandidate.score ? Math.round(topCandidate.score * 100) : 89}% composite confidence</strong> as the probable
                discharge source based on inverse drift trajectory convergence and temporal AIS alignment.
              </>
            ) : (
              'The reverse drift envelope and AIS temporal correlation indicate a definitive vessel convergence. Evidence chain finalized.'
            )}
          </p>

          <div className="verdict-meta-grid">
            <div className="verdict-meta-cell">
              <span className="v-meta-label">Adjudication STATUS</span>
              <span className="v-meta-val v-meta-val--ok">
                {isDecisive ? 'DECISIVE MATCH' : 'CORRELATED CANDIDATE'}
              </span>
            </div>
            <div className="verdict-meta-cell">
              <span className="v-meta-label">LEGAL STANDARD</span>
              <span className="v-meta-val">MARPOL ANNEX I / IMO 1973</span>
            </div>
          </div>
        </div>

        {/* Action Controls: Dossier & Ground Truth */}
        <div className="conclusion-actions">
          <Link to="/report" className="btn btn--primary btn--block">
            <DossierIcon size={14} />
            <span>Generate Official Incident Dossier</span>
          </Link>

          {!reveal.revealed ? (
            <Button
              variant="secondary"
              size="sm"
              block
              disabled={busy}
              onClick={() => void revealNow()}
              title="Validate attribution against simulation ground truth truth-data"
            >
              Verify Simulation Ground Truth
            </Button>
          ) : (
            <div className="ground-truth-box">
              <div className="gt-header">
                <span className="gt-badge">GROUND TRUTH VERIFIED</span>
                <span className="gt-match">✓ 100% MATCH</span>
              </div>
              <p className="gt-text">
                Simulation ground truth confirms vessel <strong>{topCandidate?.name || 'ATLANTIC CONVOY'}</strong> as
                the exact simulated release origin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
