import { useEnvironmentStore } from '@/store/environmentStore'
import { useSimulationStore } from '@/store/simulationStore'

export function EnvironmentDriftCard() {
  const current = useEnvironmentStore((s) => s.current)
  const wind = useEnvironmentStore((s) => s.wind)
  const drift = useSimulationStore((s) => s.drift)

  const particleCount =
    drift.particles && drift.particles.length > 0
      ? drift.particles.length
      : drift.particleCount != null && drift.particleCount > 0
        ? drift.particleCount
        : null

  const extentKm2 =
    drift.extent && drift.extent.length > 0
      ? (drift.extent.length * 1.4).toFixed(1)
      : null

  const windValue =
    wind.status === 'available'
      ? (wind.note || wind.label || 'Available')
      : wind.status === 'awaiting'
        ? 'Awaiting acquisition'
        : 'Unavailable'

  const currentValue =
    current.status === 'available'
      ? (current.note || current.label || 'Available')
      : current.status === 'awaiting'
        ? 'Awaiting acquisition'
        : 'Unavailable'

  return (
    <div className="ctx-card ctx-card--environment" role="region" aria-label="Environmental Forcing & Drift">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className={`ctx-dot ${wind.status === 'available' || current.status === 'available' ? 'ctx-dot--live' : 'ctx-dot--idle'}`} aria-hidden="true" />
          <h3 className="ctx-card-title">Environment & forward drift</h3>
        </div>
      </div>

      <div className="ctx-card-body">
        <div className="ctx-telemetry-grid">
          <div className="ctx-field">
            <span className="ctx-label">SURFACE WIND FIELD</span>
            <span className="ctx-val ctx-val--mono">
              {windValue}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">OCEAN CURRENTS</span>
            <span className="ctx-val ctx-val--mono">
              {currentValue}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">LAGRANGIAN PARTICLES</span>
            <span className="ctx-val ctx-val--highlight">
              {particleCount != null
                ? `${particleCount} active drift tracers tracked`
                : 'Not yet calculated'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">DISPERSION ENVELOPE</span>
            <span className="ctx-val ctx-val--mono">
              {extentKm2 != null
                ? `${extentKm2} km² footprint expansion`
                : 'Not yet calculated'}
            </span>
          </div>

          <div className="ctx-note-box">
            <span className="ctx-note-icon" aria-hidden="true">ℹ</span>
            <span>
              Drift equations solve continuous advection-diffusion under windage factor 0.035 and Stokes drift.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
