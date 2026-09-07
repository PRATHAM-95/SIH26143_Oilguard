import { get, post } from '@/lib/http'

export type SarSource = 'AUTO' | 'LOCAL_FIXTURE' | 'SYNTHETIC' | 'CACHED_SENTINEL1' | 'REAL_SENTINEL1'

export type SarSlickCandidateDto = {
  candidate_id: string
  classification: 'OIL_CANDIDATE' | 'UNCERTAIN' | 'LOOK_ALIKE' | 'REJECTED'
  confidence: number
  /** GeoJSON exterior ring of [lon, lat] pairs, first == last. */
  polygon: [number, number][]
  centroid: [number, number]
  bbox: { north: number; south: number; east: number; west: number }
  area_km2: number
  perimeter_km: number
  length_km: number
  width_km: number
  aspect_ratio: number
  orientation_deg: number
  shape_factor: number
  pixel_area: number
  contrast_db: number | null
  incidence_deg: number | null
  look_alike_hints: string[]
  warnings: string[]
}

/** Scene evidence as reported by the scientific service (observed, not inferred). */
export type SarObservationDto = {
  observationId: string
  scientificObservationId?: string
  status: 'processing' | 'completed' | 'unavailable' | 'failed'
  sourceState: 'REAL_SENTINEL1' | 'CACHED_SENTINEL1' | 'LOCAL_FIXTURE' | 'SYNTHETIC' | 'UNAVAILABLE'
  source: string
  providerDataset: string
  acquisition_time?: string | null
  satellites: string[]
  polarization: string
  scene_id: string
  scene_footprint?: {
    type: 'Polygon'
    coordinates: [number, number][][]
  } | null
  detector: string
  detector_version: string
  candidates: SarSlickCandidateDto[]
  confidence: number | null
  slick_area_km2: number | null
  age_available: boolean
  age_estimate?: string | null
  warnings: string[]
  errors: string[]
  error?: string
}

export type SarDetectRequest = {
  source?: SarSource
  detector?: 'CLASSICAL' | 'ONNX'
  maxCandidates?: number
}

export const sarApi = {
  /** POST /api/simulation/{id}/sar/detect — run a SAR oil-spill observation. */
  detect: async (simulationId: string, req?: SarDetectRequest) =>
    post<SarObservationDto>(`/api/simulation/${simulationId}/sar/detect`, req ?? {}),

  /** GET /api/simulation/{id}/sar/observations — persisted observations (replay). */
  list: async (simulationId: string) =>
    get<SarObservationDto[]>(`/api/simulation/${simulationId}/sar/observations`),
}
