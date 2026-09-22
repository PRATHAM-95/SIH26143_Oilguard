import { useMemo } from 'react'
import { useSarStore } from '@/store/sarStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { EVIDENCE_LAYERS, type EvidenceLayerDef } from '../three/evidence/layerDefinitions'
import { projectGeoToPlate, createPlateCircleRing, DEFAULT_VIEW_SPAN_KM } from '../three/evidence/project'

export interface EvidenceLayerState {
  def: EvidenceLayerDef
  status: string
  tone: 'ok' | 'warn' | 'sonar' | 'dim' | 'danger'
  hasGenuineData: boolean
  isUnavailable: boolean
  isIllustrative: boolean
  // Projected 3D plate geometry coordinates
  polygons?: [number, number][][]
  lines?: [number, number][][]
  points?: [number, number][]
  centerPoint?: [number, number]
  radius?: number
  metadata?: Record<string, string | number>
}

export interface EvidenceStackData {
  incidentCenter: [number, number]
  spanKm: number
  layers: EvidenceLayerState[]
  hasIncident: boolean
  pipelineStatus: string | null
  topAttributedVessel: {
    name: string
    mmsi: string
    rank: number
    score: number
    position?: [number, number]
  } | null
}

export function useEvidenceStackData(isIllustrative = false): EvidenceStackData {
  // Read existing Zustand store selectors
  const sarFootprint = useSarStore((s) => s.footprint)
  const sarCandidates = useSarStore((s) => s.candidates)
  const sarProvenance = useSarStore((s) => s.provenance)
  const sarConfidence = useSarStore((s) => s.confidence)

  const spill = useSimulationStore((s) => s.spill)
  const forwardParticles = useSimulationStore((s) => s.drift.particles)

  const backtrackOrigin = useBacktrackingStore((s) => s.origin)
  const backtrackStatus = useBacktrackingStore((s) => s.status)
  const backtrackTrajectories = useBacktrackingStore((s) => s.trajectories)

  const attributionOrigin = useAttributionStore((s) => s.origin)
  const attributionRadiusKm = useAttributionStore((s) => s.radiusKm)
  const attributionVessels = useAttributionStore((s) => s.vessels)

  const investigationStatus = useInvestigationStore((s) => s.status)

  return useMemo(() => {
    // Determine geographic center of evidence coordinate frame
    let centerLon = 54.3667
    let centerLat = 24.4667
    let hasIncident = false

    if (spill?.location) {
      centerLon = spill.location.lon
      centerLat = spill.location.lat
      hasIncident = true
    } else if (attributionOrigin) {
      centerLon = attributionOrigin.lon
      centerLat = attributionOrigin.lat
      hasIncident = true
    } else if (backtrackOrigin) {
      centerLon = backtrackOrigin.lon
      centerLat = backtrackOrigin.lat
      hasIncident = true
    } else if (sarFootprint && sarFootprint.length > 0) {
      centerLon = sarFootprint[0][0]
      centerLat = sarFootprint[0][1]
      hasIncident = true
    }

    const incidentCenter: [number, number] = [centerLon, centerLat]
    const spanKm = attributionRadiusKm && attributionRadiusKm > 0 ? Math.max(attributionRadiusKm * 1.5, 15) : DEFAULT_VIEW_SPAN_KM

    // Map top attributed vessel
    const topVessel = attributionVessels.length > 0 ? attributionVessels[0] : null
    let topAttributedVessel: EvidenceStackData['topAttributedVessel'] = null
    if (topVessel) {
      const pos = topVessel.closestPosition
        ? projectGeoToPlate(topVessel.closestPosition.lon, topVessel.closestPosition.lat, incidentCenter, spanKm)
        : undefined
      topAttributedVessel = {
        name: topVessel.name || (topVessel.mmsi ? `VESSEL ${topVessel.mmsi}` : 'RANKED CANDIDATE'),
        mmsi: topVessel.mmsi || 'N/A',
        rank: topVessel.rank,
        score: topVessel.score ?? 0,
        position: pos,
      }
    }

    // Process all 9 layers
    const layers: EvidenceLayerState[] = EVIDENCE_LAYERS.map((def) => {
      // For /welcome or illustrative fallback
      if (isIllustrative) {
        return buildIllustrativeLayer(def)
      }

      // Live domain mapping
      switch (def.id) {
        case 'sar': {
          const hasData = Boolean(sarFootprint && sarFootprint.length >= 3)
          const projectedFootprint: [number, number][] = hasData
            ? sarFootprint!.map(([lon, lat]) => projectGeoToPlate(lon, lat, incidentCenter, spanKm))
            : [
                [-6, -4],
                [6, -4],
                [6, 4],
                [-6, 4],
                [-6, -4],
              ]
          return {
            def,
            status: hasData ? sarProvenance || 'LIVE' : 'AWAITING ACQUISITION',
            tone: hasData ? 'ok' : 'dim',
            hasGenuineData: hasData,
            isUnavailable: false,
            isIllustrative: false,
            lines: [projectedFootprint],
            metadata: {
              Confidence: sarConfidence != null ? `${(sarConfidence * 100).toFixed(0)}%` : 'N/A',
              Sensor: 'Sentinel-1 SAR C-Band',
            },
          }
        }

        case 'slick': {
          const candidate = sarCandidates.length > 0 ? sarCandidates[0] : null
          const hasData = Boolean(candidate?.polygon && candidate.polygon.length >= 3)
          const polygon: [number, number][] = hasData
            ? candidate!.polygon.map(([lon, lat]) => projectGeoToPlate(lon, lat, incidentCenter, spanKm))
            : [
                [-2, -1],
                [1.5, -2],
                [3, 0.5],
                [0.5, 2],
                [-2.5, 1],
                [-2, -1],
              ]
          return {
            def,
            status: hasData ? 'DETECTED' : spill ? 'SIMULATED' : 'NOT YET CALCULATED',
            tone: hasData ? 'warn' : 'dim',
            hasGenuineData: hasData || Boolean(spill),
            isUnavailable: false,
            isIllustrative: false,
            polygons: [polygon],
            metadata: {
              Area: candidate?.areaKm2 != null ? `${candidate.areaKm2.toFixed(1)} km²` : 'N/A',
              Classification: candidate?.classification || 'SLICK_ANOMALY',
            },
          }
        }

        case 'wind': {
          // Strictly honest: genuine wind vector grid is not provided in backend stores
          return {
            def,
            status: 'NOT YET CALCULATED',
            tone: 'dim',
            hasGenuineData: false,
            isUnavailable: true,
            isIllustrative: false,
            metadata: {
              Provenance: 'Unavailable in telemetry stream',
            },
          }
        }

        case 'currents': {
          // Strictly honest: hydrodynamic current vector field is not provided in backend stores
          return {
            def,
            status: 'NOT YET CALCULATED',
            tone: 'dim',
            hasGenuineData: false,
            isUnavailable: true,
            isIllustrative: false,
            metadata: {
              Provenance: 'Unavailable in telemetry stream',
            },
          }
        }

        case 'drift': {
          const hasParticles = Boolean(forwardParticles && forwardParticles.length > 0)
          const points: [number, number][] = hasParticles
            ? forwardParticles.slice(0, 80).map((p) => {
                return projectGeoToPlate(p.lon, p.lat, incidentCenter, spanKm)
              })
            : []
          return {
            def,
            status: hasParticles ? 'SIMULATED' : 'NOT YET CALCULATED',
            tone: hasParticles ? 'ok' : 'dim',
            hasGenuineData: hasParticles,
            isUnavailable: false,
            isIllustrative: false,
            points: hasParticles ? points : undefined,
            metadata: {
              Ensemble: hasParticles ? `${forwardParticles.length} Lagrangian particles` : 'Standby',
            },
          }
        }

        case 'backtracking': {
          const hasTrajectories = Boolean(backtrackTrajectories && backtrackTrajectories.length > 0)
          const hasOrigin = Boolean(backtrackOrigin)
          const originPoint = hasOrigin
            ? projectGeoToPlate(backtrackOrigin!.lon, backtrackOrigin!.lat, incidentCenter, spanKm)
            : undefined

          return {
            def,
            status: hasOrigin || hasTrajectories ? 'SIMULATED' : 'NOT YET CALCULATED',
            tone: hasOrigin || hasTrajectories ? 'sonar' : 'dim',
            hasGenuineData: hasOrigin || hasTrajectories,
            isUnavailable: false,
            isIllustrative: false,
            centerPoint: originPoint,
            metadata: {
              Status: backtrackStatus || 'IDLE',
              Solver: 'OpenDrift Backward Run',
            },
          }
        }

        case 'ais': {
          // Strictly honest: full AIS transit tracks are not genuinely stored
          return {
            def,
            status: 'UNAVAILABLE',
            tone: 'dim',
            hasGenuineData: false,
            isUnavailable: true,
            isIllustrative: false,
            metadata: {
              Candidates: `${attributionVessels.length} vessel interrogation points`,
            },
          }
        }

        case 'source': {
          const origin = attributionOrigin || backtrackOrigin
          const hasOrigin = Boolean(origin)
          const radius = attributionRadiusKm || 4.5
          const rings: [number, number][][] = hasOrigin
            ? [
                createPlateCircleRing(origin!.lon, origin!.lat, radius * 0.4, incidentCenter, spanKm),
                createPlateCircleRing(origin!.lon, origin!.lat, radius * 0.8, incidentCenter, spanKm),
                createPlateCircleRing(origin!.lon, origin!.lat, radius * 1.2, incidentCenter, spanKm),
              ]
            : []

          return {
            def,
            status: hasOrigin ? 'CALCULATED' : 'NOT YET CALCULATED',
            tone: hasOrigin ? 'warn' : 'dim',
            hasGenuineData: hasOrigin,
            isUnavailable: false,
            isIllustrative: false,
            lines: rings,
            radius,
            metadata: {
              SearchRadius: `${radius.toFixed(1)} km`,
            },
          }
        }

        case 'attribution': {
          const hasVessels = attributionVessels.length > 0
          const pos = topAttributedVessel?.position || [0, 0]
          return {
            def,
            status: hasVessels ? 'CORRELATED' : 'NOT YET CALCULATED',
            tone: hasVessels ? 'sonar' : 'dim',
            hasGenuineData: hasVessels,
            isUnavailable: false,
            isIllustrative: false,
            centerPoint: hasVessels ? pos : undefined,
            metadata: {
              Candidate: topAttributedVessel?.name || 'Awaiting correlation',
              Confidence: topAttributedVessel?.score ? `${(topAttributedVessel.score * 100).toFixed(0)}%` : 'N/A',
            },
          }
        }

        default:
          return buildIllustrativeLayer(def)
      }
    })

    return {
      incidentCenter,
      spanKm,
      layers,
      hasIncident,
      pipelineStatus: investigationStatus,
      topAttributedVessel,
    }
  }, [
    sarFootprint,
    sarCandidates,
    sarProvenance,
    sarConfidence,
    spill,
    forwardParticles,
    backtrackOrigin,
    backtrackStatus,
    backtrackTrajectories,
    attributionOrigin,
    attributionRadiusKm,
    attributionVessels,
    investigationStatus,
    isIllustrative,
  ])
}

/**
 * Builds illustrative / educational geometry for /welcome Scene 04
 * with unambiguous illustrative labeling.
 */
function buildIllustrativeLayer(def: EvidenceLayerDef): EvidenceLayerState {
  switch (def.id) {
    case 'sar':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'ok',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        lines: [
          [
            [-6, -4],
            [6, -4],
            [6, 4],
            [-6, 4],
            [-6, -4],
          ],
        ],
      }

    case 'slick':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'warn',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        polygons: [
          [
            [-2.5, -1.2],
            [1.2, -2.4],
            [3.2, 0.8],
            [0.8, 2.2],
            [-2.8, 1.4],
            [-2.5, -1.2],
          ],
        ],
      }

    case 'wind':
      return {
        def,
        status: 'UNAVAILABLE // NOT YET CALCULATED',
        tone: 'dim',
        hasGenuineData: false,
        isUnavailable: true,
        isIllustrative: true,
      }

    case 'currents':
      return {
        def,
        status: 'UNAVAILABLE // NOT YET CALCULATED',
        tone: 'dim',
        hasGenuineData: false,
        isUnavailable: true,
        isIllustrative: true,
      }

    case 'drift':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'ok',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        points: [
          [-2, 1], [-1.2, 1.4], [-0.5, 1.8], [0.4, 2.1], [1.2, 2.3],
          [-1.5, 0.8], [-0.8, 1.2], [0.1, 1.6], [0.9, 1.9], [1.8, 2.2],
        ],
      }

    case 'backtracking':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'sonar',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        lines: [
          [[-0.5, 0.5], [-2, -1], [-4, -3], [-5.5, -3.8]],
          [[-0.8, 0.4], [-2.4, -1.2], [-4.2, -3.2], [-5.5, -3.8]],
          [[-0.2, 0.6], [-1.6, -0.8], [-3.6, -2.8], [-5.5, -3.8]],
        ],
        centerPoint: [-5.5, -3.8],
      }

    case 'ais':
      return {
        def,
        status: 'UNAVAILABLE // NOT YET CALCULATED',
        tone: 'dim',
        hasGenuineData: false,
        isUnavailable: true,
        isIllustrative: true,
      }

    case 'source':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'warn',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        lines: [
          generateRing([-5.5, -3.8], 1.2),
          generateRing([-5.5, -3.8], 2.2),
          generateRing([-5.5, -3.8], 3.4),
        ],
      }

    case 'attribution':
      return {
        def,
        status: 'ILLUSTRATIVE · NOT LIVE DATA',
        tone: 'sonar',
        hasGenuineData: false,
        isUnavailable: false,
        isIllustrative: true,
        centerPoint: [-5.5, -3.8],
      }

    default:
      return {
        def,
        status: 'NO DATA',
        tone: 'dim',
        hasGenuineData: false,
        isUnavailable: true,
        isIllustrative: true,
      }
  }
}

function generateRing(center: [number, number], r: number, segments = 32): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * 2 * Math.PI
    points.push([center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)])
  }
  return points
}
