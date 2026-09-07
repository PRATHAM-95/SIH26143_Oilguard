import { get, post } from '@/lib/http'

export type LatLng = { lat: number; lon: number }

export type Region = { north: number; south: number; east: number; west: number }

export type VesselPositionDto = { latitude: number; longitude: number }

export type VesselDto = {
  id: string
  mmsi: string
  name: string
  type: string
  position: VesselPositionDto
  speed: number
  heading: number
}

export type SimulationDto = {
  simulationId: string
  status: string
  mode?: string
  clock: string | null
  vessels?: VesselDto[]
  spillEvent?: unknown
  incident?: unknown
  investigation?: unknown
}

/**
 * Simulation API — contracts frozen in SYSTEM_SPEC §15.1. Implemented by the
 * Spring Boot backend in Step 04.
 */
export const simulationApi = {
  /** POST /api/simulation */
  createSimulation: async (payload: { region: Region; mode: 'captain' | 'investigation' }) =>
    post<{ simulationId: string; status: string; clock: string }>('/api/simulation', payload),

  /** GET /api/simulation/{id} */
  getSimulation: async (id: string) => get<SimulationDto>(`/api/simulation/${id}`),

  /** POST /api/simulation/{id}/start */
  startSimulation: async (id: string) =>
    post<{ simulationId: string; status: string; clock: string | null }>(
      `/api/simulation/${id}/start`,
    ),

  /** POST /api/simulation/{id}/advance */
  advanceSimulation: async (id: string, hours: number) =>
    post<{ clock: string; particles: unknown[] }>(`/api/simulation/${id}/advance`, { hours }),
}

export type ForwardDriftRequest = {
  durationHours?: number
  oilType?: string
  particleCount?: number
  environmentSource?: 'CONTROLLED' | 'CMEMS' | 'ERA5' | 'REAL' | 'CMEMS_ERA5' | string
  currents?: { u: number; v: number }
  wind?: { u: number; v: number }
}

export type ForwardDriftResponse = {
  driftRunId: string
  particles: { lon: number; lat: number; mass_kg: number }[]
  extent: { type: 'Polygon'; coordinates: [number, number][][] } | null
  massBalance: { evaporated_kg: number; dispersed_kg: number; remaining_kg: number }
  driftRun: {
    run_id?: string
    timestep_seconds?: number
    duration_hours?: number
    environment_source?: string
    environment_dataset?: string
    model_version?: string
    reproducibility_digest?: string
  }
  error?: string
  status?: string
}

export const driftApi = {
  /** POST /api/simulation/{id}/forward-drift — run forward oil drift (task §13). */
  runForwardDrift: async (id: string, req?: ForwardDriftRequest) =>
    post<ForwardDriftResponse>(`/api/simulation/${id}/forward-drift`, req ?? {}),
}