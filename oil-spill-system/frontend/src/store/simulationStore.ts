import { create } from 'zustand'
import type {
  SimulationState,
  IntegratedVessel,
  SpillEventState,
  DriftRunState,
} from '@/types/domain'
import { simulationApi, vesselApi, driftApi, type Region, type VesselDto } from '@/lib/api'
import type { SimulationWsEvent } from '@/lib/ws'

export type TrailPoint = { lon: number; lat: number; t: string }

/** Per-vessel position history, recorded only from live WS / API responses. */
export type TrailMap = Record<string, TrailPoint[]>

export const MAX_TRAIL_POINTS = 240

type SimulationStoreState = SimulationState & {
  trails: TrailMap
  recordTrail: (vesselId: string, point: TrailPoint) => void
  createSimulation: (region?: Region) => Promise<void>
  start: () => Promise<void>
  advance: (hours: number) => Promise<void>
  releaseSpill: () => Promise<void>
  runForwardDrift: () => Promise<void>
  moveSelectedVessel: (payload: { latitude: number; longitude: number; speed: number; heading: number }) => Promise<void>
  selectVessel: (id: string) => void
  setVessels: (vessels: IntegratedVessel[]) => void
  refreshState: () => Promise<void>
  reset: () => void
  applyWsEvent: (event: SimulationWsEvent) => void
}

export const DEFAULT_REGION: Region = { north: 25, south: -10, east: 100, west: 50 }

const ACTIVE_SIM_KEY = 'sih-oilspill.active-simulation'
const SPILL_INCIDENT_PREFIX = 'sih-oilspill.spilled-incident'

export function rememberActiveSimulation(id: string): void {
  sessionStorage.setItem(ACTIVE_SIM_KEY, id)
}

export function activeSimulationId(): string | null {
  return sessionStorage.getItem(ACTIVE_SIM_KEY)
}

/**
 * The backend GET /api/simulation/{id} DTO exposes the spill event geometry but
 * NOT the incident identifier (that only appears on the POST /spill response).
 * To survive a reload (which would otherwise lock "Start investigation"), the
 * incident id is persisted here per simulation and restored during hydration.
 */
export function rememberSpillToIncident(simulationId: string, incidentId: string): void {
  try {
    sessionStorage.setItem(`${SPILL_INCIDENT_PREFIX}.${simulationId}`, incidentId)
  } catch {
    // persistence unavailable; hydration falls back to null
  }
}

export function spilledIncidentId(simulationId: string): string | null {
  try {
    return sessionStorage.getItem(`${SPILL_INCIDENT_PREFIX}.${simulationId}`)
  } catch {
    return null
  }
}

/**
 * Wipe all persisted simulation memory from sessionStorage — the active-sim
 * handle plus every spilled-incident binding. Used by the workspace reset so a
 * fresh case never leaks the previous one across reloads.
 */
export function clearSimulationMemory(): void {
  try {
    sessionStorage.removeItem(ACTIVE_SIM_KEY)
    const doomed: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(SPILL_INCIDENT_PREFIX)) doomed.push(key)
    }
    doomed.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // storage unavailable — reset is still honest at the API layer
  }
}

type SpillEventDto = {
  spillEventId: string
  incidentId?: string
  vesselId?: string | null
  time?: string | null
  oilType?: string | null
  quantityKg?: number | null
  type?: string | null
  location?: { latitude: number; longitude: number } | null
}

function isSpillEventDto(v: unknown): v is SpillEventDto {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.spillEventId === 'string' && e.spillEventId.length > 0
}

export const EMPTY_SPILL: SpillEventState = {
  spillEventId: null,
  incidentId: null,
  vesselId: null,
  location: null,
  time: null,
  oilType: null,
  quantityKg: null,
  type: null,
}

export const EMPTY_DRIFT: DriftRunState = {
  runId: null,
  status: 'idle',
  particles: [],
  extent: null,
  massBalance: null,
  environmentSource: null,
  environmentDataset: null,
  modelVersion: null,
  oilType: null,
  durationHours: null,
  particleCount: null,
  timestepSeconds: null,
  error: null,
}

const initial: Omit<
  SimulationStoreState,
  | 'createSimulation'
  | 'start'
  | 'advance'
  | 'releaseSpill'
  | 'runForwardDrift'
  | 'moveSelectedVessel'
  | 'selectVessel'
  | 'setVessels'
  | 'refreshState'
  | 'reset'
  | 'applyWsEvent'
  | 'recordTrail'
> = {
  simulationId: activeSimulationId(),
  status: null,
  active: false,
  clock: null,
  selectedVesselId: null,
  vessels: [],
  trails: {},
  spill: EMPTY_SPILL,
  drift: { ...EMPTY_DRIFT },
  error: null,
  busy: false,
}

/** Convert backend vessel DTO (position {latitude, longitude}) to UI model ({lon, lat}). */
export function vesselDtoToIntegrated(v: VesselDto): IntegratedVessel {
  return {
    id: v.id,
    name: v.name,
    mmsi: v.mmsi,
    type: v.type,
    position: { lon: v.position.longitude, lat: v.position.latitude },
    speed: v.speed,
    heading: v.heading,
  }
}

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  ...initial,

  recordTrail: (vesselId, point) =>
    set((s) => {
      const prev = s.trails[vesselId] ?? []
      const next = prev.length >= MAX_TRAIL_POINTS ? [...prev.slice(prev.length - MAX_TRAIL_POINTS + 1), point] : [...prev, point]
      return { trails: { ...s.trails, [vesselId]: next } }
    }),

  createSimulation: async (region = DEFAULT_REGION) => {
    set({ busy: true, error: null })
    try {
      const res = await simulationApi.createSimulation({ region, mode: 'captain' })
      rememberActiveSimulation(res.simulationId)
      set({
        simulationId: res.simulationId,
        status: res.status as SimulationState['status'],
        clock: res.clock ?? null,
        active: false,
        vessels: [],
        selectedVesselId: null,
        trails: {},
        spill: { ...EMPTY_SPILL },
        drift: { ...EMPTY_DRIFT },
        busy: false,
      })
      const list = await vesselApi.list(res.simulationId)
      set({ vessels: list.vessels.map(vesselDtoToIntegrated) })
    } catch (e) {
      set({ busy: false, error: getErrorMessage(e), simulationId: null })
    }
  },

  start: async () => {
    const id = get().simulationId
    if (!id) {
      set({ error: 'Create a simulation before starting.' })
      return
    }
    set({ busy: true, error: null })
    try {
      const res = await simulationApi.startSimulation(id)
      set({
        status: res.status as SimulationState['status'],
        active: true,
        clock: res.clock ?? get().clock,
        busy: false,
      })
    } catch (e) {
      set({ busy: false, active: false, error: getErrorMessage(e) })
    }
  },

  advance: async (hours) => {
    const id = get().simulationId
    if (!id) {
      set({ error: 'Create a simulation before advancing time.' })
      return
    }
    set({ busy: true, error: null })
    try {
      await simulationApi.advanceSimulation(id, hours)
      // Clock/vessel updates typically arrive via WS; a fallback refetch keeps
      // the UI correct even if a WS is momentarily out.
      set({ busy: false })
      await get().refreshState()
    } catch (e) {
      set({ busy: false, error: getErrorMessage(e) })
    }
  },

  releaseSpill: async () => {
    const id = get().simulationId
    const vesselId = get().selectedVesselId
    if (!id) {
      set({ error: 'Create a simulation before releasing a spill.' })
      return
    }
    if (!vesselId) {
      set({ error: 'Select a vessel to release the spill from.' })
      return
    }
    set({ busy: true, error: null })
    try {
      const res = await vesselApi.spill(id, vesselId, {
        type: 'accidental',
        oilType: 'GENERIC CRUDE',
        quantityKg: 5000,
      })
      set({
        spill: {
          ...EMPTY_SPILL,
          spillEventId: res.spillEventId,
          incidentId: res.incidentId,
          vesselId,
          location: { lon: res.location.longitude, lat: res.location.latitude },
        },
        status: 'observation',
        busy: false,
      })
      rememberSpillToIncident(id, res.incidentId)
    } catch (e) {
      set({ busy: false, error: getErrorMessage(e) })
    }
  },

  runForwardDrift: async () => {
    const id = get().simulationId
    const spill = get().spill
    if (!id || !spill?.spillEventId) {
      set({
        error: 'Release a spill before running forward drift.',
        drift: { ...EMPTY_DRIFT, status: 'failed', error: 'No spill released yet.' },
      })
      return
    }
    set({
      busy: true,
      error: null,
      drift: {
        ...get().drift,
        status: 'running' as const,
        error: null,
        oilType: spill.oilType ?? 'GENERIC CRUDE',
      },
    })
    try {
      const res = await driftApi.runForwardDrift(id, {
        durationHours: 6,
        particleCount: 500,
        oilType: spill.oilType ?? 'GENERIC CRUDE',
        // LIVE = real Open-Meteo 10 m wind (no credentials). The scientific
        // service falls back to the deterministic CONTROLLED field — labelled
        // honestly in drift.environmentSource — whenever the feed is offline.
        environmentSource: 'LIVE',
        currents: { u: 0.5, v: 0 },
        wind: { u: 2, v: 0 },
      })
      if (res.error) {
        set({
          busy: false,
          drift: { ...get().drift, status: 'failed', error: res.error, runId: res.driftRunId },
        })
        return
      }
      const dr = res.driftRun ?? {}
      const extentRing =
        res.extent && res.extent.coordinates?.length ? (res.extent.coordinates[0] as [number, number][]) : null
      set({
        busy: false,
        status: 'observation',
        drift: {
          runId: res.driftRunId,
          status: 'completed',
          particles: res.particles.map((p) => ({
            lon: p.lon,
            lat: p.lat,
            massKg: p.mass_kg,
          })),
          extent: extentRing,
          massBalance: {
            evaporatedKg: res.massBalance?.evaporated_kg ?? 0,
            dispersedKg: res.massBalance?.dispersed_kg ?? 0,
            remainingKg: res.massBalance?.remaining_kg ?? 0,
          },
          environmentSource: dr.environment_source ?? 'CONTROLLED',
          environmentDataset: dr.environment_dataset ?? 'CONTROLLED TEST FIELD',
          modelVersion: dr.model_version ?? null,
          oilType: spill.oilType ?? 'GENERIC CRUDE',
          durationHours: res.driftRun?.duration_hours ?? 6,
          particleCount: 500,
          timestepSeconds: res.driftRun?.timestep_seconds ?? null,
          error: null,
        },
      })
    } catch (e) {
      set({
        busy: false,
        error: getErrorMessage(e),
        drift: { ...get().drift, status: 'failed', error: getErrorMessage(e) },
      })
    }
  },

  moveSelectedVessel: async (payload) => {
    const id = get().simulationId
    const vesselId = get().selectedVesselId
    if (!id || !vesselId) {
      set({ error: 'Select a vessel before moving it.' })
      return
    }
    set({ busy: true, error: null })
    try {
      await vesselApi.move(id, vesselId, payload)
      set((s) => ({
        busy: false,
        vessels: s.vessels.map((v) =>
          v.id === vesselId
            ? {
                ...v,
                position: { lon: payload.longitude, lat: payload.latitude },
                speed: payload.speed,
                heading: payload.heading,
              }
            : v,
        ),
      }))
      get().recordTrail(vesselId, {
        lon: payload.longitude,
        lat: payload.latitude,
        t: get().clock ?? new Date().toISOString(),
      })
    } catch (e) {
      set({ busy: false, error: getErrorMessage(e) })
    }
  },

  selectVessel: (id) => set({ selectedVesselId: id, error: null }),

  setVessels: (vessels) => set({ vessels }),

  refreshState: async () => {
    const id = get().simulationId
    if (!id) return
    try {
      const dto = await simulationApi.getSimulation(id)
      const spillEvent = dto.spillEvent
      let spill = get().spill
      if (isSpillEventDto(spillEvent)) {
        const location = spillEvent.location
        spill = {
          spillEventId: spillEvent.spillEventId,
          incidentId: spilledIncidentId(id) ?? get().spill?.incidentId ?? null,
          vesselId: spillEvent.vesselId ?? null,
          location: location ? { lon: location.longitude, lat: location.latitude } : null,
          time: spillEvent.time ?? null,
          oilType: spillEvent.oilType ?? null,
          quantityKg: spillEvent.quantityKg ?? null,
          type: spillEvent.type ?? null,
        }
      }
      set({
        status: dto.status as SimulationState['status'],
        clock: dto.clock,
        vessels: (dto.vessels ?? []).map(vesselDtoToIntegrated),
        spill,
      })
    } catch {
      // ignore transient refresh failures
    }
  },

  reset: () => set({ ...initial }),

  applyWsEvent: (event) => {
    switch (event.type) {
      case 'clock_update':
        set({ clock: event.time })
        break
      case 'vessel_moved':
        set((s) => {
          const point: TrailPoint = {
            lon: event.position.lon,
            lat: event.position.lat,
            t: s.clock ?? get().clock ?? new Date().toISOString(),
          }
          const prev = s.trails[event.vesselId] ?? []
          const next =
            prev.length >= MAX_TRAIL_POINTS
              ? [...prev.slice(prev.length - MAX_TRAIL_POINTS + 1), point]
              : [...prev, point]
          return {
            vessels: s.vessels.map((v) =>
              v.id === event.vesselId
                ? {
                    ...v,
                    position: { lon: event.position.lon, lat: event.position.lat },
                    speed: event.speed,
                    heading: event.heading,
                  }
                : v,
            ),
            trails: { ...s.trails, [event.vesselId]: next },
          }
        })
        break
      case 'spill_released':
        set((s) => {
          const existing = s.spill ?? EMPTY_SPILL
          const simId = get().simulationId
          const remembered = simId ? spilledIncidentId(simId) : null
          return {
            status: 'observation' as const,
            spill: {
              spillEventId: event.spillEventId,
              incidentId: existing.incidentId ?? remembered,
              vesselId: event.vesselId,
              location: { lon: event.location.lon, lat: event.location.lat },
              time: existing.time,
              oilType: existing.oilType,
              quantityKg: existing.quantityKg,
              type: existing.type,
            },
          }
        })
        break
      case 'oil_particles':
        set((s) => ({
          drift: {
            ...s.drift,
            particles: event.particles.map((p) => ({
              lon: p.lon,
              lat: p.lat,
              massKg: 100 + p.opacity * 1000,
            })),
          },
        }))
        break
      case 'forward_drift.started':
        set((s) => ({
          busy: true,
          drift: { ...s.drift, status: 'running', error: null },
        }))
        break
      case 'forward_drift.completed':
        set((s) => ({
          busy: false,
          drift: { ...s.drift, status: 'completed', runId: event.forwardDriftRunId, error: null },
        }))
        break
      case 'forward_drift.failed':
        set((s) => ({
          busy: false,
          drift: { ...s.drift, status: 'failed', error: event.message ?? 'Forward drift failed.' },
        }))
        break
      default:
        break
    }
  },
}))

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}