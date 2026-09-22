import { useSarStore } from '@/store/sarStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useMapStore } from '@/store/mapStore'
import { Button } from '@/components/ui/Button'

export function DetectionCard() {
  const sar = useSarStore((s) => s)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const setLayer = useMapStore((s) => s.setLayer)
  const showSlicks = useMapStore((s) => s.visibility.sarSlicks)

  const busy = sar.busy || sar.status === 'processing'

  const handleRunSar = () => {
    if (!simulationId) return
    void useSarStore.getState().detect(simulationId, 'LOCAL_FIXTURE')
  }

  const handleToggleLayers = () => {
    const next = !showSlicks
    setLayer('sarSlicks', next)
    setLayer('sarFootprint', next)
  }

  return (
    <div className="ctx-card ctx-card--detection" role="region" aria-label="SAR Satellite Detection">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className={`ctx-dot ${sar.candidates.length > 0 ? 'ctx-dot--live' : 'ctx-dot--idle'}`} aria-hidden="true" />
          <h3 className="ctx-card-title">SATELLITE SAR RADAR</h3>
        </div>
      </div>

      <div className="ctx-card-body">
        <div className="ctx-telemetry-grid">
          <div className="ctx-field">
            <span className="ctx-label">SCENE IDENTIFIER</span>
            <span className="ctx-val ctx-val--mono">
              {sar.sceneId ? sar.sceneId.slice(0, 20) + '…' : 'No SAR scene acquired'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">DETECTION ALGORITHM</span>
            <span className="ctx-val">
              {sar.detector ?? 'Awaiting acquisition'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">CANDIDATE SLICKS</span>
            <span className="ctx-val ctx-val--highlight">
              {sar.candidates.length > 0
                ? `${sar.candidates.length} features detected${sar.slickAreaKm2 != null ? ` (${sar.slickAreaKm2.toFixed(1)} km²)` : ''}`
                : busy
                  ? 'Processing radar backscatter…'
                  : 'Awaiting acquisition'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">RADAR PROVENANCE</span>
            <span className="ctx-val ctx-val--mono">
              {sar.provenance
                ? sar.provenance === 'LOCAL_FIXTURE'
                  ? 'LOCAL FIXTURE (Controlled)'
                  : sar.provenance
                : 'Awaiting acquisition'}
            </span>
          </div>

          {sar.acquisitionTime ? (
            <div className="ctx-field">
              <span className="ctx-label">ACQUISITION TIME</span>
              <span className="ctx-val ctx-val--mono">
                {sar.acquisitionTime.slice(0, 19).replace('T', ' ')}Z
              </span>
            </div>
          ) : null}

          <div className="ctx-action-group">
            <Button
              size="sm"
              variant="secondary"
              block
              disabled={!simulationId || busy}
              onClick={handleRunSar}
            >
              {busy ? 'Processing Radar Backscatter…' : sar.candidates.length > 0 ? 'Re-run CFAR Detection' : 'Run SAR Detection'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              block
              onClick={handleToggleLayers}
            >
              {showSlicks ? 'Hide Radar Overlays' : 'Show Radar Overlays'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
