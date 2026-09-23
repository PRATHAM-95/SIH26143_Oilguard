import { useEffect, useMemo } from 'react'
import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { useSarStore } from '@/store/sarStore'
export { useSarStore }
import { useMapStore } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'
import { labelLayer } from '@/components/map/overlays'
import { circleRing } from '@/components/map/maritime/geo'
import type { SarCandidateState, SarProvenance } from '@/types/domain'

const PROVENANCE_LABEL: Record<SarProvenance, string> = {
  REAL_SENTINEL1: 'Real Sentinel-1',
  CACHED_SENTINEL1: 'Cached Sentinel-1',
  LOCAL_FIXTURE: 'Demo fixture',
  SYNTHETIC: 'Synthetic',
  UNAVAILABLE: 'Unavailable',
}

function provenanceBadge(provenance: SarProvenance | null): string {
  switch (provenance) {
    case 'REAL_SENTINEL1':
    case 'CACHED_SENTINEL1':
      return 'ok'
    case 'LOCAL_FIXTURE':
    case 'SYNTHETIC':
      return 'warn'
    case 'UNAVAILABLE':
      return 'danger'
    default:
      return 'warn'
  }
}

/** Featured detection: top-confidence oil candidate (or top overall). */
function featuredCandidate(candidates: SarCandidateState[]): SarCandidateState | null {
  if (candidates.length === 0) return null
  const oil = candidates
    .filter((c) => c.classification === 'OIL_CANDIDATE')
    .sort((a, b) => b.confidence - a.confidence)[0]
  return (
    oil ?? candidates.slice().sort((a, b) => b.confidence - a.confidence)[0]
  )
}

function slickRadiusKm(c: SarCandidateState): number {
  return Math.sqrt(Math.max(c.areaKm2, 0.05) / Math.PI)
}

/**
 * Build deck.gl layers for the SAR observation: the scene footprint (observed
 * evidence, outline), the detector's slick candidates (organic filled
 * polygons with dashed boundaries coloured by classification) and a pulsing
 * "featured" treatment for the highest-confidence oil candidate so the map
 * reads like a detection surface rather than a scatter of markers.
 * Visibility is gated by the map-store catalogue.
 */
export function useSarLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const candidates = useSarStore((s) => s.candidates)
  const footprint = useSarStore((s) => s.footprint)
  const showSlicks = useMapStore((s) => s.visibility.sarSlicks)
  const showFootprint = useMapStore((s) => s.visibility.sarFootprint)
  const pulse = useMapStore((s) => s.pulse)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []

    if (showSlicks) {
      for (const c of candidates) {
        const oil = c.classification === 'OIL_CANDIDATE'
        const line = (oil ? VSCO.sar.slick : VSCO.sar.lookalike) as [number, number, number]
        const fill = (oil ? VSCO.sar.slickFill : VSCO.sar.lookalikeFill) as [
          number,
          number,
          number,
        ]
        layers.push(
          new PolygonLayer({
            id: `sar-slick-${c.id}`,
            data: [{ polygon: c.polygon, pick: { kind: 'sar_candidate', id: c.id } }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            stroked: true,
            filled: true,
            getLineColor: line,
            getFillColor: [...fill, 34] as [number, number, number, number],
            getLineWidth: oil ? 2200 : 1200,
            lineWidthMinPixels: oil ? 2 : 1.4,
            lineWidthMaxPixels: oil ? 4 : 3,
            getLineDashArray: oil ? () => 5 : undefined,
            pickable: true,
          }),
          new ScatterplotLayer({
            id: `sar-slick-centroid-${c.id}`,
            data: [
              {
                coordinates: [c.centroid.lon, c.centroid.lat],
                pick: { kind: 'sar_candidate', id: c.id },
              },
            ],
            getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
            getRadius: 900,
            radiusMinPixels: 4,
            radiusMaxPixels: 6,
            getFillColor: line,
          }),
        )
      }

      /* Featured slick — dominant but not map-covering. */
      const featured = featuredCandidate(candidates)
      if (featured) {
        const hot = VSCO.sar.slickHot as [number, number, number]
        const hotFill = VSCO.sar.slickHotFill as [number, number, number]
        const glow = circleRing(featured.centroid.lon, featured.centroid.lat, slickRadiusKm(featured) * 2.4, 56)
        const halo = circleRing(featured.centroid.lon, featured.centroid.lat, slickRadiusKm(featured) * 1.35, 56)
        const radiusM = 2600 * (pulse ? 1 : 0.62)
        const isOil = featured.classification === 'OIL_CANDIDATE'
        layers.push(
          new PolygonLayer({
            id: 'sar-slick-featured-glow',
            stroked: true,
            filled: true,
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            getLineColor: [255, 122, 80, 90],
            getFillColor: isOil ? [255, 116, 74, 16] : [208, 163, 95, 12],
            getLineWidth: 3200,
            lineWidthMinPixels: 1,
            lineWidthMaxPixels: 2,
            pickable: true,
            data: [
              {
                polygon: glow,
                pick: { kind: 'sar_candidate', id: featured.id },
              },
            ],
          }),
          new PolygonLayer({
            id: 'sar-slick-featured-halo',
            data: [{ polygon: halo }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            stroked: true,
            filled: false,
            getLineColor: isOil ? hot : [225, 170, 100],
            getLineWidth: 1400,
            lineWidthMinPixels: 1.2,
            lineWidthMaxPixels: 2.4,
            getLineDashArray: () => 4,
            pickable: false,
          }),
          new ScatterplotLayer({
            id: 'sar-slick-featured-pulse',
            data: [{ coordinates: [featured.centroid.lon, featured.centroid.lat] }],
            getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
            getRadius: radiusM,
            radiusMinPixels: 10,
            radiusMaxPixels: 20,
            getFillColor: [255, 96, 74, 120],
            pickable: false,
          }),
          new ScatterplotLayer({
            id: 'sar-slick-featured-core',
            data: [{ coordinates: [featured.centroid.lon, featured.centroid.lat] }],
            getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
            getRadius: 1100,
            radiusMinPixels: 3.4,
            radiusMaxPixels: 5.5,
            getFillColor: hotFill,
            pickable: false,
          }),
          labelLayer(
            'sar-slick-featured-label',
            [
              {
                coordinates: [featured.centroid.lon, featured.centroid.lat] as [number, number],
                text: `SLICK-${featured.id.slice(0, 12).toUpperCase()}`,
                color: isOil ? [255, 176, 140] : [232, 200, 150],
              },
            ],
            { size: 11 },
          ),
        )
      }
    }

    if (showFootprint && footprint && footprint.length > 0) {
      layers.push(
        new PolygonLayer({
          id: 'sar-scene-footprint',
          data: [{ polygon: footprint }],
          getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
          stroked: true,
          filled: false,
          getLineColor: VSCO.sar.footprint as [number, number, number],
          getLineWidth: 2000,
          lineWidthMinPixels: 1.25,
          lineWidthMaxPixels: 3,
        }),
      )
    }

    return layers
  }, [candidates, footprint, showSlicks, showFootprint, pulse])
}

export function SarObservationPanel({ simulationId }: { simulationId: string | null }) {
  const sar = useSarStore((s) => s)
  const setLayer = useMapStore((s) => s.setLayer)

  const run = () => {
    if (!simulationId) return
    useSarStore.getState().detect(simulationId, 'LOCAL_FIXTURE')
  }

  useEffect(() => {
    if (!simulationId) return
    useSarStore.getState().loadObservation(simulationId)
  }, [simulationId])

  if (!simulationId) {
    return (
      <Panel title="SAR observation">
        <EmptyState
          label="No active simulation"
          hint="Create and start a simulation, then observe it from space."
        />
      </Panel>
    )
  }

  const provenance = sar.provenance
  const busy = sar.busy || sar.status === 'processing'

  return (
    <Panel
      title="SAR observation"
      right={
        <span className={`status-chip status-chip--${provenanceBadge(provenance)}`}>
          {PROVENANCE_LABEL[provenance ?? 'UNAVAILABLE']}
        </span>
      }
    >
      <div className="stack">
        <KeyValue label="Scene" value={sar.sceneId ?? 'No scene observed'} />
        <KeyValue label="Detector" value={sar.detector ?? 'Awaiting detection'} />
        <KeyValue label="Acquisition" value={sar.acquisitionTime ?? '—'} />
        <KeyValue label="Confidence" value={sar.confidence != null ? sar.confidence.toFixed(2) : '—'} />
        <KeyValue
          label="Slick area"
          value={sar.slickAreaKm2 != null ? `${sar.slickAreaKm2.toFixed(2)} km²` : '—'}
        />
        <KeyValue
          label="Age estimate"
          value={
            sar.ageAvailable
              ? (sar.ageEstimate ?? '—')
              : 'Unavailable (single scene)'
          }
        />

        {sar.candidates.length === 0 ? (
          <EmptyState
            label="No slick candidates"
            hint="Run an observation to detect dark SAR features."
          />
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            {sar.candidates.map((c) => (
              <CandidateRow key={c.id} c={c} />
            ))}
          </div>
        )}

        <div className="stack" style={{ gap: 4 }}>
          <Button variant="primary" block disabled={busy} onClick={run}>
            {busy ? 'Observing…' : 'Run SAR observation'}
          </Button>
          <Button
            block
            disabled={sar.candidates.length === 0}
            onClick={() => {
              setLayer('sarSlicks', !useMapStore.getState().visibility.sarSlicks)
              setLayer('sarFootprint', !useMapStore.getState().visibility.sarFootprint)
            }}
          >
            Toggle SAR layers
          </Button>
        </div>

        {sar.warnings.length > 0 && (
          <div className="text-faint" style={{ fontSize: '10.5px' }}>
            {sar.warnings.slice(0, 2).join(' ')}
          </div>
        )}
      </div>
    </Panel>
  )
}

function CandidateRow({ c }: { c: SarCandidateState }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 7px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`status-chip status-chip--${c.classification === 'OIL_CANDIDATE' ? 'ok' : 'warn'}`}>
          {c.classification.replace('_', ' ')}
        </span>
        <span className="text-faint" style={{ fontSize: '10.5px' }}>
          conf {c.confidence.toFixed(2)} · {c.areaKm2.toFixed(2)} km²
        </span>
      </div>
      {c.aspectRatio != null && (
        <div className="text-faint" style={{ fontSize: '10.5px', marginTop: 2 }}>
          aspect {c.aspectRatio.toFixed(2)} · length {c.lengthKm?.toFixed(1)} km
          {c.contrastDb != null && ` · Δσ⁰ ${c.contrastDb.toFixed(1)} dB`}
        </div>
      )}
      {c.hints.length > 0 && (
        <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.3, marginTop: 2 }}>
          {c.hints[0]}
        </div>
      )}
    </div>
  )
}
