import {
  MAP_LAYER_CATALOG,
  useMapStore,
  type MapLayerId,
} from '@/store/mapStore'
import { useAvailableMapLayers } from '@/components/map/layerAvailability'

/**
 * Map legend.
 *
 * A compact floating container anchored bottom-left, above the live compass
 * and the MapLibre scale bar.
 *
 * Rows are derived from MAP_LAYER_CATALOG rather than restated here, so a row
 * can never drift from the label, colour or note the layer drawer shows - the
 * previous hand-written list had already drifted, labelling vessel *tracks* as
 * "Shipping Lane" while the shipping-lane layer went unmentioned.
 *
 * A row is lit only when its layer is both visible and drawable. Layers with no
 * connected data source stay listed but dimmed with their emptyNote as the
 * tooltip, so the legend never implies a live feed that is not there.
 */

type Shape = 'blob' | 'vessel' | 'dash' | 'dot' | 'arrow' | 'grid'

/**
 * Mark shape per layer, chosen to match how the layer actually draws:
 * organic fills, ship hulls, dashed boundaries, and so on.
 */
const SHAPE: Partial<Record<MapLayerId, Shape>> = {
  slick: 'dot',
  sarSlicks: 'blob',
  vessels: 'vessel',
  vesselTrails: 'dash',
  shippingLanes: 'dash',
  sarFootprint: 'dash',
  eez: 'dash',
  currents: 'arrow',
  wind: 'arrow',
  weather: 'arrow',
  incidents: 'dot',
  drift: 'blob',
  attribution: 'vessel',
}

/**
 * Draw order: the evidence an operator reads first, then the fleet, then what
 * the fleet leaves behind.
 *
 * This used to be thirteen rows in four labelled groups, which made a 324px-tall
 * panel out of four rows' worth of reading. It now names only the incident and
 * the fleet, and the group headings go with it - four rows do not need to be
 * sorted into categories, and the headings cost as much height as two rows.
 *
 * The environment and analysis layers are still switchable, in the toolbar row
 * and the layer drawer. A legend's job is to say what the bright things on the
 * map are, and a dimmed "Wind Vectors" row does not help anyone read the water.
 */
const ROW_ORDER: MapLayerId[] = ['sarSlicks', 'vessels', 'vesselTrails', 'drift']

export function MapLegend() {
  const visibility = useMapStore((s) => s.visibility)
  const available = useAvailableMapLayers()

  const rows = ROW_ORDER.map((id) => ({ id, entry: MAP_LAYER_CATALOG[id] })).filter(
    (r) => r.id !== 'satellite',
  )

  return (
    <section className="cc-legend" aria-label="Map legend">
      <div className="cc-legend-kicker">Legend</div>
      <ul className="cc-legend-list">
        {rows.map(({ id, entry }) => {
          const drawable = available.has(id)
          const on = drawable && visibility[id]
          return (
            <li
              key={id}
              className="cc-legend-row"
              data-on={on || undefined}
              data-nodata={!drawable || undefined}
              data-shape={SHAPE[id] ?? 'dot'}
              style={{ '--cc-legend-color': entry.color } as React.CSSProperties}
              title={
                drawable ? (entry.note ?? entry.label) : (entry.emptyNote ?? 'Not available in this session')
              }
            >
              <span className="cc-legend-mark" aria-hidden="true" />
              {entry.label}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
