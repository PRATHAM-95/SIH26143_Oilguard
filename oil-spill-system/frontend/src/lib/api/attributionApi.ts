import { post, get } from '@/lib/http'

export type AttributionFactorKey = 'spatial' | 'temporal' | 'trajectory' | 'anomaly' | 'environmental'

/** Per-factor evidence block from the scientific service (snake_case, verbatim). */
export type AttributionFactorEvidence = {
  note?: string
  weight?: number
  distance_km?: number
  position?: { lon: number; lat: number }
  signals?: string[]
  [key: string]: unknown
}

export type RankedVesselDto = {
  rank?: number
  mmsi?: string | null
  name?: string | null
  vessel_type?: string | null
  imo?: string | null
  score: number
  factors?: Record<AttributionFactorKey, number> | null
  factor_evidence?: Partial<Record<AttributionFactorKey, AttributionFactorEvidence>> | null
  data_quality?: {
    reliability?: string | null
    notes?: string[]
    messages_in_window?: number | null
    median_cadence_min?: number | null
    interpolation_fraction?: number | null
    coverage_gaps?: number | null
    anomalies?: string[]
  } | null
  min_distance_km?: number | null
  time_of_closest_approach?: string | null
  closest_position?: { lon: number; lat: number } | null
  warnings?: string[]
}

export type AttributionRankingDto = {
  top_score: number
  second_score: number
  margin: number
  decisive: boolean
}

/** Run response shape shared by POST /run, GET /runs and GET /runs/{id}. */
export type AttributionRunDto = {
  attributionRunId: string
  simulationId?: string
  backtrackRunId?: string | null
  status: 'started' | 'completed' | 'failed'
  aisSource?: string
  sourceState?: string | null
  attributionModelVersion?: string | null
  modelVersion?: string | null
  weightsUsed?: Record<string, number> | null
  conclusion?: 'candidate' | 'inconclusive' | null
  ranking?: AttributionRankingDto | null
  rankedVessels?: RankedVesselDto[] | null
  warnings?: string[]
  scoreWarnings?: string[]
  errors?: string[]
  origin?: { lat: number; lon: number } | null
  timeRange?: { earliest: string; latest: string; preferred: string } | null
  releaseTime?: string | null
  radiusKm?: number | null
  maxGapMin?: number | null
  seed?: number | null
  environmentSource?: string | null
  aisQuery?: {
    sourceState?: string
    provider?: string
    dataset?: string
    vesselCount?: number
    elapsedMs?: number
    warnings?: string[]
  } | null
  filter?: {
    kept?: number
    dropped?: number
    stats?: unknown
    droppedVessels?: unknown
  } | null
  createdAt?: string | null
  error?: string
}

export type AttributionRequest = {
  backtrackRunId?: string
  aisSource?: string
  radiusKm?: number
  maxGapMin?: number
  seed?: number
  environmentSource?: string
  currents?: { u: number; v: number }
  wind?: { u: number; v: number }
}

export type AisProviderReport = {
  ais?: Record<
    string,
    {
      status?: string
      state?: string
      note?: string
      dataset?: string
      seed?: number
    }
  >
}

export const attributionApi = {
  /** POST /api/attribution/run — run the AIS query → filter → scoring pipeline. */
  run: (simulationId: string, req?: AttributionRequest): Promise<AttributionRunDto> =>
    post<AttributionRunDto>(`/api/attribution/run`, { simulationId, ...req }),

  /** GET /api/attribution/runs?simulationId= — persisted runs (replay). */
  list: (simulationId: string): Promise<AttributionRunDto[]> =>
    get<AttributionRunDto[]>(`/api/attribution/runs?simulationId=${encodeURIComponent(simulationId)}`),

  /** GET /api/attribution/runs/{runId} — a single persisted run. */
  get: (runId: string): Promise<AttributionRunDto> =>
    get<AttributionRunDto>(`/api/attribution/runs/${encodeURIComponent(runId)}`),

  /** GET /api/attribution/providers — honest AIS provider availability. */
  providers: (): Promise<AisProviderReport> => get<AisProviderReport>(`/api/attribution/providers`),
}