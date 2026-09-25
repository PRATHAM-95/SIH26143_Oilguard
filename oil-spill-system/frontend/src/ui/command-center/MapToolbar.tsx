import { MAP_LAYER_CATALOG, useMapStore, type MapLayerId } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'
import { NO_DATA_LAYERS } from './AoiCard'

/**
 * Compact single-row map toolbar.
 *
 * Replaces the previous tall vertical layer stack that dominated the left of
 * the map. Six primary operational layers sit in one horizontal row; the full
 * 16-layer catalogue stays behind the `MAP LAYERS` disclosure, which drives the
 * pre-existing `LayerDrawer` through the shared `uiStore` flag.
 *
 * Layers whose provider is not connected are rendered in a visibly inert state
 * rather than implying live data.
 */

type Pill = { id: MapLayerId; label: string; glyph: string; color: string }

const PILLS: Pill[] = [
  { id: 'slick', label: 'Oil Spills', glyph: '◉', color: '#FF8A63' },
  { id: 'vessels', label: 'Vessels', glyph: '▲', color: '#7AD4FF' },
  { id: 'eez', label: 'EEZ Boundaries', glyph: '⊞', color: '#5CB2D6' },
  { id: 'sarFootprint', label: 'Satellite Passes', glyph: '✈', color: '#60A5CD' },
  { id: 'currents', label: 'Ocean Currents', glyph: '≋', color: '#4F8F9C' },
  { id: 'wind', label: 'Wind Vectors', glyph: '≋', color: '#8AA4BD' },
]

export function MapToolbar() {
  const visibility = useMapStore((s) => s.visibility)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const basemap = useMapStore((s) => s.basemap)
  const setBasemap = useMapStore((s) => s.setBasemap)
  const layersOpen = useUiStore((s) => s.layersOpen)
  const toggleLayers = useUiStore((s) => s.toggleLayers)

  const activeCount = PILLS.filter((p) => visibility[p.id] && !NO_DATA_LAYERS.has(p.id)).length

  return (
    <div className="cc-mtoolbar" role="toolbar" aria-label="Map layers and basemap">
      <div className="cc-mtoolbar-pills">
        {PILLS.map(({ id, label, glyph, color }) => {
          const entry = MAP_LAYER_CATALOG[id]
          const noData = NO_DATA_LAYERS.has(id)
          const on = visibility[id] && !noData
          return (
            <button
              key={id}
              type="button"
              className="cc-mpill"
              aria-pressed={on}
              data-nodata={noData || undefined}
              style={{ '--pill-color': color } as React.CSSProperties}
              title={noData ? (entry.emptyNote ?? entry.note) : (entry.note ?? entry.label)}
              onClick={() => toggleLayer(id)}
            >
              <span className="cc-mpill-glyph" aria-hidden="true">
                {glyph}
              </span>
              {label}
            </button>
          )
        })}
      </div>

      <div className="cc-mtoolbar-right">
        <div className="cc-basegroup" role="group" aria-label="Basemap">
          <button
            type="button"
            className="cc-baseopt"
            aria-pressed={basemap === 'satellite'}
            onClick={() => setBasemap('satellite')}
            title="Satellite imagery (Esri World Imagery)"
          >
            SAT
          </button>
          <button
            type="button"
            className="cc-baseopt"
            aria-pressed={basemap === 'dark'}
            onClick={() => setBasemap('dark')}
            title="Dark vector map (OpenFreeMap)"
          >
            DARK
          </button>
        </div>

        <button
          type="button"
          className="cc-layersbtn"
          aria-expanded={layersOpen}
          aria-controls="cc-layers-panel"
          onClick={toggleLayers}
        >
          Map Layers
          <span className="cc-layersbtn-count">{activeCount}</span>
          <span className="cc-layersbtn-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
    </div>
  )
}
