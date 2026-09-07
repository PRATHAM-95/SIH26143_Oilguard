import { useMemo } from 'react'
import { PolygonLayer, ScatterplotLayer, LineLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useBacktrackingStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'
import { labelLayer } from '@/components/map/overlays'

/**
 * Build deck.gl layers for the backtracking investigation:
 *   - backward trajectories (ensemble endpoint fans) — `backtracking`
 *   - the probable source region polygon (90% contour) — `uncertainty`
 *   - source confidence contours (50/75/90%) + probability heat — `sourceProbability`
 *   - the estimated origin marker.
 *
 * Visibility is gated by the map-store catalogue. Trajectory inputs are
 * already down-sampled by the backend (≤50 endpoints/member), so we never
 * render thousands of individual deck.gl primitives.
 */
export function useBacktrackingLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const trajectories = useBacktrackingStore((s) => s.trajectories)
  const sourceRegion = useBacktrackingStore((s) => s.sourceRegion)
  const sourceContours = useBacktrackingStore((s) => s.sourceContours)
  const origin = useBacktrackingStore((s) => s.origin)

  const showTrajectories = useMapStore((s) => s.visibility.backtracking)
  const showProbability = useMapStore((s) => s.visibility.sourceProbability)
  const showUncertainty = useMapStore((s) => s.visibility.uncertainty)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []

    if (showTrajectories && trajectories) {
      trajectories.forEach((t, k) => {
        if (!t.endpoints || t.endpoints.length < 2) return
        layers.push(
          new LineLayer({
            id: `bt-trajectory-${t.member}-${k}`,
            data: [{ path: t.endpoints.map((p) => [p.lon, p.lat]) }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: [103, 232, 199, 90],
            getWidth: 1,
            widthMinPixels: 0.6,
            widthMaxPixels: 1.4,
            pickable: false,
          }),
        )
      })
    }

    if (showProbability && sourceContours) {
      // Probability confidence contours (50/75/90%).
      const colorByLevel: Record<string, [number, number, number, number]> = {
        '0.9': [228, 176, 76, 40],
        '0.75': [228, 176, 76, 30],
        '0.5': [228, 176, 76, 18],
      }
      for (const c of sourceContours) {
        const key = String(Math.round(c.level * 100) / 100)
        layers.push(
          new PolygonLayer({
            id: `bt-contour-${key}`,
            data: [{ polygon: c.polygon }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            stroked: true,
            filled: true,
            getLineColor: [228, 176, 76, 180],
            getFillColor: colorByLevel[key] ?? [228, 176, 76, 25],
            getLineWidth: 1500,
            lineWidthMinPixels: 1,
            lineWidthMaxPixels: 2.5,
            pickable: false,
          }),
        )
      }
    }

    if (showUncertainty && sourceRegion && sourceRegion.length > 0) {
      // Probable source region (90% contour) — the primary investigation output.
      layers.push(
        new PolygonLayer({
          id: 'bt-source-region',
          data: [{ polygon: sourceRegion, pick: { kind: 'source_region' } }],
          getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
          stroked: true,
          filled: true,
          getLineColor: VSCO.evidence.origin as [number, number, number],
          getFillColor: [...VSCO.evidence.origin, 26] as [number, number, number, number],
          getLineWidth: 3000,
          lineWidthMinPixels: 2,
          lineWidthMaxPixels: 4.5,
          pickable: true,
        }),
      )
    }

    if (origin) {
      layers.push(
        new ScatterplotLayer({
          id: 'bt-origin',
          data: [
            {
              coordinates: [origin.lon, origin.lat],
              pick: { kind: 'origin' },
            },
          ],
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getRadius: 1500,
          radiusMinPixels: 7,
          radiusMaxPixels: 12,
          getFillColor: VSCO.evidence.origin as [number, number, number],
          pickable: true,
        }),
        labelLayer(
          'bt-origin-label',
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
  }, [trajectories, sourceRegion, sourceContours, origin, showTrajectories, showProbability, showUncertainty])
}
