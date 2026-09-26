import { MAP_LAYER_CATALOG, useMapStore, type MapLayerId } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'
import { ChevronDownIcon } from '@/components/ui/Icon'
import { noDataLayers } from './AoiCard'

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

type Pill = { id: MapLayerId; label: string; glyph: string }

/**
 * The six layers that earn a permanent place in the single row.
 *
 * Which six is an editorial choice, so the list stays here. Everything the pill
 * displays about a layer - its colour, its tooltip, its no-data state - is read
 * from the catalogue instead of being repeated, so a pill cannot describe a layer
 * other than the one it toggles.
 *
 * The first entry was `slick`, the observed-spill marker, while carrying
 * `sarSlicks`' colour and the label "Oil Spills". That marker only draws once a
 * journey step releases a spill, so the pill read as on with nothing on the map,
 * and the detection this map exists to show had no control at all. It now points
 * at the layer it was already describing.
 */
const PILLS: Pill[] = [
  { id: 'sarSlicks', label: 'Oil Spills', glyph: '◉' },
  { id: 'vessels', label: 'Vessels', glyph: '▲' },
  { id: 'eez', label: 'EEZ Boundaries', glyph: '⊞' },
  { id: 'sarFootprint', label: 'Satellite Passes', glyph: '✈' },
  { id: 'currents', label: 'Ocean Currents', glyph: '≋' },
  { id: 'wind', label: 'Wind Vectors', glyph: '≋' },
]

export function MapToolbar() {
  const visibility = useMapStore((s) => s.visibility)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const basemap = useMapStore((s) => s.basemap)
  const setBasemap = useMapStore((s) => s.setBasemap)
  const layersOpen = useUiStore((s) => s.layersOpen)
  const toggleLayers = useUiStore((s) => s.toggleLayers)

  const noData = noDataLayers()
  const activeCount = PILLS.filter((p) => visibility[p.id] && !noData.has(p.id)).length

  return (
    <div className="cc-mtoolbar" role="toolbar" aria-label="Map layers and basemap">
      <div className="cc-mtoolbar-pills">
        {PILLS.map(({ id, label, glyph }) => {
          const entry = MAP_LAYER_CATALOG[id]
          const missing = noData.has(id)
          const on = visibility[id] && !missing
          return (
            <button
              key={id}
              type="button"
              className="cc-mpill"
              aria-pressed={on}
              data-nodata={missing || undefined}
              style={{ '--pill-color': entry.color } as React.CSSProperties}
              title={missing ? (entry.emptyNote ?? entry.note) : (entry.note ?? entry.label)}
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
          {activeCount > 0 ? (
            <span className="cc-layersbtn-count">
              {activeCount} active
            </span>
          ) : null}
          <span className="cc-layersbtn-caret" aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
        </button>
      </div>
    </div>
  )
}
