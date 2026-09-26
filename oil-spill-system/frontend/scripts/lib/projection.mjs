/**
 * Minimal Web Mercator projection, matching MapLibre's `project`/`unproject`
 * for a non-pitched, non-rotated map.
 *
 * The two places that reason about on-screen geometry (the fleet legibility
 * audit and the browser pick probe) must agree, otherwise the audit can pass
 * about coordinates the browser will never render. Hence one implementation.
 *
 * At zoom z the 512*2^z world is already in CSS pixels, so mapping to the pane
 * is a pure translation by the view centre.
 */
export const worldSize = (zoom) => 512 * 2 ** zoom

const lonToX = (lon, size) => ((lon + 180) / 360) * size

const latToY = (lat, size) => {
  const sin = Math.sin((Math.min(Math.max(lat, -85.051129), 85.051129) * Math.PI) / 180)
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size
}

/**
 * @param view  { longitude, latitude, zoom }
 * @param pane  { width, height } in CSS pixels
 * @returns fn from [lon, lat] to { x, y } in pane pixels from the top-left
 */
export function projector(view, pane) {
  const size = worldSize(view.zoom)
  const cx = lonToX(view.longitude, size)
  const cy = latToY(view.latitude, size)
  const left = cx - pane.width / 2
  const top = cy - pane.height / 2
  return (lon, lat) => ({ x: lonToX(lon, size) - left, y: latToY(lat, size) - top })
}
