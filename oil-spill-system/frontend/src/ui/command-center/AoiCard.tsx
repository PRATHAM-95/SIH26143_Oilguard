import { REGION_BY_ID, type MapLayerId } from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'

/**
 * Area-of-interest card.
 *
 * Owns the top-left corner of the map with no other overlay competing for it.
 * Prose uses the UI sans; only the coordinates are set in mono, per the
 * typography rule that data reads technical while description does not.
 */
export function AoiCard() {
  const region = REGION_BY_ID.io
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const [[west, south], [east, north]] = region.bounds

  const extent = `${Math.abs(south).toFixed(1)}°S – ${north.toFixed(1)}°N`
  const longitude = `${west.toFixed(1)}°E – ${east.toFixed(1)}°E`

  return (
    <section className="cc-aoi" aria-label="Area of interest">
      <div className="cc-aoi-top">
        <div className="cc-aoi-kicker">Area of Interest</div>
        <span className="cc-aoi-caret" aria-hidden="true">
          ▾
        </span>
      </div>

      <h2 className="cc-aoi-title">{region.label} Region</h2>

      <div className="cc-aoi-coords">
        <span className="cc-aoi-coord">{extent}</span>
        <span className="cc-aoi-coord-div" aria-hidden="true">
          |
        </span>
        <span className="cc-aoi-coord">{longitude}</span>
      </div>

      <p className="cc-aoi-desc">
        Monitoring oil spills, vessel activity and environmental data across the
        Indian Ocean.
      </p>

      <div className="cc-aoi-foot">
        <span className="cc-aoi-foot-item">
          <span className="cc-aoi-foot-dot" aria-hidden="true" />
          {vesselCount} AIS vessel{vesselCount === 1 ? '' : 's'} in scope
        </span>
      </div>
    </section>
  )
}

/** Layer ids whose data source is genuinely not connected yet. */
export const NO_DATA_LAYERS = new Set<MapLayerId>(['currents', 'wind', 'weather', 'incidents'])
