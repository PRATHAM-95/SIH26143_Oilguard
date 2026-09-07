import { LineLayer, TextLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'

/**
 * Small deck.gl label + tick helpers shared by the evidence layer builders.
 * Text uses the application mono font so map furniture reads like the UI.
 */

export type LabeledPoint = {
  coordinates: [number, number]
  text: string
  color?: [number, number, number]
}

export function labelLayer(
  id: string,
  data: LabeledPoint[],
  opts: { size?: number; anchor?: 'middle' | 'start' | 'end'; baseline?: 'top' | 'center' | 'bottom'; color?: [number, number, number] } = {},
): NonNullable<MapboxOverlayProps['layers']>[number] {
  const { size = 11, anchor = 'middle', baseline = 'bottom', color } = opts
  return new TextLayer({
    id,
    data,
    getPosition: (d: LabeledPoint) => d.coordinates,
    getText: (d: LabeledPoint) => d.text,
    getSize: size,
    getColor: (d: LabeledPoint) => d.color ?? color ?? ([233, 241, 248] as [number, number, number]),
    getTextAnchor: anchor,
    getAlignmentBaseline: baseline,
    getPixelOffset: [0, 6],
    fontFamily: "'Cascadia Mono', Consolas, monospace",
    fontSizeRange: [8, 18],
    outlineWidth: 2,
    outlineColor: [4, 7, 11, 200],
    characterSet: 'auto',
    pickable: false,
  })
}

/**
 * Short heading tick drawn from a point in the given heading (degrees
 * clockwise from north). Used to give vessels a travel direction without
 * needing an oriented sprite.
 */
export function headingTickLayer(
  id: string,
  points: { coordinates: [number, number]; heading: number }[],
  geoLength: number,
  color: [number, number, number],
): NonNullable<MapboxOverlayProps['layers']>[number] {
  const data = points
    .filter((p) => p.heading != null && p.heading > 0)
    .map((p) => {
      const rad = (p.heading * Math.PI) / 180
      const [lon, lat] = p.coordinates
      return {
        path: [
          [lon, lat],
          [lon + geoLength * Math.sin(rad), lat + geoLength * Math.cos(rad)],
        ] as [number, number][],
      }
    })
  return new LineLayer({
    id,
    data,
    getPath: (d: { path: [number, number][] }) => d.path,
    getColor: color,
    getWidth: 1.2,
    widthMinPixels: 1,
    widthMaxPixels: 3,
    pickable: false,
  })
}

/** Turn a per-vessel point history into consecutive [from, to] segments. */
export function trailSegments(points: { lon: number; lat: number }[]): { path: [number, number][] }[] {
  const segs: { path: [number, number][] }[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    segs.push({ path: [[a.lon, a.lat], [b.lon, b.lat]] })
  }
  return segs
}