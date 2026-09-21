import { useEffect, type ReactNode } from 'react'
import { Map, NavigationControl, ScaleControl, AttributionControl, useMap, useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore, type Bounds, type MapSelection } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'

/** Wrapper type for deck.gl layer lists passed through the app. */
export type DeckLayers = NonNullable<MapboxOverlayProps['layers']>

type MapViewProps = {
  /** deck.gl layers to render on top of the base map */
  layers?: MapboxOverlayProps['layers']
  onViewStateChange?: () => void
  /** called with a pick payload when the user selects an object on the map */
  onSelect?: (selection: MapSelection | null) => void
  children?: ReactNode
}

/** deck.gl overlay wired to the maplibre map instance */
function DeckOverlay({ layers }: { layers: MapboxOverlayProps['layers'] | undefined }) {
  const overlay = useControl<MapboxOverlay>(
    () =>
      new MapboxOverlay({
        interleaved: true,
        layers: undefined,
        getCursor: ({ isHovering }) => (isHovering ? 'pointer' : ''),
        onClick: (info) => {
          const pick = (info.object as { pick?: unknown } | null)?.pick
          onSelectRef.current?.(
            pick && typeof pick === 'object' && 'kind' in pick
              ? (pick as MapSelection)
              : null,
          )
          onHoverRef.current?.()
        },
      }),
    { position: 'top-right' },
  )

  useEffect(() => {
    overlay.setProps({ layers: layers ?? [] })
  }, [overlay, layers])

  return null
}

/**
 * Consumes a one-shot "fit these bounds" request from the map store.
 * Pages call `requestFit` after data lands so the camera settles on the area
 * of interest without owning the map instance.
 */
function FitController() {
  const bounds = useMapStore((s) => s.fitBounds)
  const clearFit = useMapStore((s) => s.clearFit)
  const { current: map } = useMap()

  useEffect(() => {
    if (!bounds || !map) return
    const [sw, ne] = bounds as Bounds
    const isValid = sw && ne && Number.isFinite(sw[0]) && Number.isFinite(ne[0])
    if (!isValid) {
      clearFit()
      return
    }
    map.fitBounds([sw, ne] as [[number, number], [number, number]], {
      padding: { top: 90, left: 90, right: 90, bottom: 90 },
      duration: 650,
      maxZoom: 9,
    })
    clearFit()
  }, [bounds, map, clearFit])

  return null
}

/** Module-scope bridges so the (once-created) overlay reads the latest handlers. */
const onSelectRef: { current: ((sel: MapSelection | null) => void) | null } = { current: null }
const onHoverRef: { current: (() => void) | null } = { current: null }

const baseStyle = {
  position: 'absolute',
  inset: 0,
} as const

/**
 * Re-usable map shell for the command centre.
 *
 * - CARTO dark maritime raster basemap + interleaved deck.gl overlay.
 * - Pages attach evidence layers; any object carrying a `pick` payload is
 *   selectable and drives the contextual intelligence rail.
 * - Standard controls: navigation (zoom/compass), scale, compact attribution.
 * - `requestFit` in the map store re-centres the camera on demand.
 */
export default function MapView({ layers, onViewStateChange, onSelect, children }: MapViewProps) {
  const view = useMapStore((s) => s.view)
  const setView = useMapStore((s) => s.setView)

  onSelectRef.current = onSelect ?? null

  return (
    <div className="map-shell">
      <Map
        reuseMaps
        style={baseStyle}
        initialViewState={view}
        mapStyle={VSCO.styles.dark}
        onMove={(e) => {
          setView({
            longitude: e.viewState.longitude,
            latitude: e.viewState.latitude,
            zoom: e.viewState.zoom,
            pitch: e.viewState.pitch,
            bearing: e.viewState.bearing,
          })
          onViewStateChange?.()
        }}
        onMouseMove={(e) => {
          useMapStore.getState().setCursor({ lon: e.lngLat.lng, lat: e.lngLat.lat })
          onHoverRef.current?.()
        }}
        onMouseLeave={() => useMapStore.getState().setCursor(null)}
        attributionControl={false}
        maxZoom={12}
        minZoom={2}
      >
        <DeckOverlay layers={layers} />
        <FitController />
        <NavigationControl position="bottom-right" visualizePitch />
        <ScaleControl position="bottom-left" unit="metric" maxWidth={120} />
        <AttributionControl position="bottom-right" compact />
        {children}
      </Map>
    </div>
  )
}

/**
 * Map furniture — coordinate + zoom readout shown over the pane.
 * Reads view centre and live hover cursor from the map store.
 */
export function MapFurniture() {
  const view = useMapStore((s) => s.view)
  const cursor = useMapStore((s) => s.cursor)
  const pos = cursor ?? { lon: view.longitude, lat: view.latitude }
  const latDir = pos.lat >= 0 ? 'N' : 'S'
  const lonDir = pos.lon >= 0 ? 'E' : 'W'
  return (
    <div className="map-furniture">
      <div className="coord-readout">
        <span className="mono">
          {Math.abs(pos.lat).toFixed(4)}°{latDir} &middot; {Math.abs(pos.lon).toFixed(4)}°{lonDir}
        </span>
        <span className="coord-zoom"> &middot; z{view.zoom.toFixed(1)}</span>
      </div>
    </div>
  )
}