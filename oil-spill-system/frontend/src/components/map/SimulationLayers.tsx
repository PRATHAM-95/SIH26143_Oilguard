import { useMemo } from 'react'
import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useSimulationStore } from '@/store/simulationStore'
import { useMapStore } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'
import { headingTickLayer, labelLayer, trailSegments } from '@/components/map/overlays'

/**
 * Captain-mode simulation layers: live vessels, recorded vessel tracks,
 * the released-spill marker and (when available) the forward-drift output.
 * Every pickable object carries a `pick` payload so the workspace map can
 * drive the contextual rail.
 *
 * Visibility is gated by the map-store catalogue (vessels / vesselTrails /
 * slick / drift).
 */
export function useSimulationLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const vessels = useSimulationStore((s) => s.vessels)
  const trails = useSimulationStore((s) => s.trails)
  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const showVessels = useMapStore((s) => s.visibility.vessels)
  const showTrails = useMapStore((s) => s.visibility.vesselTrails)
  const showSlick = useMapStore((s) => s.visibility.slick)
  const showDrift = useMapStore((s) => s.visibility.drift)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []

    if (showTrails) {
      const segmentData: { path: [number, number][] }[] = []
      for (const v of vessels) {
        const pts = trails[v.id]
        if (!pts || pts.length < 2) continue
        segmentData.push(...trailSegments(pts))
      }
      if (segmentData.length > 0) {
        layers.push(
          new LineLayer({
            id: 'simulation-vessel-trails',
            data: segmentData,
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: VSCO.evidence.trail as [number, number, number],
            getWidth: 1.4,
            widthMinPixels: 4,
            widthMaxPixels: 10,
            pickable: false,
          }),
        )
      }
    }

    if (showVessels) {
      layers.push(
        new ScatterplotLayer({
          id: 'simulation-vessels',
          data: vessels.map((v) => ({
            coordinates: [v.position.lon, v.position.lat],
            pick: { kind: 'vessel', id: v.id, mmsi: v.mmsi, name: v.name },
          })),
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getRadius: 900,
          radiusMinPixels: 6,
          radiusMaxPixels: 10,
          getFillColor: VSCO.evidence.vessel as [number, number, number],
          pickable: true,
        }),
        headingTickLayer(
          'simulation-vessel-headings',
          vessels.map((v) => ({
            coordinates: [v.position.lon, v.position.lat] as [number, number],
            heading: v.heading,
          })),
          0.045,
          VSCO.evidence.vessel as [number, number, number],
        ),
        labelLayer(
          'simulation-vessel-labels',
          vessels.map((v) => ({
            coordinates: [v.position.lon, v.position.lat] as [number, number],
            text: v.name.length > 18 ? `${v.name.slice(0, 17)}…` : v.name,
            color: [154, 216, 247],
          })),
          { size: 11 },
        ),
      )
    }

    if (showSlick && spill?.location) {
      layers.push(
        new ScatterplotLayer({
          id: 'simulation-spill',
          data: [
            {
              coordinates: [spill.location.lon, spill.location.lat] as [number, number],
              pick: { kind: 'spill', id: spill.spillEventId ?? null },
            },
          ],
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getRadius: 1400,
          radiusMinPixels: 8,
          radiusMaxPixels: 14,
          getFillColor: VSCO.evidence.slick as [number, number, number],
          pickable: true,
        }),
        labelLayer(
          'simulation-spill-label',
          [
            {
              coordinates: [spill.location.lon, spill.location.lat] as [number, number],
              text: 'OBSERVED SPILL',
              color: [225, 168, 118],
            },
          ],
          { size: 10 },
        ),
      )
    }

    if (showDrift) {
      if (drift.particles.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'drift-particles',
            data: drift.particles,
            getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
            getRadius: 1600,
            radiusMinPixels: 2,
            radiusMaxPixels: 8,
            getFillColor: VSCO.drift.particle as [number, number, number],
            pickable: false,
          }),
        )
      }
      if (drift.extent && drift.extent.length > 0) {
        layers.push(
          new PolygonLayer({
            id: 'drift-extent',
            data: [{ polygon: drift.extent }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            getLineColor: VSCO.drift.extent as [number, number, number],
            getLineWidth: 2000,
            lineWidthMinPixels: 1.5,
            lineWidthMaxPixels: 4,
            stroked: true,
            filled: true,
            getFillColor: [...VSCO.drift.extentFill, 28] as [number, number, number, number],
            pickable: false,
          }),
          labelLayer(
            'drift-extent-label',
            [{ coordinates: drift.extent[Math.floor(drift.extent.length / 2)], text: 'FORWARD DRIFT' }],
            { size: 9 },
          ),
        )
      }
    }

    return layers
  }, [vessels, trails, spill, drift, showVessels, showTrails, showSlick, showDrift])
}