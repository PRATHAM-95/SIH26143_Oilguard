import type { MapLayerId } from '@/store/mapStore'
import { useMapStore, REGION_BY_ID } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'

type ChipDef = {
  id: string
  label: string
  glyph: string
  /** Catalogued layer(s) gated by this chip. */
  layerId: MapLayerId | null
  /** Why the chip is disabled (honest "no data" state). */
  emptyNote?: string
}

const CHIPS: ChipDef[] = [
  { id: 'oil', label: 'Oil Spills', glyph: '●', layerId: 'sarSlicks' },
  { id: 'vessels', label: 'Vessels', glyph: '▲', layerId: 'vessels' },
  {
    id: 'eez',
    label: 'EEZ Boundaries',
    glyph: '┄',
    layerId: 'eez',
    emptyNote: 'EEZ not loaded — fetched from Marine Regions when available',
  },
  { id: 'satellite', label: 'Satellite Passes', glyph: '◈', layerId: 'sarFootprint' },
  {
    id: 'currents',
    label: 'Ocean Currents',
    glyph: '≋',
    layerId: 'currents',
    emptyNote: 'CMEMS not connected — no data, never faked',
  },
  {
    id: 'wind',
    label: 'Wind Vectors',
    glyph: '→',
    layerId: 'wind',
    emptyNote: 'ERA5 not connected — no data, never faked',
  },
  {
    id: 'weather',
    label: 'Live Weather',
    glyph: '∿',
    layerId: 'weather',
    emptyNote: 'Open-Meteo not connected — no live weather, never faked',
  },
  {
    id: 'incidents',
    label: 'Live Incidents',
    glyph: '⚑',
    layerId: 'incidents',
    emptyNote: 'No live marine incidents — EONET',
  },
]

/**
 * Horizontal layer toolbar floating over the top of the map: the eight
 * operational toggles (Oil Spills / Vessels / EEZ / Satellite Passes /
 * Currents / Wind / Live Weather / Live Incidents), an AREA OF INTEREST
 * readout and the basemap switch. The full catalogue lives in the app's own
 * on-map LayerDrawer, so no duplicate toggle is rendered here. Chips reflect
 * the current on/off state; chips without data are disabled and annotated
 * (never faked).
 */
export function MapLayerToolbar({
  available,
}: {
  available: Set<MapLayerId> | null
}) {
  const visibility = useMapStore((s) => s.visibility)
  const setLayer = useMapStore((s) => s.setLayer)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const basemap = useMapStore((s) => s.basemap)
  const setBasemap = useMapStore((s) => s.setBasemap)
  const region = REGION_BY_ID.io

  return (
    <div className="mm-toolbar cc-glass" role="toolbar" aria-label="Map layers">
      <div className="mm-toolbar-left">
        <div className="mm-aoi" title="Area of interest — Indian Ocean Region">
          <span className="mm-aoi-kicker">Area of interest</span>
          <span className="mm-aoi-val">{region.short}</span>
        </div>
      </div>

      <div className="mm-toolbar-chips" role="group">
        {CHIPS.map((c) => {
          const hasData = c.layerId == null || (available == null || available.has(c.layerId))
          const on =
            c.layerId != null &&
            (c.layerId === 'sarSlicks' || c.layerId === 'slick'
              ? visibility.sarSlicks || visibility.slick
              : visibility[c.layerId])
          return (
            <button
              key={c.id}
              type="button"
              className={`mm-chip${on ? ' mm-chip--on' : ''}${!hasData ? ' mm-chip--nodata' : ''}`}
              disabled={!hasData}
              aria-pressed={hasData ? on : undefined}
              title={hasData ? (on ? `Hide ${c.label}` : `Show ${c.label}`) : c.emptyNote}
              onClick={() => {
                if (c.layerId === 'sarSlicks') {
                  const target = !(visibility.sarSlicks || visibility.slick)
                  setLayer('sarSlicks', target)
                  setLayer('slick', target)
                  return
                }
                if (c.layerId) toggleLayer(c.layerId)
              }}
            >
              <span className="mm-chip-glyph" aria-hidden="true">
                {c.glyph}
              </span>
              <span className="mm-chip-label">{c.label}</span>
              {!hasData ? <span className="mm-chip-note">{c.emptyNote?.split('—')[0]}</span> : null}
            </button>
          )
        })}
      </div>

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