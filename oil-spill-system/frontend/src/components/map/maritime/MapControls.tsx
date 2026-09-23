import { useMap } from 'react-map-gl/maplibre'
import { REGION_BY_ID } from '@/store/mapStore'
import { useSelectionFocus } from '@/components/workspace/selection'

/**
 * Compact vertical map controls (zoom in / zoom out / reset extent), styled
 * to match the command-centre glass rather than maplibre's default chrome.
 * "Reset extent" returns to the Indian Ocean region — or to the current
 * selection when one exists.
 */
export function MapControls() {
  const map = useMap().current
  const focus = useSelectionFocus()

  const zoomDelta = (delta: number) => {
    const gl = map?.getMap()
    if (!gl) return
    gl.zoomTo(clamp(gl.getZoom() + delta), { duration: 300 })
  }

  const resetExtent = () => {
    if (!map) return
    const gl = map.getMap()
    if (!gl) return
    if (focus?.coords) {
      const [[w, s], [e, n]] = REGION_BY_ID.io.bounds
      const span = Math.max(Math.abs(e - w) / 40, 6)
      const lon = Math.max(w + span, Math.min(focus.coords[0], e - span))
      const lat = Math.max(s + span / 2, Math.min(focus.coords[1], n - span / 2))
      gl.flyTo({
        center: [lon, lat],
        zoom: Math.max(gl.getZoom(), 4.6),
        duration: 700,
      })
      return
    }
    gl.flyTo({ center: [70, 6], zoom: 3.8, duration: 700 })
  }

  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      <button
        type="button"
        className="map-control-btn"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => zoomDelta(1)}
      >
        +
      </button>
      <button
        type="button"
        className="map-control-btn"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => zoomDelta(-1)}
      >
        −
      </button>
      <button
        type="button"
        className="map-control-btn"
        aria-label="Reset extent"
        title="Reset to Indian Ocean extent"
        onClick={resetExtent}
      >
        ◎
      </button>
    </div>
  )
}

function clamp(z: number): number {
  return Math.min(12, Math.max(2, z))
}