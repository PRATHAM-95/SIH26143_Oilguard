import { get } from '@/lib/http'

export type Bbox = [number, number, number, number]

/** One hourly sample from Open-Meteo (wind rows carry wind keys, waves rows wave keys). */
export type LiveWeatherRow = {
  time: string
  wind_speed_10m?: number | null
  wind_direction_10m?: number | null
  wind_gusts_10m?: number | null
  wave_height?: number | null
  wave_direction?: number | null
  wave_period?: number | null
  sea_surface_temperature?: number | null
}

/** GET /api/environment/live-weather response — live Open-Meteo snapshot. */
export type LiveWeatherSnapshot = {
  available: boolean
  source: string
  latitude: number
  longitude: number
  fetched_at: string | null
  reason?: string | null
  /** Present only when the feed is reachable. */
  wind?: { source: string; model: string; hourly: LiveWeatherRow[] }
  waves?: { source: string; model: string; hourly: LiveWeatherRow[] }
}

/** A single NASA EONET event retained by the marine-incident filter. */
export type LiveIncident = {
  id?: string
  title: string
  categories?: string[]
  geometry?: { type?: string; coordinates?: unknown }
  geometry_count?: number
  sources?: { id?: string; url?: string }[]
  closed?: string | null
}

/** GET /api/environment/incidents response. */
export type IncidentFeed = {
  available: boolean
  source: string
  fetched_at: string | null
  reason?: string | null
  event_count: number
  events: LiveIncident[]
}

/** GET /api/environment/depth response — live ETOPO1 bathymetry readout. */
export type DepthReading = {
  available: boolean
  source: string
  fetched_at: string | null
  reason?: string | null
  depth_m?: number | null
  elevation_m?: number | null
}

/**
 * Environment API — contracts frozen in SYSTEM_SPEC §15.1.
 * The live endpoints (Open-Meteo / NASA EONET / ETOPO1) were added in
 * Phase 5 (Live-Network Augmentation) and always return honest 200 payloads
 * with `available:false` + reason when a feed is unreachable.
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

  /** GET /api/environment/live-weather?lat=&lon= */
  liveWeather: async (lat: number, lon: number, signal?: AbortSignal) =>
    get<LiveWeatherSnapshot>(
      `/api/environment/live-weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      signal,
    ),

  /** GET /api/environment/incidents?west=&south=&east=&north= */
  incidents: async (bbox: Bbox, signal?: AbortSignal) =>
    get<IncidentFeed>(
      `/api/environment/incidents?west=${bbox[0]}&south=${bbox[1]}&east=${bbox[2]}&north=${bbox[3]}`,
      signal,
    ),

  /** GET /api/environment/depth?lat=&lon= */
  depth: async (lat: number, lon: number, signal?: AbortSignal) =>
    get<DepthReading>(
      `/api/environment/depth?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      signal,
    ),
}