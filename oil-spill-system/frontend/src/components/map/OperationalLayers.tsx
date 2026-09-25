import { useMemo } from 'react'
import { LineLayer, PolygonLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useMapStore } from '@/store/mapStore'
import { isDemoMode } from '@/lib/demo/mode'
import {
  DEMO_SHIPPING_CORRIDORS,
  DEMO_SPILL_LOCATION,
  demoEnvironmentGrid,
  syntheticIso,
} from '@/lib/demo/seed'
import { labelLayer } from '@/components/map/overlays'

/**
 * Operational context layers: shipping lanes, satellite pass tracks and the
 * environmental vector fields.
 *
 * All three are geographic *context*, so they sit deliberately low in the
 * hierarchy — thin, low-alpha and never brighter than the incident or the
 * vessels. They are rendered with deck.gl layers rather than DOM so the map
 * stays a single WebGL surface.
 *
 * Honesty: the lane network, pass tracks and vector fields have no live provider.
 * They render only in the controlled demo, from the same deterministic seed the
 * rest of the demo scene uses, and every one of them is labelled as synthetic in
 * the legend. In live mode the layers return nothing and the catalogue reports
 * the missing feed, exactly like the other unconnected layers.
 */

const KM_PER_DEG = 111.32
const DEG = Math.PI / 180

/** Split a lon/lat path into fixed-length dash segments, by arc length. */
function dashSegments(
  path: [number, number][],
  dashKm: number,
  gapKm: number,
): [number, number][][] {
  if (path.length < 2) return []
  const dash = dashKm / KM_PER_DEG
  const gap = gapKm / KM_PER_DEG

  // Cumulative arc length along the path, in degrees.
  const cumulative: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    const [lon0, lat0] = path[i - 1]
    const [lon1, lat1] = path[i]
    const step = Math.hypot((lon1 - lon0) * Math.cos(lat0 * DEG), lat1 - lat0)
    cumulative.push(cumulative[i - 1] + step)
  }
  const total = cumulative[cumulative.length - 1]
  if (!(total > 0)) return []

  /** Interpolate the path position at arc length `s`. */
  const at = (s: number): [number, number] => {
    const clamped = Math.min(total, Math.max(0, s))
    let i = 1
    while (i < cumulative.length - 1 && cumulative[i] < clamped) i++
    const segLen = cumulative[i] - cumulative[i - 1]
    const f = segLen > 0 ? (clamped - cumulative[i - 1]) / segLen : 0
    const [lon0, lat0] = path[i - 1]
    const [lon1, lat1] = path[i]
    return [lon0 + (lon1 - lon0) * f, lat0 + (lat1 - lat0) * f]
  }

  const segments: [number, number][][] = []
  for (let s = 0; s < total; s += dash + gap) {
    const from = at(s)
    const to = at(Math.min(total, s + dash))
    // Skip degenerate dashes so we never emit zero-length lines.
    if (Math.abs(to[0] - from[0]) > 1e-9 || Math.abs(to[1] - from[1]) > 1e-9) {
      segments.push([from, to])
    }
  }
  return segments
}

/** Sample a quadratic bow between two points — how a polar pass actually tracks. */
function bowPath(
  from: [number, number],
  to: [number, number],
  bowDeg: number,
  samples = 48,
): [number, number][] {
  const midLon = (from[0] + to[0]) / 2
  const midLat = (from[1] + to[1]) / 2
  // Offset the control point perpendicular to the track to create the arc.
  const dLon = to[0] - from[0]
  const dLat = to[1] - from[1]
  const len = Math.hypot(dLon, dLat) || 1
  const ctrlLon = midLon + (-dLat / len) * bowDeg
  const ctrlLat = midLat + (dLon / len) * bowDeg
  const out: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const inv = 1 - t
    out.push([
      inv * inv * from[0] + 2 * inv * t * ctrlLon + t * t * to[0],
      inv * inv * from[1] + 2 * inv * t * ctrlLat + t * t * to[1],
    ])
  }
  return out
}

/** Closed rectangle centred on `center`, rotated to `heading` degrees. */
function footprint(
  center: [number, number],
  halfLon: number,
  halfLat: number,
  headingDeg: number,
): [number, number][] {
  const rot = (headingDeg * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const lonScale = 1 / Math.max(0.35, Math.cos((center[1] * Math.PI) / 180))
  return [
    [-halfLon, -halfLat],
    [halfLon, -halfLat],
    [halfLon, halfLat],
    [-halfLon, halfLat],
    [-halfLon, -halfLat],
  ].map(([dx, dy]) => {
    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos
    return [center[0] + rx * lonScale, center[1] + ry] as [number, number]
  })
}

const LANE_COLOR: [number, number, number, number] = [148, 170, 191, 74]
const PASS_COLOR: [number, number, number, number] = [127, 211, 247, 132]

/** Synthetic Sentinel-1 pass tracks across the operating region. */
const DEMO_PASSES: { id: string; from: [number, number]; to: [number, number]; bow: number; heading: number; at: string }[] = [
  { id: 'S1A-DEMO-0211', from: [44.2, 21.4], to: [58.6, 3.2], bow: 2.6, heading: 118, at: syntheticIso(-2) },
  { id: 'S1A-DEMO-0212', from: [52.8, 24.6], to: [79.4, 2.4], bow: -3.1, heading: 122, at: syntheticIso(-2) },
  { id: 'S1A-DEMO-0213', from: [66.4, 19.8], to: [92.6, 1.2], bow: 2.2, heading: 115, at: syntheticIso(-2) },
  { id: 'S1A-DEMO-0209', from: [47.6, 12.4], to: [74.2, 26.8], bow: -2.8, heading: 296, at: syntheticIso(-5.5) },
]

/** Shipping lanes: thin, low-opacity corridor network, subordinate to vessels. */
export function useShippingLaneLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const show = useMapStore((s) => s.visibility.shippingLanes)

  return useMemo(() => {
    if (!show || !isDemoMode()) return []
    const dashes = DEMO_SHIPPING_CORRIDORS.flatMap((c) =>
      dashSegments(c.path, 130, 90).map((path) => ({ path, corridor: c.id })),
    )
    return [
      new LineLayer({
        id: 'shipping-lanes',
        data: dashes,
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: LANE_COLOR,
        getWidth: 1.1,
        widthMinPixels: 1,
        widthMaxPixels: 2.2,
        pickable: false,
      }),
      labelLayer(
        'shipping-lane-labels',
        DEMO_SHIPPING_CORRIDORS.map((c) => ({
          coordinates: c.path[Math.floor(c.path.length / 2)] as [number, number],
          text: c.label.toUpperCase(),
          color: [122, 142, 163] as [number, number, number],
        })),
        { size: 8.5, anchor: 'middle' },
      ),
    ]
  }, [show])
}

/**
 * Satellite pass tracks plus the acquired scene footprint, so the map shows
 * where the SAR observation came from rather than only the detection.
 */
export function useSatellitePassLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const show = useMapStore((s) => s.visibility.sarFootprint)

  return useMemo(() => {
    if (!show || !isDemoMode()) return []
    const tracks = DEMO_PASSES.flatMap((p) =>
      dashSegments(bowPath(p.from, p.to, p.bow), 210, 150).map((path) => ({ path, id: p.id })),
    )
    return [
      new LineLayer({
        id: 'satellite-pass-tracks',
        data: tracks,
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: PASS_COLOR,
        getWidth: 1.2,
        widthMinPixels: 1,
        widthMaxPixels: 2.4,
        pickable: false,
      }),
      new PolygonLayer({
        id: 'satellite-pass-footprint',
        data: [
          {
            polygon: footprint([DEMO_SPILL_LOCATION.lon, DEMO_SPILL_LOCATION.lat], 1.9, 1.1, 118),
            id: DEMO_PASSES[0].id,
          },
        ],
        getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
        stroked: true,
        filled: true,
        getLineColor: [127, 211, 247, 96] as [number, number, number, number],
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        lineWidthMaxPixels: 1.6,
        getFillColor: [96, 178, 220, 16] as [number, number, number, number],
        pickable: false,
      }),
      labelLayer(
        'satellite-pass-labels',
        DEMO_PASSES.map((p) => ({
          coordinates: [
            p.from[0] + (p.to[0] - p.from[0]) * 0.5,
            p.from[1] + (p.to[1] - p.from[1]) * 0.5,
          ] as [number, number],
          text: `SENTINEL-1 · ${p.id.slice(-4)}`,
          color: [127, 211, 247] as [number, number, number],
        })),
        { size: 8.5, anchor: 'middle' },
      ),
    ]
  }, [show])
}

/**
 * Environmental vector field: ocean currents and wind arrows on the synthetic
 * demo grid. Deliberately thin and low-alpha — enough to say "environmental
 * context exists" without turning the map into a meteorological chart.
 */
export function useEnvironmentFieldLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const showCurrents = useMapStore((s) => s.visibility.currents)
  const showWind = useMapStore((s) => s.visibility.wind)

  return useMemo(() => {
    if (!isDemoMode() || (!showCurrents && !showWind)) return []
    const layers: NonNullable<MapboxOverlayProps['layers']> = []

    const field = (axis: 'current' | 'wind') =>
      demoEnvironmentGrid(axis).fields.map((f) => {
        // Scale the glyph length with the vector magnitude, in degrees.
        const mag = Math.hypot(f.u, f.v) || 1
        const lenDeg = (axis === 'wind' ? 0.9 : 1.1) * Math.min(1.6, mag / (axis === 'wind' ? 4 : 0.5))
        const ux = f.u / mag
        const uy = f.v / mag
        const lonScale = 1 / Math.max(0.35, Math.cos((f.lat * Math.PI) / 180))
        const dx = ux * lenDeg * lonScale
        const dy = uy * lenDeg
        const tip: [number, number] = [f.lon + dx, f.lat + dy]
        const ang = Math.atan2(dx, dy)
        const barb = lenDeg * 0.34
        return {
          key: `${axis}-${f.lat}-${f.lon}`,
          origin: [f.lon, f.lat] as [number, number],
          tip,
          // Two barbs at the head give the glyph a direction without an arrowhead.
          barbs: [
            [tip, [tip[0] + barb * Math.sin(ang + 2.5), tip[1] + barb * Math.cos(ang + 2.5)]],
            [tip, [tip[0] + barb * Math.sin(ang - 2.5), tip[1] + barb * Math.cos(ang - 2.5)]],
          ] as [number, number][][],
        }
      })

    if (showCurrents) {
      const currents = field('current')
      layers.push(
        new LineLayer({
          id: 'current-vectors',
          data: currents,
          getPath: (d: { origin: [number, number]; tip: [number, number] }) => [d.origin, d.tip],
          getColor: [94, 200, 214, 96] as [number, number, number, number],
          getWidth: 1.1,
          widthMinPixels: 1,
          widthMaxPixels: 2,
          pickable: false,
        }),
        new LineLayer({
          id: 'current-vector-heads',
          data: currents.flatMap((c) => c.barbs.map((path) => ({ path }))),
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: [94, 200, 214, 78] as [number, number, number, number],
          getWidth: 1,
          widthMinPixels: 1,
          widthMaxPixels: 1.8,
          pickable: false,
        }),
      )
    }

    if (showWind) {
      const wind = field('wind')
      layers.push(
        new LineLayer({
          id: 'wind-vectors',
          data: wind,
          getPath: (d: { origin: [number, number]; tip: [number, number] }) => [d.origin, d.tip],
          getColor: [154, 190, 216, 84] as [number, number, number, number],
          getWidth: 1,
          widthMinPixels: 1,
          widthMaxPixels: 1.8,
          pickable: false,
        }),
        new LineLayer({
          id: 'wind-vector-heads',
          data: wind.flatMap((w) => w.barbs.map((path) => ({ path }))),
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: [154, 190, 216, 66] as [number, number, number, number],
          getWidth: 1,
          widthMinPixels: 1,
          widthMaxPixels: 1.6,
          pickable: false,
        }),
      )
    }

    return layers
  }, [showCurrents, showWind])
}

/** Re-exported so the incident renderer can reuse the dash helper. */
export { dashSegments }
