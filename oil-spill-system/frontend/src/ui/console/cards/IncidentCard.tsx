import { useIncidentStore } from '@/store/incidentStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { Button } from '@/components/ui/Button'

export function IncidentCard() {
  const incident = useIncidentStore((s) => s)
  const spill = useSimulationStore((s) => s.spill)
  const invStatus = useInvestigationStore((s) => s.status)
  const start = useInvestigationStore((s) => s.start)
  const busy = useInvestigationStore((s) => s.busy)

  const hasIncident = incident.status !== 'none' || spill?.incidentId != null
  const hasConfidence = incident.detectionConfidence != null
  const confidencePct = hasConfidence ? Math.round(incident.detectionConfidence! * 100) : null

  const canStart = !!spill?.incidentId && invStatus !== 'RUNNING' && invStatus !== 'CREATED' && !busy

  return (
    <div className="ctx-card ctx-card--incident" role="region" aria-label="Incident Overview">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className={`ctx-dot ${hasIncident ? 'ctx-dot--warn' : 'ctx-dot--idle'}`} aria-hidden="true" />
          <h3 className="ctx-card-title">INCIDENT ANOMALY BRIEF</h3>
        </div>
        <span className={`ctx-badge ${hasIncident ? 'ctx-badge--warn' : 'ctx-badge--idle'}`}>
          {incident.status === 'none' ? (spill?.incidentId ? 'DETECTED' : 'STANDBY') : incident.status}
        </span>
      </div>

      <div className="ctx-card-body">
        {hasIncident ? (
          <div className="ctx-telemetry-grid">
            <div className="ctx-field">
              <span className="ctx-label">ANOMALY CLASSIFICATION</span>
              <span className="ctx-val ctx-val--bold">
                {incident.observation || 'Awaiting classification'}
              </span>
            </div>

            <div className="ctx-field">
              <span className="ctx-label">COORDINATES</span>
              <span className="ctx-val ctx-val--mono">
                {incident.location
                  ? `${incident.location.lat.toFixed(4)}°N, ${incident.location.lon.toFixed(4)}°E`
                  : spill?.location
                    ? `${spill.location.lat.toFixed(4)}°N, ${spill.location.lon.toFixed(4)}°E`
                    : 'No data'}
              </span>
            </div>

            <div className="ctx-field">
              <span className="ctx-label">ESTIMATED DISCHARGE</span>
              <span className="ctx-val ctx-val--mono">
                {spill?.quantityKg != null
                  ? `${spill.quantityKg.toLocaleString()} kg · ${spill.oilType ?? 'Unknown type'}`
                  : 'No data'}
              </span>
            </div>

            <div className="ctx-field ctx-field--meter">
              <div className="meter-label-row">
                <span className="ctx-label">DETECTION CONFIDENCE</span>
                <span className="meter-score">{hasConfidence ? `${confidencePct}%` : 'No data'}</span>
              </div>
              <div
                className="meter-track"
                role="progressbar"
                aria-label="Detection confidence score"
                aria-valuenow={confidencePct ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="meter-fill meter-fill--ok" style={{ width: `${confidencePct ?? 0}%` }} />
              </div>
            </div>

            {canStart ? (
              <div className="ctx-action-box">
                <Button
                  variant="primary"
                  size="sm"
                  block
                  onClick={() => spill.incidentId && void start(spill.incidentId)}
                >
                  Launch Forensic Investigation
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ctx-empty-state">
            <p className="ctx-empty-title">Awaiting Incident Detection</p>
            <p className="ctx-empty-hint">
              Launch a scenario or start live challenge to simulate maritime radar detection.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
