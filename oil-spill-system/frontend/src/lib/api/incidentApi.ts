import { get } from '@/lib/http'

export type IncidentDto = {
  slick: {
    geometry: unknown
    area_km2: number
    centroid: { lat: number; lon: number }
    orientation: number
  }
  environment: Record<string, unknown>
}

/**
 * Incident API — contracts frozen in SYSTEM_SPEC §15.1.
 * NOTE: not implemented server-side yet; interface-ready only.
 */
export const incidentApi = {
  /** GET /api/incidents/{id} */
  get: async (id: string) => get<IncidentDto>(`/api/incidents/${id}`),
}