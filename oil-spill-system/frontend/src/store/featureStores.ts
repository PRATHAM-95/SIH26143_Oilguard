import { create } from 'zustand'
import type {
  AttributionState,
  AttributionVesselEntry,
  BacktrackingResultState,
  GroundTruthState,
  ReportState,
} from '@/types/domain'
import { attributionApi, backtrackApi, type AttributionRunDto, type RankedVesselDto, type BacktrackingDto } from '@/lib/api'
import type { AttributionWsEvent, BacktrackWsEvent } from '@/lib/ws'
import { useMapStore } from '@/store/mapStore'

// --- backtracking ---
type BacktrackingStoreState = BacktrackingResultState & {
  run: (simulationId: string, opts?: {
    durationHours?: number
    ensembleSize?: number
    particlesPerMember?: number
    environmentSource?: string
    seed?: number
  }) => Promise<void>
  loadRuns: (simulationId: string) => Promise<void>
  clear: () => void
  setResult: (patch: Partial<BacktrackingResultState>) => void
  applyWsEvent: (event: BacktrackWsEvent) => void
}

const backtrackingInitial: BacktrackingResultState = {
  runId: null,
  status: 'idle',
  origin: null,
  originTime: null,
  uncertaintyKm: null,
  confidence: null,
  sourceConcentration: null,
  environmentalQuality: null,
  trajectoryAgreement: null,
  ensembleStability: null,
  sourceRegion: null,
  sourceContours: null,
  originTimeRange: null,
  durationHours: null,
  ensembleSize: null,
  particlesPerMember: null,
  environmentSource: null,
  trajectories: null,
  ensembleSummary: null,
  quality: null,
  warnings: [],
  errors: [],
  busy: false,
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/** Convert a GeoJSON exterior ring [lon, lat][] for deck.gl. */
function ring(polygon?: { coordinates: [number, number][][] } | null): [number, number][] | null {
  if (!polygon?.coordinates?.[0]) return null
  return polygon.coordinates[0].map(([lon, lat]) => [lon, lat] as [number, number])
}

/** Switch on the primary backtracking map layers once a result is available. */
function enableBacktrackingLayers() {
  const s = useMapStore.getState()
  s.setLayer('backtracking', true)
  s.setLayer('sourceProbability', true)
  s.setLayer('uncertainty', true)
}

function fromDto(dto: BacktrackingDto): BacktrackingResultState {
  const origin = dto.origin_estimate ?? null
  const otr = dto.origin_time_range ?? null
  // Derive the effective duration from the reported source window span when the
  // backend does not echo it explicitly; fall back to the echoed value.
  const durationHours =
    otr && otr.earliest && otr.latest
      ? Math.max(0.5, (new Date(otr.latest).getTime() - new Date(otr.earliest).getTime()) / 3_600_000)
      : (dto.duration_hours ?? null)
  return {
    ...backtrackingInitial,
    runId: dto.backtrackRunId ?? null,
    status: dto.status === 'completed' ? 'completed' : 'failed',
    origin: origin ? { lon: origin.lon, lat: origin.lat } : null,
    originTime: otr?.preferred ?? null,
    uncertaintyKm: dto.uncertainty_km ?? null,
    confidence: dto.confidence?.trajectory_agreement ?? null,
    sourceConcentration: dto.confidence?.source_concentration ?? null,
    environmentalQuality: dto.confidence?.environmental_quality ?? null,
    trajectoryAgreement: dto.confidence?.trajectory_agreement ?? null,
    ensembleStability: dto.confidence?.ensemble_stability ?? null,
    sourceRegion: ring(dto.source_region),
    sourceContours: (dto.source_contours ?? []).map((c) => ({
      level: c.level,
      polygon: ring(c.polygon) ?? [],
    })),
    originTimeRange: otr,
    durationHours,
    ensembleSize: dto.ensemble_size ?? null,
    particlesPerMember: dto.particles_per_member ?? null,
    environmentSource: dto.environment_source ?? null,
    trajectories: dto.trajectories ?? null,
    ensembleSummary: dto.ensemble_summary ?? null,
    quality: dto.quality ?? null,
    warnings: dto.warnings ?? [],
    errors: dto.error ? [dto.error] : [],
    busy: false,
  }
}

export const useBacktrackingStore = create<BacktrackingStoreState>((set, get) => ({
  ...backtrackingInitial,

  run: async (simulationId, opts) => {
    set({ busy: true, status: 'running', errors: [], warnings: [] })
    try {
      const dto = await backtrackApi.run(simulationId, {
        durationHours: opts?.durationHours,
        ensembleSize: opts?.ensembleSize,
        particlesPerMember: opts?.particlesPerMember,
        environmentSource: opts?.environmentSource,
        seed: opts?.seed,
      })
      set({ ...fromDto(dto), busy: false })
      if (dto.status === 'completed') enableBacktrackingLayers()
    } catch (e) {
      set({ busy: false, status: 'failed', errors: [getErrorMessage(e)] })
    }
  },

  loadRuns: async (simulationId) => {
    try {
      const list = await backtrackApi.list(simulationId)
      const latest = list.length > 0 ? list[list.length - 1] : null
      if (latest && get().runId === latest.backtrackRunId) return
      if (latest) {
        set(fromDto(latest))
        if (latest.status === 'completed') enableBacktrackingLayers()
      }
    } catch (e) {
      set({ errors: [getErrorMessage(e)] })
    }
  },

  clear: () => set(backtrackingInitial),
  setResult: (patch) => set(patch),

  applyWsEvent: (event) => {
    switch (event.type) {
      case 'backtracking.started':
        set({ status: 'running', busy: true, errors: [], warnings: [] })
        break
      case 'backtracking.completed':
        set({ status: 'completed', busy: false })
        enableBacktrackingLayers()
        break
      case 'backtracking.failed':
        set({
          status: 'failed',
          busy: false,
          errors: [event.message ?? 'Backtracking failed.'],
        })
        break
      case 'origin_estimated':
        set({
          origin: event.origin ? { lon: event.origin.lon, lat: event.origin.lat } : null,
          uncertaintyKm: event.uncertainty_km ?? null,
          confidence: event.confidence ?? null,
        })
        break
      default:
        break
    }
  },
}))

// --- attribution (STEP 10) ---
type AttributionStoreState = AttributionState & {
  run: (
    simulationId: string,
    opts?: {
      backtrackRunId?: string
      aisSource?: string
      radiusKm?: number
      maxGapMin?: number
      seed?: number
      environmentSource?: string
    },
  ) => Promise<void>
  loadRuns: (simulationId: string) => Promise<void>
  loadProviders: () => Promise<void>
  clear: () => void
  applyWsEvent: (event: AttributionWsEvent) => void
}

const attributionInitial: AttributionState = {
  runId: null,
  status: 'idle',
  ranked: false,
  vessels: [],
  conclusion: null,
  ranking: null,
  weightsUsed: null,
  attributionModelVersion: null,
  sourceState: null,
  aisSource: null,
  origin: null,
  timeRange: null,
  releaseTime: null,
  vesselCount: null,
  kept: null,
  dropped: null,
  radiusKm: null,
  maxGapMin: null,
  aisQuery: null,
  providers: null,
  warnings: [],
  errors: [],
  busy: false,
}

/** Enable the attribution layer once a completed ranking is available. */
function enableAttributionLayers() {
  useMapStore.getState().setLayer('attribution', true)
}

function vesselFromDto(dto: RankedVesselDto): AttributionVesselEntry {
  const closest = dto.closest_position ?? dto.factor_evidence?.spatial?.position ?? null
  return {
    rank: dto.rank ?? 0,
    mmsi: dto.mmsi ?? null,
    name: dto.name ?? null,
    vesselType: dto.vessel_type ?? null,
    score: typeof dto.score === 'number' ? dto.score : null,
    factors: dto.factors ?? null,
    factorEvidence: dto.factor_evidence ?? null,
    dataQuality: dto.data_quality
      ? {
          reliability: dto.data_quality.reliability ?? null,
          notes: dto.data_quality.notes ?? [],
          messagesInWindow: dto.data_quality.messages_in_window ?? null,
          medianCadenceMin: dto.data_quality.median_cadence_min ?? null,
          interpolationFraction: dto.data_quality.interpolation_fraction ?? null,
          coverageGaps: dto.data_quality.coverage_gaps ?? null,
          anomalies: dto.data_quality.anomalies ?? [],
        }
      : null,
    minDistanceKm: dto.min_distance_km ?? null,
    timeOfClosestApproach: dto.time_of_closest_approach ?? null,
    closestPosition: closest && 'lon' in closest && 'lat' in closest
      ? { lon: Number(closest.lon), lat: Number(closest.lat) }
      : null,
  }
}

function fromAttributionDto(dto: AttributionRunDto): Partial<AttributionState> {
  const origin = dto.origin
  return {
    ...attributionInitial,
    runId: dto.attributionRunId ?? null,
    status: dto.status === 'completed' ? 'completed' : 'failed',
    ranked: dto.status === 'completed' && (dto.rankedVessels ?? []).length > 0,
    vessels: (dto.rankedVessels ?? []).map(vesselFromDto),
    conclusion: dto.conclusion ?? null,
    ranking: dto.ranking ?? null,
    weightsUsed: dto.weightsUsed ?? null,
    attributionModelVersion: dto.attributionModelVersion ?? dto.modelVersion ?? null,
    sourceState: dto.sourceState ?? null,
    aisSource: dto.aisSource ?? null,
    origin: origin ? { lon: Number(origin.lon), lat: Number(origin.lat) } : null,
    timeRange: dto.timeRange ?? null,
    releaseTime: dto.releaseTime ?? null,
    vesselCount: dto.aisQuery?.vesselCount ?? null,
    kept: dto.filter?.kept ?? null,
    dropped: dto.filter?.dropped ?? null,
    radiusKm: dto.radiusKm ?? null,
    maxGapMin: dto.maxGapMin ?? null,
    aisQuery: dto.aisQuery ?? null,
    warnings: dto.scoreWarnings?.length ? dto.scoreWarnings : (dto.warnings ?? []),
    errors: dto.errors ?? (dto.error ? [dto.error] : []),
    busy: false,
  }
}

export const useAttributionStore = create<AttributionStoreState>((set, get) => ({
  ...attributionInitial,

  run: async (simulationId, opts) => {
    set({ busy: true, status: 'running', errors: [], warnings: [], ranked: false })
    try {
      const dto = await attributionApi.run(simulationId, {
        backtrackRunId: opts?.backtrackRunId,
        aisSource: opts?.aisSource,
        radiusKm: opts?.radiusKm,
        maxGapMin: opts?.maxGapMin,
        seed: opts?.seed,
        environmentSource: opts?.environmentSource,
      })
      set({ ...fromAttributionDto(dto), busy: false })
      if (dto.status === 'completed') enableAttributionLayers()
    } catch (e) {
      set({ busy: false, status: 'failed', errors: [getErrorMessage(e)] })
    }
  },

  loadRuns: async (simulationId) => {
    try {
      const list = await attributionApi.list(simulationId)
      const latest = list.length > 0 ? list[list.length - 1] : null
      if (latest && get().runId === latest.attributionRunId) return
      if (latest) {
        set(fromAttributionDto(latest))
        if (latest.status === 'completed') enableAttributionLayers()
      }
    } catch (e) {
      set({ errors: [getErrorMessage(e)] })
    }
  },

  loadProviders: async () => {
    try {
      const report = await attributionApi.providers()
      set({ providers: report.ais ?? null })
    } catch (e) {
      set({ providers: null, errors: [getErrorMessage(e)] })
    }
  },

  clear: () => {
    set(attributionInitial)
    useMapStore.getState().setLayer('attribution', false)
  },

  applyWsEvent: (event) => {
    switch (event.type) {
      case 'ais_search.started':
        set({ status: 'running', busy: true, aisSource: event.aisSource ?? null, errors: [] })
        break
      case 'ais_search.completed':
        set({
          vesselCount: event.vesselCount ?? null,
          aisQuery:
            event.result && 'elapsedMs' in event.result
              ? (event.result as AttributionState['aisQuery'])
              : null,
        })
        break
      case 'ais_search.failed':
        set({ status: 'failed', busy: false, errors: [event.message ?? 'AIS search failed.'] })
        break
      case 'vessels_filtered':
        set({ kept: event.kept ?? null, dropped: event.dropped ?? null })
        break
      case 'attribution.started':
        set({ status: 'running', busy: true })
        break
      case 'vessel_scores_ready':
        set({
          vessels:
            Array.isArray(event.rankedVessels)
              ? (event.rankedVessels as RankedVesselDto[]).map(vesselFromDto)
              : [],
          weightsUsed:
            event.weightsUsed && typeof event.weightsUsed === 'object'
              ? (event.weightsUsed as Record<string, number>)
              : null,
        })
        break
      case 'attribution.completed':
        if (event.result) {
          const patch = fromAttributionDto(event.result as unknown as AttributionRunDto)
          set({ ...patch, busy: false })
        } else {
          set({
            status: 'completed',
            busy: false,
            conclusion:
              event.conclusion === 'candidate' || event.conclusion === 'inconclusive'
                ? event.conclusion
                : null,
          })
        }
        enableAttributionLayers()
        break
      default:
        break
    }
  },
}))

// --- ground truth ---
type GroundTruthStoreState = GroundTruthState & {
  reveal: () => void
}

export const useGroundTruthStore = create<GroundTruthStoreState>((set) => ({
  locked: true,
  revealed: false,
  actualOrigin: null,
  reveal: () => set({ locked: false, revealed: true }),
}))

// --- report ---
type ReportStoreState = ReportState & {
  markGenerated: () => void
}

export const useReportStore = create<ReportStoreState>((set) => ({
  generated: false,
  markGenerated: () => set({ generated: true }),
}))