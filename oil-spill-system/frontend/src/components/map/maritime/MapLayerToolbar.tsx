import { useMemo } from 'react'
import type { MapLayerId } from '@/store/mapStore'
import { useMapStore, MAP_LAYER_CATALOG, REGION_BY_ID } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'

/**
 * Compact top-centre control bar over the map: an AREA OF INTEREST readout,
 * the single "Layers" entry point into the on-map layer catalogue (opens the
 * CatalogueDrawer), the basemap switch and the reference gallery launcher.
 * Layer on/off toggling lives entirely in the drawer and the Command Palette —
 * the bar itself renders no duplicate toggles. The active count is real
 * (visibility over the availability set), never fabricated.
 */
export function MapLayerToolbar({
  available,
  layersOpen,
  onLayersToggle,
}: {
  available: Set<MapLayerId> | null
  layersOpen: boolean
  onLayersToggle: () => void
}) {
  const visibility = useMapStore((s) => s.visibility)
  const basemap = useMapStore((s) => s.basemap)
  const setBasemap = useMapStore((s) => s.setBasemap)
  const region = REGION_BY_ID.io

  const activeCount = useMemo(
    () =>
      (Object.keys(MAP_LAYER_CATALOG) as MapLayerId[]).filter(
        (id) => (available == null || available.has(id)) && visibility[id]
      ).length,
    [available, visibility]
  )

  return (
    <div className="mm-toolbar cc-glass" role="toolbar" aria-label="Map layers">
      <div className="mm-toolbar-left">
        <div className="mm-aoi" title="Area of interest — Indian Ocean Region">
          <span className="mm-aoi-kicker">Area of interest</span>
          <span className="mm-aoi-val">{region.short}</span>
        </div>
      </div>

      <button
        type="button"
        className={`mm-layers-trigger${layersOpen ? ' mm-layers-trigger--on' : ''}`}
        aria-expanded={layersOpen}
        aria-controls="cc-layers-panel"
        title={layersOpen ? 'Close the layer catalogue' : 'Open the layer catalogue'}
        onClick={onLayersToggle}
      >
        <span className="mm-layers-glyph" aria-hidden="true">
          ◈
        </span>
        Layers
        <span className="mm-layers-count">{activeCount} on</span>
        <span className="mm-layers-chev" aria-hidden="true">
          ⌄
        </span>
      </button>

      <div className="mm-toolbar-right">
        <div className="mm-base" role="group" aria-label="Basemap">
          <button
            type="button"
            className={`mm-base-opt${basemap === 'satellite' ? ' mm-base-opt--on' : ''}`}
            aria-pressed={basemap === 'satellite'}
            onClick={() => setBasemap('satellite')}
            title="Satellite imagery (Esri World Imagery)"
          >
            SAT
          </button>
          <button
            type="button"
            className={`mm-base-opt${basemap === 'dark' ? ' mm-base-opt--on' : ''}`}
            aria-pressed={basemap === 'dark'}
            onClick={() => setBasemap('dark')}
            title="Dark vector map (OpenFreeMap)"
          >
            DARK
          </button>
        </div>

        <button
          type="button"
          className="mm-layers-btn"
          title="Historical reference imagery — public-domain Deepwater Horizon archive"
          onClick={() => useUiStore.getState().setReferenceOpen(true)}
        >
          Reference
          <span className="mm-layers-glyph" aria-hidden="true">
            ◈
          </span>
        </button>
      </div>
    </div>
  )
}