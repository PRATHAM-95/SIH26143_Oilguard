import { post, get } from '@/lib/http'

export type BacktrackForcing = {
  u?: number
  v?: number
}

/** Response from Spring Boot POST /api/simulation/{id}/backtrack — mirrors the
 *  FastAPI /api/backtrack response plus a persisted backtrackRunId. */
export type BacktrackingDto = {
  backtrackRunId: string
  run_id: string
  status: 'completed' | 'failed'
  duration_hours?: number | null
  ensemble_size?: number | null
  particles_per_member?: number | null
  environment_source?: string | null
  sarObservationId?: string | null
  source_region?: {
    type: 'Polygon'
    coordinates: [number, number][][]
  } | null
  source_contours?: Array<{
    level: number
    polygon: { type: 'Polygon'; coordinates: [number, number][][] }
  }> | null
  origin_estimate?: { lon: number; lat: number } | null
  origin_time_range?: {
    earliest: string
    latest: string
    preferred: string
  } | null
  uncertainty_km?: number | null
  confidence?: {
    source_concentration: 'HIGH' | 'MEDIUM' | 'LOW'
    environmental_quality: 'HIGH' | 'MEDIUM' | 'LOW'
    trajectory_agreement: number
    ensemble_stability: number
  } | null
  trajectories?: Array<{
    member: number
    particle?: number
    wind_drift_factor: number
    endpoints: { lon: number; lat: number }[]
  }>
  ensemble_summary?: {
    member_count: number
    converged_count: number
    mean_endpoint_distance_km: number
    std_endpoint_distance_km: number
  } | null
  quality?: {
    total_particles: number
    converged_particles: number
    land_hits: number
    domain_exits: number
    invalid_particles: number
    warnings: string[]
  } | null
  warnings: string[]
  error?: string
}

export type BacktrackRequest = {
  durationHours?: number
  ensembleSize?: number
  particlesPerMember?: number
  environmentSource?: string
  seed?: number
  currents?: BacktrackForcing
  wind?: BacktrackForcing
}

export const backtrackApi = {
  /** POST /api/simulation/{id}/backtrack — run ensemble backward trajectory. */
  run: async (simulationId: string, req?: BacktrackRequest): Promise<BacktrackingDto> =>
    post<BacktrackingDto>(`/api/simulation/${simulationId}/backtrack`, req ?? {}),

  /** GET /api/simulation/{id}/backtrack — persisted runs (replay). */
  list: async (simulationId: string): Promise<BacktrackingDto[]> =>
    get<BacktrackingDto[]>(`/api/simulation/${simulationId}/backtrack/runs`),
}
