import { useMemo } from 'react'
import { LineLayer, PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useInvestigationStore } from '@/store/investigationStore'
import { useMapStore } from '@/store/mapStore'
import type { InvestigationStageState } from '@/types/domain'
import { rankColor } from '@/components/attribution/AttributionMap'
import { VSCO } from '@/styles/vsco'
import { labelLayer } from '@/components/map/overlays'

/**
 * Geometry derived from the persistent investigation (STEP 11) state.
 *
 * The standalone backtracking/attribution pages hydrate from their own REST
 * runs, but during an investigation the same scientific output is carried in
 * the investigation stage summaries:
 *   - backtracking stage: `sourceRegion` (GeoJSON Polygon), `originEstimate`
 *     ({lat, lon}), and the source time window.
 *   - attribution stage: `rankedVessels` (scorer output, incl. closest
 *     positions).
 * This keeps the workspace map purely front-end and consistent with the
 * verdict the investigation actually produced.
 */

export type PositionedCandidate = {
  rank: number
  mmsi: string | null
  name: string | null
  score: number | null
  minDistanceKm: number | null
  timeOfClosestApproach: string | null
  closestPosition: { lon: number; lat: number } | null
  factors: Record<string, number> | null
}

function stageSummary(stages: InvestigationStageState[], stageId: string): Record<string, unknown> | null {
  return stages.find((s) => s.stageId === stageId)?.summary ?? null
}

export function stageOrigin(stages: InvestigationStageState[]): { lon: number; lat: number } | null {
  const summary = stageSummary(stages, 'backtracking')
  const o = summary?.originEstimate
  if (typeof o === 'object' && o !== null) {
    const m = o as Record<string, unknown>
    const lat = Number(m.lat)
    const lon = Number(m.lon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lon, lat }
  }
  return null
}

export function stageUncertaintyKm(stages: InvestigationStageState[]): number | null {
  const v = stageSummary(stages, 'backtracking')?.uncertaintyKm
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function stageSourceRegionRing(stages: InvestigationStageState[]): [number, number][] | null {
  const s = stageSummary(stages, 'backtracking')?.sourceRegion
  if (typeof s !== 'object' || s === null) return null
  const m = s as Record<string, unknown>
  const coords = m.coordinates
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null
  const ring = coords[0] as [number, number][]
  return ring.length >= 3 ? ring : null
}

/** Parse the attribution stage summary's ranked-vessels payload (scorer DTO). */
export function stageRankedVessels(stages: InvestigationStageState[]): PositionedCandidate[] {
  const raw = stageSummary(stages, 'attribution')?.rankedVessels
  if (!Array.isArray(raw)) return []
  const out: PositionedCandidate[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const v = item as Record<string, unknown>
    const fe = v.factor_evidence
    const spatial =
      typeof fe === 'object' && fe !== null
        ? (fe as Record<string, unknown>).spatial
        : undefined
    const spatialPos =
      typeof spatial === 'object' && spatial !== null
        ? (spatial as Record<string, unknown>).position
        : undefined
    const closestRaw = v.closest_position ?? spatialPos
    const closest =
      typeof closestRaw === 'object' && closestRaw !== null
        ? {
            lon: Number((closestRaw as Record<string, unknown>).lon),
            lat: Number((closestRaw as Record<string, unknown>).lat),
          }
        : null
    const score = typeof v.score === 'number' ? v.score : null
    const factorsRaw = v.factors
    const factors: Record<string, number> | null =
      typeof factorsRaw === 'object' && factorsRaw !== null
        ? Object.fromEntries(
            Object.entries(factorsRaw as Record<string, unknown>)
              .filter(([, value]) => typeof value === 'number')
              .map(([k, value]) => [k, value as number]),
          )
        : null
    out.push({
      rank: typeof v.rank === 'number' ? v.rank : 0,
      mmsi: typeof v.mmsi === 'string' ? v.mmsi : null,
      name: typeof v.name === 'string' ? v.name : null,
      score,
      factors,
      minDistanceKm: typeof v.min_distance_km === 'number' ? v.min_distance_km : null,
      timeOfClosestApproach:
        typeof v.time_of_closest_approach === 'string' ? v.time_of_closest_approach : null,
      closestPosition:
        closest && Number.isFinite(closest.lon) && Number.isFinite(closest.lat) ? closest : null,
    })
  }
  return out.sort((a, b) => (a.rank || 0) - (b.rank || 0))
}

/**
 * Investigation workspace layers: source region + origin (from the
 * backtracking stage) and ranked AIS candidates (from the attribution stage).
 * Visibility is gated by the catalogue; each pickable object carries a `pick`
 * payload for the contextual rail.
 */
export function useInvestigationMapLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const stages = useInvestigationStore((s) => s.stages)
  const showUncertainty = useMapStore((s) => s.visibility.uncertainty)
  const showAttribution = useMapStore((s) => s.visibility.attribution)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []
    const origin = stageOrigin(stages)
    const region = stageSourceRegionRing(stages)

    if (showUncertainty) {
      if (region && region.length >= 3) {
        layers.push(
          new PolygonLayer({
            id: 'inv-source-region',
            data: [{ polygon: region, pick: { kind: 'source_region' } }],
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
            id: 'inv-origin',
            data: [
              {
                coordinates: [origin.lon, origin.lat] as [number, number],
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
            'inv-origin-label',
            [
              {
                coordinates: [origin.lon, origin.lat] as [number, number],
                text: 'ESTIMATED SOURCE',
                color: [244, 212, 156],
              },
            ],
            { size: 10 },
          ),
        )
      }
    }

    if (showAttribution) {
      const vessels = stageRankedVessels(stages)
      for (const v of vessels) {
        const pos = v.closestPosition
        if (!pos) continue
        const color = rankColor(v.rank)
        const start = origin ? [origin.lon, origin.lat] : [pos.lon, pos.lat]
        layers.push(
          new LineLayer({
            id: `inv-att-link-${v.rank}`,
            data: [{ path: [start, [pos.lon, pos.lat]] }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: [color[0], color[1], color[2], 110],
            getWidth: 1,
            widthMinPixels: 0.6,
            widthMaxPixels: 1.6,
            pickable: false,
          }),
          new ScatterplotLayer({
            id: `inv-att-vessel-${v.rank}`,
            data: [
              {
                coordinates: [pos.lon, pos.lat] as [number, number],
                pick: { kind: 'ais_candidate', rank: v.rank, mmsi: v.mmsi, name: v.name },
              },
            ],
            getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
            getRadius: 1200,
            radiusMinPixels: 5 + Math.max(0, 4 - v.rank),
            radiusMaxPixels: 10,
            getFillColor: color,
            pickable: true,
          }),
          labelLayer(
            `inv-att-label-${v.rank}`,
            [
              {
                coordinates: [pos.lon, pos.lat] as [number, number],
                text: `#${v.rank}`,
                color: [color[0], color[1], color[2]],
              },
            ],
            { size: 12 },
          ),
        )
      }
    }

    return layers
  }, [stages, showUncertainty, showAttribution])
}