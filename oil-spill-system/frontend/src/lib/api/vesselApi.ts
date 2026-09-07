import { get, post } from '@/lib/http'

export type VesselPosition = { latitude: number; longitude: number }

export type VesselDto = {
  id: string
  mmsi: string
  name: string
  type: string
  position: VesselPosition
  speed: number
  heading: number
}

/**
 * Vessel API — contracts frozen in SYSTEM_SPEC §15.1.
 * NOTE: not implemented server-side yet; interface-ready only.
 */
export const vesselApi = {
  /** GET /api/simulation/{id}/vessels */
  list: async (simulationId: string) =>
    get<{ vessels: VesselDto[] }>(`/api/simulation/${simulationId}/vessels`),

  /** POST /api/simulation/{id}/vessels/{vesselId}/move */
  move: async (
    simulationId: string,
    vesselId: string,
    body: { latitude: number; longitude: number; speed: number; heading: number },
  ) =>
    post<{ position: VesselPosition; timestamp: string }>(
      `/api/simulation/${simulationId}/vessels/${vesselId}/move`,
      body,
    ),

  /** POST /api/simulation/{id}/vessels/{vesselId}/spill */
  spill: async (
    simulationId: string,
    vesselId: string,
    body: { type: 'accidental' | 'illegal'; oilType: string; quantityKg: number },
  ) =>
    post<{ spillEventId: string; incidentId: string; location: VesselPosition }>(
      `/api/simulation/${simulationId}/vessels/${vesselId}/spill`,
      body,
    ),
}