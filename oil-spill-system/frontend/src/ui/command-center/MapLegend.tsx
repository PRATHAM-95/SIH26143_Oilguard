import { useMapStore, type MapLayerId } from '@/store/mapStore'

/**
 * Map legend.
 *
 * A compact floating container anchored bottom-left, above the live compass
 * and the MapLibre scale bar. Rows are derived from real layer visibility, so
 * anything switched off in the toolbar is visibly inactive rather than
 * misleading.
 */

type Row = { id: MapLayerId; label: string; shape: 'blob' | 'triangle' | 'dash' }

const ROWS: Row[] = [
  { id: 'slick', label: 'Oil Spill (High)', shape: 'blob' },
  { id: 'sarSlicks', label: 'Oil Spill (Medium)', shape: 'blob' },
  { id: 'vessels', label: 'Vessel (AIS)', shape: 'triangle' },
  { id: 'eez', label: 'EEZ Boundary', shape: 'dash' },
  { id: 'vesselTrails', label: 'Shipping Lane', shape: 'dash' },
]

export function MapLegend() {
  const visibility = useMapStore((s) => s.visibility)

  return (
    <section className="cc-legend" aria-label="Map legend">
      <div className="cc-legend-kicker">Legend</div>
      <ul className="cc-legend-list">
        {ROWS.map((row) => {
          const on = visibility[row.id]
          return (
            <li
              key={row.id}
              className="cc-legend-row"
              data-on={on || undefined}
              data-shape={row.shape}
            >
              <span className="cc-legend-mark" aria-hidden="true" />
              {row.label}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
