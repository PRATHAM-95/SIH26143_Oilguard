import {
  MAP_LAYER_CATALOG,
  LAYER_GROUP_LABEL,
  LAYER_GROUP_ORDER,
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
 * Draw order within each group: the evidence an operator reads first, then the
 * context, then the environment.
 *
 * The step-scoped analysis products - backtracking, uncertainty and source
 * probability - are deliberately absent. They belong to the attribution step and
 * the layer drawer already explains them, so listing them would push the legend
 * down the map for rows that are off almost all the time.
 */
const ROW_ORDER: MapLayerId[] = [
  'sarSlicks',
  'sarFootprint',
  'slick',
  'vessels',
  'attribution',
  'vesselTrails',
  'shippingLanes',
  'eez',
  'drift',
  'currents',
  'wind',
  'weather',
  'incidents',
]

export function MapLegend() {
  const visibility = useMapStore((s) => s.visibility)
  const available = useAvailableMapLayers()

  const groups = LAYER_GROUP_ORDER.map((group) => ({
    group,
    rows: ROW_ORDER.map((id) => ({ id, entry: MAP_LAYER_CATALOG[id] }))
      .filter(
        (r) =>
          r.entry.group === group &&
          // The basemap is a background, not an overlay, so it has no legend row.
          r.id !== 'satellite',
      )
      .sort((a, b) => Number(available.has(b.id)) - Number(available.has(a.id))),
  })).filter((g) => g.rows.length > 0)

  return (
    <section className="cc-legend" aria-label="Map legend">
      <div className="cc-legend-kicker">Legend</div>
      {groups.map((g) => (
        <div key={g.group} className="cc-legend-group">
          <div className="cc-legend-groupname">{LAYER_GROUP_LABEL[g.group]}</div>
          <ul className="cc-legend-list">
            {g.rows.map(({ id, entry }) => {
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
                    drawable
                      ? (entry.note ?? entry.label)
                      : (entry.emptyNote ?? 'Not available in this session')
                  }
                >
                  <span className="cc-legend-mark" aria-hidden="true" />
                  {entry.label}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
