import { useMemo } from 'react'
import { LineLayer, PolygonLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useAttributionStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'
import { labelLayer } from '@/components/map/overlays'
import { SHIP_ICON_URL } from '@/components/map/vesselSilhouette'

const KM_DEG_LAT = 111.32

/** Rank-colour ramp for the top candidates (alpha fades with rank). */
export const RANK_COLORS: [number, number, number, number][] = [
  [255, 200, 90, 255],   // rank 1
  [255, 140, 80, 235],   // rank 2
  [120, 210, 255, 215],  // rank 3
  [120, 150, 190, 190],  // rank 4+
]

function circleRing(lon: number, lat: number, radiusKm: number, segments = 64): [number, number][] {
  const lonScale = KM_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const dLat = radiusKm / KM_DEG_LAT
  const dLon = radiusKm / lonScale
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * 2 * Math.PI
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number]
  })
}

export function rankColor(rank: number): [number, number, number, number] {
  return RANK_COLORS[Math.min(Math.max(rank, 1) - 1, RANK_COLORS.length - 1)]
}

/**
 * STEP 10 attribution map layers:
 *   - the AIS search radius around the estimated origin (`attribution` layer)
 *   - each ranked candidate at its closest-approach position to the origin
 *   - connection lines origin → candidate, shaded by rank
 *
 * Vessel markers are only drawn where a position genuinely exists in the
 * scored output (the closest-approach report); nothing is fabricated.
 */
export function useAttributionLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const origin = useAttributionStore((s) => s.origin)
  const radiusKm = useAttributionStore((s) => s.radiusKm)
  const vessels = useAttributionStore((s) => s.vessels)
  const show = useMapStore((s) => s.visibility.attribution)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []
    if (!show) return layers

    if (origin && radiusKm && radiusKm > 0) {
      layers.push(
        new PolygonLayer({
          id: 'att-search-radius',
          data: [{ polygon: circleRing(origin.lon, origin.lat, radiusKm) }],
          getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
          stroked: true,
          filled: false,
          getLineColor: [120, 150, 190, 160],
          getLineWidth: 1200,
          lineWidthMinPixels: 1,
          lineWidthMaxPixels: 2,
          pickable: false,
        }),
      )
    }

    const positioned = vessels.filter((v) => v.closestPosition && v.minDistanceKm != null)
    for (const v of positioned) {
      const pos = v.closestPosition as { lon: number; lat: number }
      const color = rankColor(v.rank)
      layers.push(
        new LineLayer({
          id: `att-link-${v.rank}`,
          data: [{ path: [[origin?.lon ?? pos.lon, origin?.lat ?? pos.lat], [pos.lon, pos.lat]] }],
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: [color[0], color[1], color[2], 110],
          getWidth: 1,
          widthMinPixels: 0.6,
          widthMaxPixels: 1.6,
          pickable: false,
        }),
        new IconLayer({
          id: `att-vessel-${v.rank}`,
          data: [
            {
              coordinates: [pos.lon, pos.lat] as [number, number],
              pick: { kind: 'ais_candidate', rank: v.rank, mmsi: v.mmsi, name: v.name },
            },
          ],
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getIcon: () => ({
            url: SHIP_ICON_URL,
            width: 32,
            height: 64,
            mask: true,
          }),
          getSize: 28,
          sizeUnits: 'pixels',
          sizeMinPixels: 20,
          sizeMaxPixels: 38,
          getAngle: 0,
          getColor: color,
          pickable: true,
        }),
        labelLayer(
          `att-rank-label-${v.rank}`,
          [
            {
              coordinates: [pos.lon, pos.lat],
              text: `#${v.rank}`,
              color: [color[0], color[1], color[2]],
            },
          ],
          { size: 12 },
        ),
      )
    }

    if (origin) {
      layers.push(
        new ScatterplotLayer({
          id: 'att-origin',
          data: [
            {
              coordinates: [origin.lon, origin.lat],
              pick: { kind: 'origin' },
            },
          ],
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getRadius: 900,
          radiusMinPixels: 4,
          radiusMaxPixels: 7,
          getFillColor: [...VSCO.evidence.origin, 210] as [number, number, number, number],
          pickable: true,
        }),
        labelLayer(
          'att-origin-label',
          [
            {
              coordinates: [origin.lon, origin.lat],
              text: 'ESTIMATED SOURCE',
              color: [244, 212, 156],
            },
          ],
          { size: 10 },
        ),
      )
    }

    return layers
  }, [show, origin, radiusKm, vessels])
}