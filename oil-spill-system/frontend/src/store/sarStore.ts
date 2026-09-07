import { create } from 'zustand'
import type { SarObservationState, SarCandidateState, SarProvenance } from '@/types/domain'
import { sarApi, type SarObservationDto } from '@/lib/api'
import type { SarWsEvent } from '@/lib/ws'

const INITIAL: SarObservationState = {
  status: 'idle',
  active: false,
  observationId: null,
  provenance: null,
  source: null,
  providerDataset: null,
  acquisitionTime: null,
  satellites: [],
  polarization: null,
  sceneId: null,
  footprint: null,
  candidates: [],
  confidence: null,
  slickAreaKm2: null,
  ageAvailable: false,
  ageEstimate: null,
  detector: null,
  detectorVersion: null,
  warnings: [],
  errors: [],
  busy: false,
}

type SarStoreState = SarObservationState & {
  detect: (simulationId: string, source?: string) => Promise<void>
  loadObservation: (simulationId: string) => Promise<void>
  reset: () => void
  applyWsEvent: (event: SarWsEvent) => void
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/** Convert a candidate polygon ring [lon,lat][] for deck.gl. */
function ring(dto: { polygon: [number, number][] }): [number, number][] {
  return dto.polygon.map(([lon, lat]) => [lon, lat])
}

function fromDto(dto: SarObservationDto): SarObservationState {
  const footprint = dto.scene_footprint?.coordinates?.[0]
    ? (dto.scene_footprint.coordinates[0] as [number, number][]).map(([lon, lat]) => [lon, lat] as [number, number])
    : null

  const candidates: SarCandidateState[] = (dto.candidates ?? []).map((c) => ({
    id: c.candidate_id,
    classification: c.classification,
    confidence: c.confidence,
    polygon: ring(c),
    centroid: { lon: c.centroid[0], lat: c.centroid[1] },
    areaKm2: c.area_km2,
    lengthKm: c.length_km,
    widthKm: c.width_km,
    aspectRatio: c.aspect_ratio,
    contrastDb: c.contrast_db ?? null,
    incidenceDeg: c.incidence_deg ?? null,
    hints: c.look_alike_hints ?? [],
    warnings: c.warnings ?? [],
  }))

  return {
    ...INITIAL,
    status: dto.status,
    active: dto.status === 'processing',
    observationId: dto.observationId,
    provenance: (dto.sourceState as SarProvenance) ?? null,
    source: dto.source ?? null,
    providerDataset: dto.providerDataset ?? null,
    acquisitionTime: dto.acquisition_time ?? null,
    satellites: dto.satellites ?? [],
    polarization: dto.polarization ?? null,
    sceneId: dto.scene_id ?? null,
    footprint,
    candidates,
    confidence: dto.confidence,
    slickAreaKm2: dto.slick_area_km2,
    ageAvailable: dto.age_available,
    ageEstimate: dto.age_estimate ?? null,
    detector: dto.detector ?? null,
    detectorVersion: dto.detector_version ?? null,
    warnings: dto.warnings ?? [],
    errors: dto.errors ?? [],
    busy: false,
  }
}

export const useSarStore = create<SarStoreState>((set, get) => ({
  ...INITIAL,

  detect: async (simulationId, source = 'LOCAL_FIXTURE') => {
    set({ busy: true, active: true, status: 'processing', errors: [] })
    try {
      const dto = await sarApi.detect(simulationId, { source: source as never })
      set(fromDto(dto))
    } catch (e) {
      set({ busy: false, active: false, status: 'failed', errors: [getErrorMessage(e)] })
    }
  },

  loadObservation: async (simulationId) => {
    try {
      const list = await sarApi.list(simulationId)
      const latest = list.length > 0 ? list[list.length - 1] : null
      if (latest && get().observationId === latest.observationId) return
      if (latest) set(fromDto(latest))
    } catch (e) {
      set({ errors: [getErrorMessage(e)] })
    }
  },

  reset: () => set({ ...INITIAL }),

  applyWsEvent: (event) => {
    switch (event.type) {
      case 'sar_observation.started':
        set({ active: true, status: 'processing', busy: true, errors: [] })
        break
      case 'sar_observation.completed':
        if (event.sarResult) {
          set(fromDto(event.sarResult as unknown as SarObservationDto))
        } else {
          set({ active: false, status: 'completed', busy: false })
        }
        break
      case 'sar_observation.failed':
        set({
          active: false,
          status: 'failed',
          busy: false,
          errors: [event.message ?? 'SAR observation failed.'],
        })
        break
      default:
        break
    }
  },
}))
