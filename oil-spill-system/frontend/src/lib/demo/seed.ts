import type {
  Region,
  VesselDto,
  ForwardDriftResponse,
  SarObservationDto,
  SarSlickCandidateDto,
  BacktrackingDto,
  AttributionRunDto,
  RankedVesselDto,
  AisProviderReport,
} from '@/lib/api'
import type { SimulationDto } from '@/lib/api/simulationApi'
import type {
  InvestigationDto,
  RevealResponse,
  InvestigationReport,
} from '@/lib/api/investigationApi'
import type { HealthInfo, PythonPing } from '@/lib/api/healthApi'
import type { InvestigationStageState, InvestigationSummaryState } from '@/types/domain'

/**
 * Deterministic synthetic fixtures for CONTROLLED DEMO mode.
 *
 * Nothing here claims to be real: vessel identities, coordinates, timestamps,
 * weather and spill facts are all labelled synthetic. Every value derives from
 * fixed constants / a seeded PRNG (never Date.now()), so the same activation
 * plus interaction produces identical output on every run.
 *
 * Imported by the demo REST adapter and by the demo gateway hooks. MUST NOT
 * import any store module (the scalar http -> adapter -> seed path would form
 * an import cycle with investigationStore).
 */

export const DEMO_SEED = 42

/** Mirrors DEFAULT_REGION (guarded by a contract test). */
export const DEMO_REGION: Region = { north: 25, south: -10, east: 100, west: 50 }

/** Synthetic scenario identifiers — deterministic, never collide. */
export const DEMO_SIMULATION_ID = 'DEMO-SIM-0001'
export const DEMO_INCIDENT_ID = 'DEMO-INC-0001'
export const DEMO_INVESTIGATION_ID = 'DEMO-INV-0001'
export const DEMO_SPILL_EVENT_ID = 'DEMO-SPL-0001'
export const DEMO_SAR_OBSERVATION_ID = 'DEMO-SAR-0001'
export const DEMO_DRIFT_RUN_ID = 'DEMO-DRIFT-0001'
export const DEMO_BACKTRACK_RUN_ID = 'DEMO-BCK-0001'
export const DEMO_ATTRIBUTION_RUN_ID = 'DEMO-ATR-0001'

/** Provenance strings used across demo fixtures (honest, machine-readable). */
export const DEMO_PROVENANCE = 'SYNTHETIC'
export const DEMO_PROVENANCE_NOTE = 'CONTROLLED DEMO · SIMULATED DATA'
export const DEMO_AIS_SOURCE = 'CONTROLLED'

/** The canonical 8-stage pipeline order — duplicated here to avoid an import
 *  cycle with investigationStore; a contract test keeps both in lockstep. */
export const DEMO_STAGE_ORDER = [
  'detection',
  'characterization',
  'environment',
  'forward_drift',
  'backtracking',
  'ais',
  'attribution',
  'conclusion',
] as const
export type DemoStageId = (typeof DEMO_STAGE_ORDER)[number]

/** Synthetic scenario origin (open ocean, not a real incident). */
export const DEMO_SPILL_LOCATION = { lon: 75.198, lat: 12.487 }

/** Synthetic reference epoch; all demo clocks derive from it. */
const BASE_UTC = Date.parse('2026-06-01T02:00:00Z')

export function syntheticIso(offsetHours: number): string {
  return new Date(BASE_UTC + offsetHours * 3_600_000).toISOString()
}

// --- deterministic PRNG -----------------------------------------------------

/** Small fast seeded PRNG (mulberry32). Deterministic for a fixed seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- demo session state -----------------------------------------------------
//
// Kept in sessionStorage so a reload mid-demo resumes from the same point.
// State only ever derives from prior actions and fixed constants — never from
// the wall clock — so repeated runs stay deterministic.

export type DemoSessionState = {
  clockOffsetHours: number
  spilled: boolean
  sarDetected: boolean
  driftRun: boolean
  backtrackRun: boolean
  attributionRun: boolean
  invPhase: 'none' | 'running' | 'completed' | 'cancelled'
  invProgress: number
  invCompletedCount: number
  revealed: boolean
  spillLon: number
  spillLat: number
}

export const EMPTY_DEMO_SESSION: DemoSessionState = {
  clockOffsetHours: 0,
  spilled: false,
  sarDetected: false,
  driftRun: false,
  backtrackRun: false,
  attributionRun: false,
  invPhase: 'none',
  invProgress: 0,
  invCompletedCount: 0,
  revealed: false,
  spillLon: DEMO_SPILL_LOCATION.lon,
  spillLat: DEMO_SPILL_LOCATION.lat,
}

const SESSION_KEY = 'sih-oilspill.demo-session'

function storageSafe(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function readDemoSession(): DemoSessionState {
  const storage = storageSafe()
  if (!storage) return { ...EMPTY_DEMO_SESSION }
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return { ...EMPTY_DEMO_SESSION }
    return { ...EMPTY_DEMO_SESSION, ...(JSON.parse(raw) as Partial<DemoSessionState>) }
  } catch {
    return { ...EMPTY_DEMO_SESSION }
  }
}

export function writeDemoSession(patch: Partial<DemoSessionState>): DemoSessionState {
  const next = { ...readDemoSession(), ...patch }
  const storage = storageSafe()
  if (storage) {
    try {
      storage.setItem(SESSION_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable — session stays in-memory only
    }
  }
  return next
}

export function resetDemoSession(): DemoSessionState {
  const storage = storageSafe()
  if (storage) {
    try {
      storage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }
  return { ...EMPTY_DEMO_SESSION }
}

export function demoClock(session: DemoSessionState = readDemoSession()): string {
  return syntheticIso(session.clockOffsetHours)
}

// --- fleet ------------------------------------------------------------------

/** Synthetic demo fleet (8 vessels). All identities/positions are fabricated. */
export function demoFleet(): VesselDto[] {
  const mk = (
    index: number,
    name: string,
    mmsi: string,
    type: string,
    lat: number,
    lon: number,
    speed: number,
    heading: number,
  ): VesselDto => ({
    id: `SAMPLE-VSL-${String(index).padStart(3, '0')}`,
    mmsi,
    name,
    type,
    position: { latitude: lat, longitude: lon },
    speed,
    heading,
  })
  return [
    mk(1, 'SAMPLE TANKER AURORA', '999117003', 'Tanker', 12.494, 75.188, 8.2, 122),
    mk(2, 'SAMPLE FISHERY VESSEL', '999224101', 'Fishing', 12.512, 75.221, 4.1, 84),
    mk(3, 'SAMPLE CARGO CARRIER', '999117014', 'Cargo', 12.469, 75.242, 12.6, 210),
    mk(4, 'SAMPLE PILOT CRAFT', '999431506', 'Pilot', 12.534, 75.171, 6.9, 18),
    mk(5, 'SAMPLE FISHERY VESSEL', '999224112', 'Fishing', 12.458, 75.194, 3.7, 265),
    mk(6, 'SAMPLE BULK CARRIER', '999331203', 'Bulk', 12.551, 75.209, 10.4, 340),
    mk(7, 'SAMPLE PATROL CRAFT', '999990651', 'Patrol', 12.481, 75.153, 14.2, 45),
    mk(8, 'SAMPLE TANKER BRAVO', '999117019', 'Tanker', 12.523, 75.248, 7.4, 158),
  ]
}

/** Deterministic close-out of the synthetic slick ring around some centre. */
function aroundOrigin(center: { lon: number; lat: number }, factor: number, jitter: number): [number, number][] {
  const rand = mulberry32(DEMO_SEED + Math.round(factor * 1000) + jitter)
  const { lon, lat } = center
  const ring: [number, number][] = []
  const samples = 7
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2
    ring.push([
      Math.round((lon + factor * Math.cos(a) + (rand() - 0.5) * 0.02) * 1000) / 1000,
      Math.round((lat + factor * 0.7 * Math.sin(a) + (rand() - 0.5) * 0.02) * 1000) / 1000,
    ])
  }
  ring.push(ring[0])
  return ring
}

// --- SAR observation --------------------------------------------------------

function sarCandidates(): SarSlickCandidateDto[] {
  const { lon, lat } = DEMO_SPILL_LOCATION
  const primaryRing = aroundOrigin({ lon, lat }, 0.045, 1)
  const uncertainRing = aroundOrigin({ lon, lat }, 0.02, 2)
  const lookAlikeRing = aroundOrigin({ lon, lat }, 0.012, 3)
  const approxBbox = (ring: [number, number][]) => {
    const lons = ring.map(([x]) => x)
    const lats = ring.map(([, y]) => y)
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lons),
      west: Math.min(...lons),
    }
  }
  return [
    {
      candidate_id: 'DEMO-CAND-0001',
      classification: 'OIL_CANDIDATE',
      confidence: 0.91,
      polygon: primaryRing,
      centroid: [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000],
      bbox: approxBbox(primaryRing),
      area_km2: 4.21,
      perimeter_km: 9.76,
      length_km: 3.42,
      width_km: 1.61,
      aspect_ratio: 2.13,
      orientation_deg: 38.4,
      shape_factor: 0.61,
      pixel_area: 89231,
      contrast_db: -2.13,
      incidence_deg: 33.8,
      look_alike_hints: [],
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    {
      candidate_id: 'DEMO-CAND-0002',
      classification: 'UNCERTAIN',
      confidence: 0.38,
      polygon: uncertainRing,
      centroid: [Math.round((lon + 0.03) * 1000) / 1000, Math.round((lat - 0.02) * 1000) / 1000],
      bbox: approxBbox(uncertainRing),
      area_km2: 1.04,
      perimeter_km: 4.12,
      length_km: 1.47,
      width_km: 1.02,
      aspect_ratio: 1.39,
      orientation_deg: 12.1,
      shape_factor: 0.52,
      pixel_area: 18440,
      contrast_db: -0.87,
      incidence_deg: 34.1,
      look_alike_hints: ['low contrast'],
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    {
      candidate_id: 'DEMO-CAND-0003',
      classification: 'LOOK_ALIKE',
      confidence: 0.21,
      polygon: lookAlikeRing,
      centroid: [Math.round((lon - 0.045) * 1000) / 1000, Math.round((lat + 0.028) * 1000) / 1000],
      bbox: approxBbox(lookAlikeRing),
      area_km2: 0.42,
      perimeter_km: 2.31,
      length_km: 0.84,
      width_km: 0.61,
      aspect_ratio: 1.31,
      orientation_deg: 201.4,
      shape_factor: 0.47,
      pixel_area: 7312,
      contrast_db: -0.41,
      incidence_deg: 33.5,
      look_alike_hints: ['biogenic film', 'low backscatter'],
      warnings: [DEMO_PROVENANCE_NOTE],
    },
  ]
}

export function sarObservation(): SarObservationDto {
  return {
    observationId: DEMO_SAR_OBSERVATION_ID,
    status: 'completed',
    sourceState: 'SYNTHETIC',
    source: 'SYNTHETIC SENTINEL-1 (controlled demo)',
    providerDataset: 'S-1 GRD DEMO SCENE',
    acquisition_time: syntheticIso(-2),
    satellites: ['SENTINEL-1A (synthetic)'],
    polarization: 'VV',
    scene_id: 'S1_DEMO_2026_CR_88',
    detector: 'ONNX',
    detector_version: 'demo-2026.1',
    candidates: sarCandidates(),
    confidence: 0.91,
    slick_area_km2: 4.21,
    age_available: true,
    age_estimate: syntheticIso(-1.5),
    warnings: [DEMO_PROVENANCE_NOTE],
    errors: [],
  }
}

// --- forward drift ----------------------------------------------------------

export function driftParticles(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): { lon: number; lat: number; mass_kg: number }[] {
  const rand = mulberry32(20260601)
  const { lon, lat } = center
  const out: { lon: number; lat: number; mass_kg: number }[] = []
  for (let i = 0; i < 500; i++) {
    out.push({
      lon: Math.round((lon + 0.05 + rand() * 0.24 - 0.03) * 1000) / 1000,
      lat: Math.round((lat + 0.03 + rand() * 0.2 - 0.04) * 1000) / 1000,
      mass_kg: Math.round((80 + rand() * 40) * 10) / 10,
    })
  }
  return out
}

function driftExtentRing(center: { lon: number; lat: number }): [number, number][] {
  return aroundOrigin(center, 0.11, 7)
}

export function forwardDriftResponse(
  body: { durationHours?: number; oilType?: string },
  center: { lon: number; lat: number } = DEMO_SPILL_LOCATION,
): ForwardDriftResponse {
  const durationHours = body.durationHours ?? 6
  return {
    driftRunId: DEMO_DRIFT_RUN_ID,
    particles: driftParticles(center),
    extent: { type: 'Polygon', coordinates: [driftExtentRing(center)] },
    massBalance: {
      evaporated_kg: 742.4,
      dispersed_kg: 198.1,
      remaining_kg: 4059.5,
    },
    driftRun: {
      run_id: DEMO_DRIFT_RUN_ID,
      timestep_seconds: 1800,
      duration_hours: durationHours,
      environment_source: DEMO_PROVENANCE,
      environment_dataset: `${DEMO_PROVENANCE_NOTE} FIELD`,
      model_version: 'opendrift-demo-0.1.0',
      reproducibility_digest: 'demo-2f8c1b9a5d',
    },
    status: 'completed',
  }
}

// --- backtracking -----------------------------------------------------------

export function backtrackingDto(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): BacktrackingDto {
  const { lon, lat } = center
  return {
    backtrackRunId: DEMO_BACKTRACK_RUN_ID,
    run_id: DEMO_BACKTRACK_RUN_ID,
    status: 'completed',
    duration_hours: 6,
    ensemble_size: 32,
    particles_per_member: 200,
    environment_source: DEMO_PROVENANCE,
    source_region: { type: 'Polygon', coordinates: [aroundOrigin(center, 0.09, 8)] },
    source_contours: [
      { level: 0.9, polygon: { type: 'Polygon', coordinates: [aroundOrigin(center, 0.03, 9)] } },
      { level: 0.7, polygon: { type: 'Polygon', coordinates: [aroundOrigin(center, 0.06, 10)] } },
    ],
    origin_estimate: { lon: Math.round((lon + 0.018) * 1000) / 1000, lat: Math.round((lat + 0.012) * 1000) / 1000 },
    origin_time_range: {
      earliest: syntheticIso(-6),
      latest: syntheticIso(-4.5),
      preferred: syntheticIso(-5),
    },
    uncertainty_km: 1.8,
    confidence: {
      source_concentration: 'MEDIUM',
      environmental_quality: 'MEDIUM',
      trajectory_agreement: 0.87,
      ensemble_stability: 0.78,
    },
    trajectories: [1, 2, 3, 4].map((member) => ({
      member,
      wind_drift_factor: 0.034,
      endpoints: [1, 2, 3].map((k) => ({
        lon: Math.round((lon + 0.02 * member - 0.05 * (k - 1)) * 1000) / 1000,
        lat: Math.round((lat + 0.01 * member - 0.045 * (k - 1)) * 1000) / 1000,
      })),
    })),
    ensemble_summary: {
      member_count: 32,
      converged_count: 27,
      mean_endpoint_distance_km: 6.42,
      std_endpoint_distance_km: 1.94,
    },
    quality: {
      total_particles: 6400,
      converged_particles: 5721,
      land_hits: 0,
      domain_exits: 3,
      invalid_particles: 2,
      warnings: [],
    },
    warnings: [DEMO_PROVENANCE_NOTE],
  }
}

// --- attribution ------------------------------------------------------------

const FACTOR_KEYS = ['spatial', 'temporal', 'trajectory', 'anomaly', 'environmental'] as const
type FactorKey = (typeof FACTOR_KEYS)[number]

function rankedVessels(): RankedVesselDto[] {
  const fleet = demoFleet()
  const scores: Record<string, number> = {
    'SAMPLE-VSL-001': 0.84,
    'SAMPLE-VSL-008': 0.41,
    'SAMPLE-VSL-002': 0.36,
    'SAMPLE-VSL-003': 0.31,
    'SAMPLE-VSL-006': 0.27,
    'SAMPLE-VSL-004': 0.23,
    'SAMPLE-VSL-005': 0.19,
    'SAMPLE-VSL-007': 0.14,
  }
  const factorBase: Record<FactorKey, number> = {
    spatial: 0.9,
    temporal: 0.86,
    trajectory: 0.88,
    anomaly: 0.74,
    environmental: 0.8,
  }
  return fleet
    .map((v) => {
      const i = Number(v.id.split('-').pop())
      const scale = Array.isArray(i) ? 1 : (i - 1) / 7
      const score = Math.round(scores[v.id] * 1000) / 1000
      const factors = Object.fromEntries(
        FACTOR_KEYS.map((k) => [k, Math.round((factorBase[k] * (1 - 0.45 * scale)) * 1000) / 1000]),
      ) as Record<FactorKey, number>
      return {
        rank: 0,
        mmsi: v.mmsi,
        name: v.name,
        vessel_type: v.type,
        imo: `DEMO${String(9000000 + i)}`,
        score,
        factors,
        factor_evidence: Object.fromEntries(
          FACTOR_KEYS.map((k) => [
            k,
            {
              note: `${DEMO_PROVENANCE_NOTE} — synthetic ${k} factor`,
              weight: factors[k],
              distance_km: Math.round((2 + i * 3.1) * 10) / 10,
              position: { lon: v.position.longitude, lat: v.position.latitude },
            },
          ]),
        ),
        data_quality: {
          reliability: i === 1 ? 'HIGH' : 'MEDIUM',
          notes: [DEMO_PROVENANCE_NOTE],
          messages_in_window: 214 - i * 7,
          median_cadence_min: 9 + i * 2,
          interpolation_fraction: 0.04,
          coverage_gaps: i === 1 ? 0 : (i % 3) + 1,
          anomalies: i === 1 ? [] : ['sparse coverage'],
        },
        min_distance_km: Math.round((1.6 + i * 2.2) * 10) / 10,
        time_of_closest_approach: syntheticIso(-4.9),
        closest_position: { lon: v.position.longitude, lat: v.position.latitude },
        warnings: [DEMO_PROVENANCE_NOTE],
      }
    })
    .map((v, idx) => ({ ...v, rank: idx + 1 }))
}

export function attributionDto(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): AttributionRunDto {
  const { lon, lat } = center
  return {
    attributionRunId: DEMO_ATTRIBUTION_RUN_ID,
    simulationId: DEMO_SIMULATION_ID,
    backtrackRunId: DEMO_BACKTRACK_RUN_ID,
    status: 'completed',
    aisSource: DEMO_AIS_SOURCE,
    sourceState: DEMO_PROVENANCE,
    attributionModelVersion: 'demo-0.1.0',
    modelVersion: 'demo-0.1.0',
    weightsUsed: {
      spatial: 0.35,
      temporal: 0.25,
      trajectory: 0.2,
      anomaly: 0.1,
      environmental: 0.1,
    },
    conclusion: 'candidate',
    ranking: {
      top_score: 0.84,
      second_score: 0.41,
      margin: 0.43,
      decisive: true,
    },
    rankedVessels: rankedVessels(),
    warnings: [DEMO_PROVENANCE_NOTE],
    scoreWarnings: [],
    errors: [],
    origin: { lat, lon },
    timeRange: { earliest: syntheticIso(-6), latest: syntheticIso(-4.5), preferred: syntheticIso(-5) },
    releaseTime: syntheticIso(-5),
    radiusKm: 15,
    maxGapMin: 90,
    seed: DEMO_SEED,
    environmentSource: DEMO_PROVENANCE,
    aisQuery: {
      sourceState: DEMO_PROVENANCE,
      provider: DEMO_AIS_SOURCE,
      dataset: 'SYNTHETIC AIS',
      vesselCount: 8,
      elapsedMs: 420,
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    filter: {
      kept: 8,
      dropped: 0,
      stats: { total: 8, inside_radius: 8 },
    },
    createdAt: syntheticIso(-4),
  }
}

export function providersReport(): AisProviderReport {
  return {
    ais: {
      [DEMO_AIS_SOURCE]: {
        status: 'available',
        state: DEMO_PROVENANCE,
        note: DEMO_PROVENANCE_NOTE,
        dataset: 'SYNTHETIC AIS',
        seed: DEMO_SEED,
      },
    },
  }
}

// --- investigation ----------------------------------------------------------

function stageRecord(index: number): InvestigationStageState {
  const stageId = DEMO_STAGE_ORDER[index] as (typeof DEMO_STAGE_ORDER)[number]
  return {
    stageId,
    status: 'pending',
    attemptCount: 0,
    error: null,
    stageStartedAt: null,
    stageCompletedAt: null,
    referenceId: null,
    referenceType: null,
    provenance: null,
    sourceState: null,
    modelVersion: null,
    summary: null,
    warnings: null,
  }
}

function completedStage(index: number): InvestigationStageState {
  const base = stageRecord(index)
  const stageId = DEMO_STAGE_ORDER[index] as (typeof DEMO_STAGE_ORDER)[number]
  const summary = stageSummary(stageId)
  return {
    ...base,
    status: 'completed',
    attemptCount: 1,
    stageStartedAt: syntheticIso(index * 1.4),
    stageCompletedAt: syntheticIso(index * 1.4 + 0.9),
    referenceId: summary?.referenceId ?? null,
    referenceType: summary?.referenceType ?? null,
    provenance: DEMO_PROVENANCE,
    sourceState: DEMO_PROVENANCE,
    modelVersion: 'demo-0.1.0',
    summary: summary?.summary ?? null,
    warnings: [DEMO_PROVENANCE_NOTE],
  }
}

function stageSummary(
  stageId: (typeof DEMO_STAGE_ORDER)[number],
):
  | { referenceId: string | null; referenceType: string | null; summary: Record<string, unknown> | null }
  | undefined {
  switch (stageId) {
    case 'detection':
      return {
        referenceId: DEMO_SAR_OBSERVATION_ID,
        referenceType: 'sarObservation',
        summary: { candidates: 3, topConfidence: 0.91, slickAreaKm2: 4.21 },
      }
    case 'characterization':
      return { referenceId: DEMO_SAR_OBSERVATION_ID, referenceType: 'sarObservation', summary: { primaryCandidate: 'DEMO-CAND-0001' } }
    case 'environment':
      return { referenceId: null, referenceType: null, summary: { source: DEMO_PROVENANCE, dataset: `${DEMO_PROVENANCE_NOTE} FIELD` } }
    case 'forward_drift':
      return { referenceId: DEMO_DRIFT_RUN_ID, referenceType: 'driftRun', summary: { particles: 500, durationHours: 6 } }
    case 'backtracking':
      return {
        referenceId: DEMO_BACKTRACK_RUN_ID,
        referenceType: 'backtrackRun',
        summary: {
          originEstimate: {
            lon: Math.round((DEMO_SPILL_LOCATION.lon + 0.018) * 1000) / 1000,
            lat: Math.round((DEMO_SPILL_LOCATION.lat + 0.012) * 1000) / 1000,
          },
          uncertaintyKm: 1.8,
          confidence: 0.87,
        },
      }
    case 'ais':
      return { referenceId: DEMO_ATTRIBUTION_RUN_ID, referenceType: 'attributionRun', summary: { provider: DEMO_AIS_SOURCE, vesselCount: 8, sourceState: DEMO_PROVENANCE } }
    case 'attribution':
      return { referenceId: DEMO_ATTRIBUTION_RUN_ID, referenceType: 'attributionRun', summary: { rankedVessels: 8, margin: 0.43, decisive: true } }
    case 'conclusion':
      return { referenceId: DEMO_ATTRIBUTION_RUN_ID, referenceType: 'attributionRun', summary: { conclusion: 'candidate', mmsi: '999117003' } }
    default:
      return undefined
  }
}

function evidenceFor(stageId: (typeof DEMO_STAGE_ORDER)[number], index: number) {
  const s = stageSummary(stageId)
  return {
    id: `DEMO-EVID-${String(index + 1).padStart(3, '0')}`,
    label: `Synthetic ${stageId} evidence`,
    at: syntheticIso(index * 1.4 + 0.9),
    stageId,
    referenceType: s?.referenceType ?? null,
    referenceId: s?.referenceId ?? null,
    provenance: DEMO_PROVENANCE,
    payload: s?.summary ?? null,
  }
}

function demoConclusion(status: 'candidate' | null = 'candidate') {
  return {
    status,
    reason: status ? 'Candidate ranked by deterministic synthetic attribution model (controlled demo).' : null,
    aggregation: DEMO_PROVENANCE,
    provenance: DEMO_PROVENANCE,
    topScore: status ? 0.84 : null,
    margin: status ? 0.43 : null,
    decisive: status ? true : null,
    candidate: status ? { mmsi: '999117003', name: 'SAMPLE TANKER AURORA', rank: 1 } : null,
    thresholdsUsed: status ? { topScore: 0.5, margin: 0.2 } : null,
    why: status ? 'Closest-approach geometry and trajectory agreement dominate the composite score.' : null,
    referenceAttributionRunId: status ? DEMO_ATTRIBUTION_RUN_ID : null,
    referenceBacktrackRunId: status ? DEMO_BACKTRACK_RUN_ID : null,
  }
}

export function investigationStageStates(session: DemoSessionState): InvestigationStageState[] {
  return DEMO_STAGE_ORDER.map((_, i) =>
    i < session.invCompletedCount ? completedStage(i) : stageRecord(i),
  )
}

export function investigationEvidence(session: DemoSessionState) {
  return DEMO_STAGE_ORDER.slice(0, session.invCompletedCount).map((s, i) => evidenceFor(s, i))
}

export function investigationDto(session: DemoSessionState = readDemoSession()): InvestigationDto {
  const completed = session.invPhase === 'completed'
  const status: InvestigationDto['status'] = completed
    ? 'COMPLETED'
    : session.invPhase === 'cancelled'
      ? 'CANCELLED'
      : session.invPhase === 'running'
        ? 'RUNNING'
        : 'CREATED'
  const progress = completed ? 1 : session.invProgress
  const stages = investigationStageStates(session)
  return {
    investigationId: DEMO_INVESTIGATION_ID,
    incidentId: DEMO_INCIDENT_ID,
    simulationId: DEMO_SIMULATION_ID,
    spillEventId: DEMO_SPILL_EVENT_ID,
    status,
    params: {
      sarSource: DEMO_PROVENANCE,
      sarDetector: 'ONNX',
      maxCandidates: 3,
      backtrackEnsembleSize: 32,
      backtrackParticlesPerMember: 200,
      backtrackDurationHours: 6,
      forwardDriftParticleCount: 500,
      forwardDriftDurationHours: 6,
      environmentSource: DEMO_PROVENANCE,
      aisSource: DEMO_AIS_SOURCE,
      radiusKm: 15,
      maxGapMin: 90,
      seed: DEMO_SEED,
    },
    createdAt: syntheticIso(0),
    startedAt: syntheticIso(0.4),
    completedAt: completed ? syntheticIso(7) : null,
    updatedAt: syntheticIso(completed ? 7 : Math.max(0, session.invCompletedCount * 1.4)),
    progress,
    stages,
    evidence: investigationEvidence(session),
    conclusion: demoConclusion(completed ? 'candidate' : null),
    provenance: {
      aggregation: DEMO_PROVENANCE,
      perStage: Object.fromEntries(DEMO_STAGE_ORDER.map((s) => [s, DEMO_PROVENANCE])),
    },
    errors: [],
    warnings: [DEMO_PROVENANCE_NOTE],
    reveal: { revealed: session.revealed },
  }
}

export function investigationSummary(session: DemoSessionState = readDemoSession()): InvestigationSummaryState {
  const dto = investigationDto(session)
  return {
    investigationId: dto.investigationId,
    incidentId: dto.incidentId,
    simulationId: dto.simulationId,
    status: dto.status,
    progress: dto.progress,
    conclusionStatus: dto.conclusion?.status ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function revealResponse(): RevealResponse {
  return {
    investigationId: DEMO_INVESTIGATION_ID,
    revealed: true,
    positionError_km: 0.43,
    timeError_min: 24,
    attributionCorrect: true,
    scoreMargin: 0.43,
    notes: [DEMO_PROVENANCE_NOTE, 'Deterministic synthetic ground truth comparison.'],
    revealedAt: syntheticIso(7.1),
  }
}

export function reportRecord(): InvestigationReport {
  const section = (summary: string) => ({ summary })
  return {
    '3_detection': section('SAR detection completed on the synthetic controlled-demo scene.'),
    '4_characterization': section('Primary slick characterized from the leading candidate (OIL_CANDIDATE).'),
    '5_environment': section('Environmental forcing used the deterministic synthetic field.'),
    '6_forward_drift': section('Forward drift advection completed over the deterministic controlled field.'),
    '7_backtracking': section('Ensemble backtracking converged on a synthetic source region near the released spill.'),
    '9_ais': section('AIS query executed against the controlled synthetic provider.'),
    '10_attribution': section('Composite scoring ranked the leading candidate decisively (synthetic).'),
    '11_conclusion': section('Conclusion: candidate (synthetic).'),
  }
}

// --- environment (bypassed honestly) ----------------------------------------

const DEMO_REASON = `${DEMO_PROVENANCE_NOTE} — live feed bypassed.`

export function demoEnvironmentGrid(axis: 'current' | 'wind') {
  const { lon, lat } = DEMO_SPILL_LOCATION
  const base = axis === 'wind' ? { u: 2.1, v: 0.4 } : { u: 0.52, v: 0.08 }
  return {
    source: `${DEMO_PROVENANCE} ${axis === 'current' ? 'CURRENT' : 'WIND'}`,
    fields: [
      { lat: lat - 0.1, lon: lon - 0.1, ...base },
      { lat: lat - 0.1, lon: lon + 0.1, ...base },
      { lat: lat + 0.1, lon: lon - 0.1, ...base },
      { lat: lat + 0.1, lon: lon + 0.1, ...base },
    ],
  }
}

export function demoLiveWeather(): {
  available: boolean
  source: string
  latitude: number
  longitude: number
  fetched_at: string | null
  reason?: string | null
} {
  return {
    available: false,
    source: DEMO_PROVENANCE,
    latitude: DEMO_SPILL_LOCATION.lat,
    longitude: DEMO_SPILL_LOCATION.lon,
    fetched_at: null,
    reason: DEMO_REASON,
  }
}

export function demoIncidentFeed(): {
  available: boolean
  source: string
  fetched_at: string | null
  reason?: string | null
  event_count: number
  events: unknown[]
} {
  return {
    available: false,
    source: DEMO_PROVENANCE,
    fetched_at: null,
    reason: DEMO_REASON,
    event_count: 0,
    events: [],
  }
}

export function demoDepthReading(): {
  available: boolean
  source: string
  fetched_at: string | null
  reason?: string | null
  depth_m: number | null
  elevation_m: number | null
} {
  return {
    available: false,
    source: DEMO_PROVENANCE,
    fetched_at: null,
    reason: DEMO_REASON,
    depth_m: null,
    elevation_m: null,
  }
}

export function demoHealthInfo(): HealthInfo {
  return {
    service: 'sih-oilguardsim-demo',
    version: 'demo-0.1.0',
    mongodb: 'UP',
    status: 'UP',
  }
}

export function demoPythonPing(): PythonPing {
  return {
    ok: true,
    pythonStatus: DEMO_PROVENANCE,
    pythonUrl: 'simulated://scientific-service',
  }
}

export function demoSpillDto(session: DemoSessionState = readDemoSession()) {
  return {
    spillEventId: DEMO_SPILL_EVENT_ID,
    incidentId: DEMO_INCIDENT_ID,
    vesselId: 'SAMPLE-VSL-001',
    time: syntheticIso(0),
    oilType: 'GENERIC CRUDE',
    quantityKg: 5000,
    type: 'accidental',
    location: { latitude: session.spillLat, longitude: session.spillLon },
  }
}

export function demoSimulationDto(session: DemoSessionState = readDemoSession()): SimulationDto {
  const status =
    session.invPhase === 'completed' || session.invPhase === 'cancelled'
      ? 'observation'
      : session.spilled
        ? 'observation'
        : session.clockOffsetHours > 0
          ? 'simulating'
          : 'captain_mode'
  return {
    simulationId: DEMO_SIMULATION_ID,
    status,
    mode: 'captain',
    clock: demoClock(session),
    vessels: demoFleet(),
    spillEvent: session.spilled ? demoSpillDto() : undefined,
    incident: undefined,
    investigation: undefined,
  }
}

export function demoIncidentDto(session: DemoSessionState = readDemoSession()) {
  const center = { lon: session.spillLon, lat: session.spillLat }
  return {
    slick: {
      geometry: { type: 'Polygon', coordinates: [aroundOrigin(center, 0.05, 11)] },
      area_km2: 4.21,
      centroid: { lat: center.lat, lon: center.lon },
      orientation: 38.4,
    },
    environment: {
      source: DEMO_PROVENANCE,
      note: DEMO_PROVENANCE_NOTE,
    },
  }
}

export function demoWorkspaceReset() {
  return {
    status: 'RESET' as const,
    dropped: ['cases', 'investigations', 'runs'],
    skipped: [],
    at: syntheticIso(0),
  }
}