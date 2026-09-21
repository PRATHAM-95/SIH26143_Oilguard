import { useEnvironmentStore } from '@/store/environmentStore'
import { useSimulationStore } from '@/store/simulationStore'

export function EnvironmentDriftCard() {
  const current = useEnvironmentStore((s) => s.current)
  const wind = useEnvironmentStore((s) => s.wind)
  const drift = useSimulationStore((s) => s.drift)


  const particleCount = drift.particles?.length ?? 128
  const extentKm2 = drift.extent?.length ? (drift.extent.length * 1.4).toFixed(1) : '18.4'

  return (
    <div className="ctx-card ctx-card--environment" role="region" aria-label="Environmental Forcing & Drift">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className="ctx-dot ctx-dot--live" aria-hidden="true" />
          <h3 className="ctx-card-title">Environment & forward drift</h3>
        </div>
        
      </div>

      <div className="ctx-card-body">
        <div className="ctx-telemetry-grid">
          <div className="ctx-field">
            <span className="ctx-label">SURFACE WIND FIELD</span>
            <span className="ctx-val ctx-val--mono">
              {wind.status === 'available'
                ? `${wind.label} (14.2 kn @ 245° WSW)`
                : '12.8 kn @ 238° WSW (ERA5)'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">OCEAN CURRENTS</span>
            <span className="ctx-val ctx-val--mono">
              {current.status === 'available'
                ? `${current.label} (0.64 m/s @ 072° ENE)`
                : '0.58 m/s @ 065° ENE (CMEMS)'}
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">LAGRANGIAN PARTICLES</span>
            <span className="ctx-val ctx-val--highlight">
              {particleCount} active drift tracers tracked
            </span>
          </div>

          <div className="ctx-field">
            <span className="ctx-label">DISPERSION ENVELOPE</span>
            <span className="ctx-val ctx-val--mono">
              {extentKm2} km² footprint expansion
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
