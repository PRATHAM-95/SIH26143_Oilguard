import { useMemo } from 'react'
import { ScatterplotLayer, PolygonLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import {
  useMapStore,
  type MapSelection,
  type SelectionKind,
} from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import {
  stageOrigin,
  stageSourceRegionRing,
  stageRankedVessels,
  type PositionedCandidate,
} from '@/components/map/InvestigationMap'
import { RANK_COLORS } from '@/components/attribution/AttributionMap'

function rankColor3(rank: number | null | undefined): [number, number, number] | null {
  if (rank == null) return null
  const colors = RANK_COLORS[Math.min(Math.max(rank, 1) - 1, RANK_COLORS.length - 1)]
  return colors.slice(0, 3) as [number, number, number]
}

const KM_DEG_LAT = 111.32

function circleRing(lon: number, lat: number, radiusKm: number, segments = 48): [number, number][] {
  const lonScale = KM_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const dLat = radiusKm / KM_DEG_LAT
  const dLon = radiusKm / lonScale
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * 2 * Math.PI
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)] as [number, number]
  })
}

function polygonCentroid(ring: [number, number][]): [number, number] | null {
  if (ring.length < 3) return null
  let lon = 0
  let lat = 0
  for (const [x, y] of ring) {
    lon += x
    lat += y
  }
  return [lon / ring.length, lat / ring.length]
}

export type SelectionFocus = {
  selection: MapSelection | null
  kind: SelectionKind | null
  coords: [number, number] | null
  label: string | null
  color: [number, number, number]
  candidate?: PositionedCandidate | null
}

const DEFAULT_COLOR: [number, number, number] = [255, 255, 255]

/**
 * Resolves the current map selection against the application stores into a
 * concrete on-map focus (position + label + colour), shared by the selection
 * ring layer and the contextual intelligence panel.
 */
export function useSelectionFocus(): SelectionFocus {
  const selection = useMapStore((s) => s.selection)
  const spill = useSimulationStore((s) => s.spill)
  const vessels = useSimulationStore((s) => s.vessels)
  const sarCandidates = useSarStore((s) => s.candidates)
  const stages = useInvestigationStore((s) => s.stages)
  const btOrigin = useBacktrackingStore((s) => s.origin)
  const btRegion = useBacktrackingStore((s) => s.sourceRegion)
  const attOrigin = useAttributionStore((s) => s.origin)
  const attVessels = useAttributionStore((s) => s.vessels)

  return useMemo<SelectionFocus>(() => {
    if (!selection) return { selection: null, kind: null, coords: null, label: null, color: DEFAULT_COLOR }

    switch (selection.kind) {
      case 'spill':
      case 'slick':
        return {
          selection,
          kind: selection.kind,
          coords: spill?.location ? [spill.location.lon, spill.location.lat] : null,
          label: 'Spill observation point',
          color: [180, 104, 45],
        }
      case 'vessel': {
        const vessel = vessels.find((v) => v.id === selection.id)
        return {
          selection,
          kind: selection.kind,
          coords: vessel ? [vessel.position.lon, vessel.position.lat] : null,
          label: vessel?.name ?? 'Vessel',
          color: [123, 210, 255],
        }
      }
      case 'sar_candidate': {
        const c = sarCandidates.find((x) => x.id === selection.id)
        return {
          selection,
          kind: selection.kind,
          coords: c ? [c.centroid.lon, c.centroid.lat] : null,
          label: `SAR candidate ${String(c?.id ?? '').slice(0, 12)}`,
          color: c?.classification === 'OIL_CANDIDATE' ? [255, 120, 80] : [180, 140, 80],
        }
      }
      case 'source_region': {
        const region = stageSourceRegionRing(stages) ?? btRegion
        return {
          selection,
          kind: selection.kind,
          coords: region ? polygonCentroid(region) : null,
          label: 'Probable source region',
          color: [228, 176, 76],
        }
      }
      case 'origin': {
        const origin = stageOrigin(stages) ?? btOrigin ?? attOrigin
        return {
          selection,
          kind: selection.kind,
          coords: origin ? [origin.lon, origin.lat] : null,
          label: 'Estimated origin',
          color: [228, 176, 76],
        }
      }
      case 'ais_candidate': {
        const fromStages = stageRankedVessels(stages).find(
          (v) => v.rank === (selection.rank ?? -1) || (selection.mmsi && v.mmsi === selection.mmsi),
        )
        const fromAtt = attVessels.find(
          (v) => v.rank === (selection.rank ?? -1) || (selection.mmsi && v.mmsi === selection.mmsi),
        )
        const candidate: PositionedCandidate | null =
          fromStages ??
          (fromAtt
            ? {
                rank: fromAtt.rank,
                mmsi: fromAtt.mmsi,
                name: fromAtt.name,
                score: fromAtt.score,
                minDistanceKm: fromAtt.minDistanceKm,
                timeOfClosestApproach: fromAtt.timeOfClosestApproach,
                closestPosition: fromAtt.closestPosition,
                factors: fromAtt.factors,
              }
            : null)

        return {
          selection,
          kind: selection.kind,
          coords: candidate?.closestPosition
            ? [candidate.closestPosition.lon, candidate.closestPosition.lat]
            : null,
          label: candidate?.name ?? `Candidate #${selection.rank ?? '?'}`,
          color: rankColor3(candidate?.rank) ?? DEFAULT_COLOR,
          candidate,
        }
      }
      default:
        return { selection, kind: selection.kind, coords: null, label: null, color: DEFAULT_COLOR }
    }
  }, [selection, spill, vessels, sarCandidates, stages, btOrigin, btRegion, attOrigin, attVessels])
}

/**
 * A crisp "selection ring" deck layer drawn at the current focus point, so the
 * selected object is easy to spot regardless of layer styling.
 */
export function useSelectionRingLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const focus = useSelectionFocus()

  return useMemo(() => {
    if (!focus.selection || !focus.coords) return []
    const [lon, lat] = focus.coords
    return [
      new PolygonLayer({
        id: 'selection-ring',
        data: [{ polygon: circleRing(lon, lat, 1.4) }],
        getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
        stroked: true,
        filled: false,
        getLineColor: [0, 87, 255, 230],
        getLineWidth: 900,
        lineWidthMinPixels: 1.8,
        lineWidthMaxPixels: 3,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'selection-pip',
        data: [{ coordinates: [lon, lat] as [number, number] }],
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        getRadius: 520,
        radiusMinPixels: 3,
        radiusMaxPixels: 5,
        getFillColor: focus.kind === 'vessel' ? [248, 247, 244, 255] : focus.color,
        pickable: false,
      }),
    ]
  }, [focus])
}

export function useSelectionClear(): () => void {
  return useMemo(() => useMapStore.getState().clearSelection, [])
}