import { get } from '@/lib/http'

export type Bbox = [number, number, number, number]

/**
 * Environment API — contracts frozen in SYSTEM_SPEC §15.1.
 * NOTE: not implemented server-side yet; interface-ready only.
 */
export const environmentApi = {
  /** GET /api/environment/current */
  currents: async (params: { simulationId: string; bbox: Bbox; time: string }) =>
    get<{ source: string; fields: { lat: number; lon: number; u: number; v: number }[] }>(
      `/api/environment/current?simulationId=${params.simulationId}&bbox=${params.bbox.join(',')}&time=${encodeURIComponent(params.time)}`,
    ),

  /** GET /api/environment/wind */
  wind: async (params: { simulationId: string; bbox: Bbox; time: string }) =>
    get<{ source: string; fields: { lat: number; lon: number; u: number; v: number }[] }>(
      `/api/environment/wind?simulationId=${params.simulationId}&bbox=${params.bbox.join(',')}&time=${encodeURIComponent(params.time)}`,
    ),
}