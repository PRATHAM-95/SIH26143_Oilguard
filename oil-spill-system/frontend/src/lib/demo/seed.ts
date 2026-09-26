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

/**
 * The controlled incident's own identity and headline figures.
 *
 * These were previously inline literals repeated across the candidate, the
 * observation rollup and the incident DTO, which is how the map came to report
 * one area while drawing another. Everything that states the incident now reads
 * it from here, and the geometry is measured from these figures rather than
 * asserted beside them.
 *
 * The identifier is dated in the SLICK-YYYY-MMDD-NNN form an operator would
 * quote across a watch, and the date is the UTC acquisition date of the scene
 * that produced the detection - 2026-06-01, the scenario epoch. A reference that
 * disagreed with the "Detected" timestamp two inches below it on the same card
 * would be the exact kind of drift this pass exists to remove.
 */
export const DEMO_SLICK_ID = 'SLICK-2026-0601-001'
export const DEMO_SLICK_CONFIDENCE = 0.92
export const DEMO_SLICK_AREA_KM2 = 2.4

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

/** Synthetic scenario origin (open ocean in the Arabian Sea, not a real incident). */
export const DEMO_SPILL_LOCATION = { lon: 72.62, lat: 16.41 }

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

/**
 * Regional trade corridors. The waypoints are real shipping waypoints (Bab
 * el-Mandeb, Strait of Hormuz, Gulf of Oman, the west India coast approach,
 * Colombo, the Bay of Bengal and the Andaman/Malacca approach) so the synthetic
 * traffic follows plausible lane geometry instead of scattering uniformly.
 *
 * These double as the demo shipping-lane overlay, so the lanes the vessels
 * follow are exactly the lanes drawn on the map.
 */
export type DemoCorridor = {
  id: string
  label: string
  path: [number, number][]
}

export const DEMO_SHIPPING_CORRIDORS: DemoCorridor[] = [
  {
    id: 'east-africa-coast',
    label: 'East Africa Coastal',
    path: [
      [40.4, -3.2],
      [41.8, 0.4],
      [43.1, 4.0],
      [44.6, 7.6],
      [46.2, 10.4],
      [48.4, 11.9],
      [50.6, 12.2],
    ],
  },
  {
    id: 'gulf-of-aden',
    label: 'Gulf of Aden',
    path: [
      [43.3, 12.7],
      [44.9, 12.3],
      [46.8, 12.0],
      [48.6, 12.4],
      [50.4, 12.9],
      [52.2, 12.6],
    ],
  },
  {
    id: 'hormuz-gulf-of-oman',
    label: 'Hormuz – Gulf of Oman',
    path: [
      [56.3, 26.6],
      [57.4, 25.4],
      [58.6, 24.1],
      [59.9, 22.7],
      [61.6, 21.4],
    ],
  },
  {
    id: 'oman-arabian-sea',
    label: 'Oman – Central Arabian Sea',
    path: [
      [59.9, 22.7],
      [62.3, 20.4],
      [64.6, 18.2],
      [66.8, 16.1],
      [68.6, 14.6],
    ],
  },
  {
    id: 'arabian-sea-west-india',
    label: 'Arabian Sea – West India',
    path: [
      [66.8, 16.1],
      [68.4, 14.4],
      [70.2, 13.1],
      [71.8, 12.6],
      [73.1, 12.1],
      [74.5, 11.4],
      [76.2, 9.9],
    ],
  },
  {
    id: 'india-srilanka',
    label: 'India – Sri Lanka',
    path: [
      [76.2, 9.9],
      [77.8, 8.4],
      [79.4, 7.2],
      [80.7, 6.4],
      [81.5, 5.8],
      [82.4, 6.4],
      [84.1, 6.3],
    ],
  },
  {
    id: 'bay-of-bengal',
    label: 'Bay of Bengal',
    path: [
      [84.1, 6.3],
      [86.6, 7.8],
      [88.7, 10.1],
      [90.4, 12.6],
      [91.8, 15.2],
    ],
  },
  {
    id: 'andaman-malacca',
    label: 'Andaman – Malacca Approach',
    path: [
      [91.8, 15.2],
      [93.9, 11.4],
      [96.2, 8.2],
      [98.4, 5.9],
      [100.6, 3.4],
      [102.4, 1.6],
    ],
  },
  {
    id: 'maldives-lane',
    label: 'Maldives Lane',
    path: [
      [71.9, 3.4],
      [72.8, 5.1],
      [74.1, 7.3],
      [75.6, 9.4],
      [76.2, 9.9],
    ],
  },
]

/** Linear interpolation along a corridor, `t` in [0, 1]. */
function pointAlong(path: [number, number][], t: number): [number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (path.length - 1)
  const i = Math.min(path.length - 2, Math.floor(scaled))
  const f = scaled - i
  const [lon0, lat0] = path[i]
  const [lon1, lat1] = path[i + 1]
  return [lon0 + (lon1 - lon0) * f, lat0 + (lat1 - lat0) * f]
}

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from north. */
function bearingBetween(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (d: number) => (d * 180) / Math.PI
  const dLon = toRad(b[0] - a[0])
  const lat0 = toRad(a[1])
  const lat1 = toRad(b[1])
  const y = Math.sin(dLon) * Math.cos(lat1)
  const x = Math.cos(lat0) * Math.sin(lat1) - Math.sin(lat0) * Math.cos(lat1) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Great-circle distance in km. Mirrors the map helper of the same name, kept
 * local so this data module stays free of store/render dependencies.
 */
function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

/**
 * Attribution search radius for the demo scenario, in km. Chosen so exactly
 * DEMO_CANDIDATE_COUNT synthetic vessels fall inside it: the map, the
 * attribution run and the activity feed all derive from this single value.
 */
export const DEMO_ATTRIBUTION_RADIUS_KM = 60
export const DEMO_CANDIDATE_COUNT = 3

/**
 * Place a vessel relative to the scenario origin: a bearing (degrees clockwise
 * from north) and a distance in km.
 *
 * The three scored candidates are positioned with this rather than as literal
 * coordinates. A hard-coded position silently decouples from DEMO_SPILL_LOCATION
 * the moment the origin moves, and the failure is invisible until the
 * attribution run reports zero candidates against a map full of ships.
 */
function standoffFromOrigin(
  bearingDeg: number,
  km: number,
  origin: { lon: number; lat: number } = DEMO_SPILL_LOCATION,
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const br = toRad(bearingDeg)
  const lat = origin.lat + ((km / 6371) * Math.cos(br) * 180) / Math.PI
  const lon =
    origin.lon + ((km / 6371) * Math.sin(br) * 180) / Math.PI / Math.cos(toRad(origin.lat))
  return [Number(lon.toFixed(4)), Number(lat.toFixed(4))]
}

type FleetSpec = {
  name: string
  mmsi: string
  type: string
  corridor: string
  t: number
  /** Lateral offset in degrees, so ships ride the lane instead of lying on it. */
  offset: number
  speed: number
  status: 'Underway' | 'Anchored' | 'Moored' | 'Drifting'
  /** Minutes since the last AIS position report. */
  ageMin: number
  destination: string
  flag: string
  /** Jitter applied to the corridor bearing, degrees. */
  jitter?: number
  /**
   * Explicit [lon, lat] that replaces corridor interpolation. Used for the
   * vessels in close attendance on the incident, whose traffic is a crossing
   * pattern rather than a lane transit.
   */
  position?: [number, number]
}

/**
 * Synthetic regional fleet distributed along DEMO_SHIPPING_CORRIDORS. Every
 * identity, position, heading and AIS age is fabricated. Three vessels sit
 * within DEMO_ATTRIBUTION_RADIUS_KM of the slick and become the scored
 * candidates; the rest are background traffic across the operating region,
 * distributed to match the regional traffic pattern (Gulf of Aden, Gulf of Oman,
 * central Arabian Sea, west India – Sri Lanka, Bay of Bengal, Andaman approach).
 */
const DEMO_FLEET_SPEC: FleetSpec[] = [
  // Gulf of Aden / East Africa inbound
  { name: 'MV ZAMBEZI TRADER', mmsi: '677091200', type: 'Bulk Carrier', corridor: 'gulf-of-aden', t: 0.22, offset: 0.11, speed: 13.4, status: 'Underway', ageMin: 2, destination: 'JEBEL ALI', flag: 'PA' },
  { name: 'MV KILIMANJARO STAR', mmsi: '677091214', type: 'Container', corridor: 'gulf-of-aden', t: 0.68, offset: -0.13, speed: 16.8, status: 'Underway', ageMin: 4, destination: 'MOMBASA', flag: 'PA' },
  { name: 'MV SHIRA RIVER', mmsi: '677091227', type: 'Tanker', corridor: 'east-africa-coast', t: 0.74, offset: 0.14, speed: 11.2, status: 'Underway', ageMin: 7, destination: 'COLOMBO', flag: 'TZ' },
  { name: 'MV TANA BRIDGE', mmsi: '677091239', type: 'Fishing', corridor: 'east-africa-coast', t: 0.31, offset: -0.1, speed: 5.1, status: 'Anchored', ageMin: 34, destination: 'LIKONI', flag: 'TZ' },

  // Gulf of Oman / Strait of Hormuz
  { name: 'MT HORMUZ VICTORY', mmsi: '423118004', type: 'LNG Carrier', corridor: 'hormuz-gulf-of-oman', t: 0.18, offset: 0.09, speed: 17.6, status: 'Underway', ageMin: 1, destination: 'DAHEJ', flag: 'LR' },
  { name: 'MV MUSCAT MERCHANT', mmsi: '423118017', type: 'Cargo', corridor: 'hormuz-gulf-of-oman', t: 0.62, offset: -0.12, speed: 12.3, status: 'Underway', ageMin: 3, destination: 'NHAVA SHEVA', flag: 'OM' },
  { name: 'MT SULTAN OF OMAN', mmsi: '423118029', type: 'Product Tanker', corridor: 'hormuz-gulf-of-oman', t: 0.88, offset: 0.13, speed: 9.8, status: 'Underway', ageMin: 6, destination: 'FUJAIRAH', flag: 'OM' },

  // Central Arabian Sea — includes the three scored candidates. These three
  // sit in close attendance on the slick: approaching from the north-east,
  // crossing from the south-west and standing off to the north-west, all inside
  // DEMO_ATTRIBUTION_RADIUS_KM and none of them on top of the slick. Their
  // positions are standoffs from the scenario origin, not literal coordinates,
  // so moving the origin keeps attribution intact.
  { name: 'GMV ARIES', mmsi: '440123456', type: 'Cargo', corridor: 'arabian-sea-west-india', t: 0.55, offset: 0, speed: 11.8, status: 'Underway', ageMin: 2, destination: 'COCHIN', flag: 'PA', position: standoffFromOrigin(50, 34) },
  { name: 'GMV BERGAMOT', mmsi: '440123468', type: 'Tanker', corridor: 'arabian-sea-west-india', t: 0.63, offset: 0, speed: 9.4, status: 'Underway', ageMin: 3, destination: 'MUNDRA', flag: 'MH', position: standoffFromOrigin(215, 47) },
  { name: 'MV CHENAB EXPRESS', mmsi: '440123470', type: 'Bulk Carrier', corridor: 'oman-arabian-sea', t: 0.81, offset: 0, speed: 10.7, status: 'Underway', ageMin: 5, destination: 'MANGALORE', flag: 'PK', position: standoffFromOrigin(310, 55) },
  { name: 'MV SEA SPRINTER', mmsi: '440123482', type: 'Container', corridor: 'oman-arabian-sea', t: 0.34, offset: -0.16, speed: 18.3, status: 'Underway', ageMin: 1, destination: 'SALALAH', flag: 'CY' },
  { name: 'MT EVEREST SPIRIT', mmsi: '440123494', type: 'LNG Carrier', corridor: 'oman-arabian-sea', t: 0.57, offset: 0.22, speed: 14.6, status: 'Underway', ageMin: 8, destination: 'KARACHI', flag: 'BS' },
  { name: 'MV INDIA GATEWAY', mmsi: '440123506', type: 'Cargo', corridor: 'arabian-sea-west-india', t: 0.14, offset: -0.18, speed: 12.9, status: 'Underway', ageMin: 4, destination: 'NHAVA SHEVA', flag: 'IN' },

  // West India – Sri Lanka
  { name: 'MV MALABAR VOYAGER', mmsi: '440123518', type: 'Container', corridor: 'india-srilanka', t: 0.24, offset: 0.12, speed: 16.1, status: 'Underway', ageMin: 2, destination: 'COLOMBO', flag: 'IN' },
  { name: 'MV NORDIC STAR', mmsi: '440123520', type: 'Tanker', corridor: 'india-srilanka', t: 0.71, offset: -0.14, speed: 8.7, status: 'Underway', ageMin: 11, destination: 'COCHIN', flag: 'NO' },
  { name: 'CAPE MAY', mmsi: '440123532', type: 'Bulk Carrier', corridor: 'india-srilanka', t: 0.46, offset: 0.15, speed: 10.2, status: 'Underway', ageMin: 6, destination: 'CHITTOGONG', flag: 'MT' },

  // Bay of Bengal / Andaman approach
  { name: 'OCEAN PEARL', mmsi: '440123544', type: 'Product Tanker', corridor: 'bay-of-bengal', t: 0.38, offset: -0.13, speed: 11.1, status: 'Underway', ageMin: 3, destination: 'SINGAPORE', flag: 'SG' },
  { name: 'MV SRI LANKA PRIDE', mmsi: '440123556', type: 'Container', corridor: 'bay-of-bengal', t: 0.76, offset: 0.11, speed: 15.4, status: 'Underway', ageMin: 5, destination: 'YANGON', flag: 'LK' },
  { name: 'MV ARABIAN DAWN', mmsi: '440123568', type: 'Fishing', corridor: 'andaman-malacca', t: 0.44, offset: -0.1, speed: 4.6, status: 'Drifting', ageMin: 41, destination: 'PORT BLAIR', flag: 'IN' },
  { name: 'PACIFIC DAWN', mmsi: '440123570', type: 'Cargo', corridor: 'andaman-malacca', t: 0.8, offset: 0.12, speed: 13.7, status: 'Underway', ageMin: 9, destination: 'PENANG', flag: 'SG' },
  { name: 'MV OCEAN VOYAGER', mmsi: '440123582', type: 'Tug', corridor: 'maldives-lane', t: 0.52, offset: -0.08, speed: 6.3, status: 'Anchored', ageMin: 27, destination: 'MALE', flag: 'MV' },
]

/** Size of the synthetic regional fleet, derived so no count is hand-written. */
export const DEMO_FLEET_SIZE = DEMO_FLEET_SPEC.length

/** Synthetic demo fleet. All identities, positions and AIS ages are fabricated. */
export function demoFleet(): VesselDto[] {
  return DEMO_FLEET_SPEC.map((spec, index) => {
    const corridor = DEMO_SHIPPING_CORRIDORS.find((c) => c.id === spec.corridor)
    const path = corridor?.path ?? DEMO_SHIPPING_CORRIDORS[0].path
    const here = pointAlong(path, spec.t)
    const ahead = pointAlong(path, Math.min(1, spec.t + 0.04))
    const [baseLon, baseLat] = here
    // Lane vessels ride beside the lane (never exactly on it); an explicit
    // position overrides both.
    const [lon, lat] = spec.position ?? [baseLon, baseLat + spec.offset]
    // Deterministic per-vessel bearing jitter so no two ships share a heading.
    const jitter = spec.jitter ?? ((index * 37) % 25) - 12
    return {
      id: `DEMO-VSL-${String(index + 1).padStart(3, '0')}`,
      mmsi: spec.mmsi,
      name: spec.name,
      type: spec.type,
      position: { latitude: Number(lat.toFixed(4)), longitude: Number(lon.toFixed(4)) },
      speed: spec.status === 'Underway' ? spec.speed : 0,
      heading: Math.round((bearingBetween(here, ahead) + jitter + 360) % 360),
      imo: `DEMO${String(9300000 + index * 137)}`,
      status: spec.status,
      lastSeen: syntheticIso(-spec.ageMin / 60),
      destination: spec.destination,
      flag: spec.flag,
    }
  })
}

/**
 * The vessels the attribution run scores, derived from geometry rather than
 * hand-listed so the highlighted vessels on the map and the ranked candidates in
 * the panel can never disagree.
 *
 * `center` matters: when a journey releases the spill from a particular vessel,
 * attribution is scored around that position, so the candidates must be the
 * vessels nearest *that* point rather than a fixed set.
 */
export function demoCandidateVessels(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): VesselDto[] {
  return demoFleet()
    .map((v) => ({
      vessel: v,
      km: distanceKm(
        { lon: v.position.longitude, lat: v.position.latitude },
        center,
      ),
    }))
    .filter((x) => x.km <= DEMO_ATTRIBUTION_RADIUS_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, DEMO_CANDIDATE_COUNT)
    .map((x) => x.vessel)
}

/**
 * Organic slick outline.
 *
 * A slick is not a circle: real detections are lobed, elongated and asymmetric.
 * The radius is modulated by three harmonics at different frequencies, so the
 * ring gets lobes and bays instead of a regular polygon, and the whole outline
 * is then rotated to the reported orientation. `scale` is the half-extent in
 * degrees; `elongation` stretches it along the orientation axis.
 */
function slickRing(
  center: { lon: number; lat: number },
  scale: number,
  seedOffset: number,
  elongation = 1.7,
  rotationDeg = 0,
  samples = 26,
): [number, number][] {
  const rand = mulberry32(DEMO_SEED + seedOffset)
  // Per-slick harmonic coefficients, so no two slicks share a silhouette.
  const h1 = 0.18 + rand() * 0.16
  const h2 = 0.1 + rand() * 0.13
  const h3 = 0.06 + rand() * 0.09
  const phase = rand() * Math.PI * 2
  const rot = (rotationDeg * Math.PI) / 180
  const cosRot = Math.cos(rot)
  const sinRot = Math.sin(rot)
  const lonScale = 1 / Math.max(0.35, Math.cos((center.lat * Math.PI) / 180))
  const ring: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const a = (i / samples) * Math.PI * 2
    const lobe =
      1 + h1 * Math.sin(2 * a + phase) + h2 * Math.sin(3 * a + phase * 1.7) + h3 * Math.sin(5 * a - phase)
    // Elongate along the rotation axis, then rotate into place.
    const ex = scale * Math.cos(a) * lobe * elongation
    const ey = scale * Math.sin(a) * lobe
    const rx = ex * cosRot - ey * sinRot
    const ry = ex * sinRot + ey * cosRot
    ring.push([
      Math.round((center.lon + rx * lonScale) * 1e5) / 1e5,
      Math.round((center.lat + ry) * 1e5) / 1e5,
    ])
  }
  return ring
}

/** Convex-ish hull bbox helper for the slick candidates. */
function approxBboxOf(ring: [number, number][]) {
  const lons = ring.map(([x]) => x)
  const lats = ring.map(([, y]) => y)
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  }
}

/** Ground sample spacing of the synthetic scene, in metres. */
const DEMO_SAR_PIXEL_M = 12

/** Kilometres per degree at a given latitude, for a local flat-earth frame. */
const KM_PER_DEG_LON = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180)
const KM_PER_DEG_LAT = 110.57

/**
 * Detector metrics measured off the drawn ring.
 *
 * These used to be hand-written constants sitting next to the geometry, and they
 * had drifted apart badly: the primary slick reported 4.21 km² and a 3.4 km
 * length while the ring the map actually drew was 203 km² and 19 km across. The
 * card and the map were describing two different objects, and nothing caught it
 * because the numbers were never compared with the shape.
 *
 * Measuring instead of asserting means the figure on the card is a property of
 * the polygon under it, so the two cannot disagree. Length and width come from
 * the principal axes rather than the bounding box, so a slick rotated into the
 * map's frame still reports its own long axis instead of its diagonal.
 */
function ringMetrics(ring: [number, number][], center: { lon: number; lat: number }) {
  const kx = KM_PER_DEG_LON(center.lat)
  const ky = KM_PER_DEG_LAT
  const pts = ring.map(([lon, lat]) => [(lon - center.lon) * kx, (lat - center.lat) * ky])

  // Shoelace, on the closed ring.
  let twice = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    twice += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]
  }
  const areaKm2 = Math.abs(twice / 2)

  let perimeterKm = 0
  for (let i = 1; i < pts.length; i++) {
    perimeterKm += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }

  // Principal axes by covariance, so length/width are orientation-independent.
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n
  const my = pts.reduce((s, p) => s + p[1], 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
    sxy += (x - mx) * (y - my)
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const ct = Math.cos(theta)
  const st = Math.sin(theta)
  const us = pts.map(([x, y]) => Math.abs((x - mx) * ct + (y - my) * st))
  const vs = pts.map(([x, y]) => Math.abs(-(x - mx) * st + (y - my) * ct))
  const majorKm = Math.max(...us)
  const minorKm = Math.max(...vs)

  const r2 = (v: number) => Math.round(v * 100) / 100
  return {
    areaKm2: r2(areaKm2),
    perimeterKm: r2(perimeterKm),
    lengthKm: r2(majorKm),
    widthKm: r2(minorKm),
    // How much of its own ellipse the outline fills: 1 is a perfect ellipse.
    shapeFactor: Math.round((areaKm2 / (Math.PI * 0.25 * majorKm * minorKm || 1)) * 100) / 100,
    aspectRatio: Math.round((majorKm / (minorKm || 1)) * 100) / 100,
    orientationDeg: Math.round(((theta * 180) / Math.PI + 360) % 180),
    pixelArea: Math.round((areaKm2 * 1e6) / (DEMO_SAR_PIXEL_M * DEMO_SAR_PIXEL_M)),
  }
}

/** Deterministic close-out of the synthetic slick ring around some centre. */
function aroundOrigin(center: { lon: number; lat: number }, factor: number, jitter: number): [number, number][] {
  return slickRing(center, factor, Math.round(factor * 1000) + jitter)
}

// --- SAR observation --------------------------------------------------------

/**
 * Secondary slick candidates: smaller, lower-confidence observations scattered
 * across the operating region so the map reads as a detection sweep rather than
 * a single isolated detection.
 */
const DEMO_SECONDARY_SLICKS: { id: string; lon: number; lat: number; scale: number; rotation: number; confidence: number }[] = [
  { id: 'DEMO-CAND-0004', lon: 66.4, lat: 15.8, scale: 0.028, rotation: 118, confidence: 0.44 },
  { id: 'DEMO-CAND-0005', lon: 79.6, lat: 8.4, scale: 0.022, rotation: 24, confidence: 0.37 },
  { id: 'DEMO-CAND-0006', lon: 86.2, lat: 12.9, scale: 0.019, rotation: 156, confidence: 0.29 },
]

/**
 * The leading attribution candidate, derived from the fleet so the summary, the
 * investigation record and the highlighted map vessel always name the same ship.
 */
function topCandidateSummary(): { mmsi: string; name: string; rank: number } | null {
  const top = demoCandidateVessels()[0]
  return top ? { mmsi: top.mmsi, name: top.name, rank: 1 } : null
}

function sarCandidates(): SarSlickCandidateDto[] {
  const { lon, lat } = DEMO_SPILL_LOCATION
  const center = { lon, lat }
  // Primary slick: the largest detection, elongated along the reported
  // orientation with a lobed, asymmetric outline.
  //
  // The scale is the one that makes the drawn ring measure 2.4 km², which is the
  // area the incident reports. Area goes as the square of the scale, so this is
  // a measured constant rather than a drawn guess - demo-data-check recomputes it
  // from the polygon and fails if the two ever part company.
  const primaryRing = slickRing(center, 0.005651, 11, 1.9, 38)
  const primary = ringMetrics(primaryRing, center)
  // Look-alike sits inside the primary footprint — same scene, rejected class.
  const lookAlikeRing = slickRing({ lon: lon - 0.0007, lat: lat + 0.0004 }, 0.0014, 31, 1.4, 205)
  const lookAlike = ringMetrics(lookAlikeRing, { lon: lon - 0.0007, lat: lat + 0.0004 })
  const approxBbox = approxBboxOf
  const secondary = DEMO_SECONDARY_SLICKS.map((s) => {
    const at = { lon: s.lon, lat: s.lat }
    const ring = slickRing(at, s.scale, 47 + s.id.length + Math.round(s.lon), 1.5, s.rotation)
    const m = ringMetrics(ring, at)
    return {
      candidate_id: s.id,
      classification: 'UNCERTAIN' as const,
      confidence: s.confidence,
      polygon: ring,
      centroid: [s.lon, s.lat] as [number, number],
      bbox: approxBbox(ring),
      area_km2: m.areaKm2,
      perimeter_km: m.perimeterKm,
      length_km: m.lengthKm,
      width_km: m.widthKm,
      aspect_ratio: m.aspectRatio,
      orientation_deg: m.orientationDeg,
      shape_factor: m.shapeFactor,
      pixel_area: m.pixelArea,
      contrast_db: Math.round((-0.4 - s.confidence * 1.6) * 100) / 100,
      incidence_deg: 33.9,
      look_alike_hints: ['low contrast', 'wind-current alignment unconfirmed'],
      warnings: [DEMO_PROVENANCE_NOTE],
    }
  })
  return [
    {
      candidate_id: DEMO_SLICK_ID,
      classification: 'OIL_CANDIDATE',
      confidence: DEMO_SLICK_CONFIDENCE,
      polygon: primaryRing,
      centroid: [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000],
      bbox: approxBbox(primaryRing),
      area_km2: primary.areaKm2,
      perimeter_km: primary.perimeterKm,
      length_km: primary.lengthKm,
      width_km: primary.widthKm,
      aspect_ratio: primary.aspectRatio,
      orientation_deg: primary.orientationDeg,
      shape_factor: primary.shapeFactor,
      pixel_area: primary.pixelArea,
      contrast_db: -2.13,
      incidence_deg: 33.8,
      look_alike_hints: [],
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    {
      candidate_id: 'DEMO-CAND-0003',
      classification: 'LOOK_ALIKE',
      confidence: 0.21,
      polygon: lookAlikeRing,
      centroid: [Math.round((lon - 0.0007) * 1000) / 1000, Math.round((lat + 0.0004) * 1000) / 1000],
      bbox: approxBbox(lookAlikeRing),
      area_km2: lookAlike.areaKm2,
      perimeter_km: lookAlike.perimeterKm,
      length_km: lookAlike.lengthKm,
      width_km: lookAlike.widthKm,
      aspect_ratio: lookAlike.aspectRatio,
      orientation_deg: lookAlike.orientationDeg,
      shape_factor: lookAlike.shapeFactor,
      pixel_area: lookAlike.pixelArea,
      contrast_db: -0.41,
      incidence_deg: 33.5,
      look_alike_hints: ['biogenic film', 'low backscatter'],
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    ...secondary,
  ]
}

export function sarObservation(): SarObservationDto {
  // The observation's headline figures are the primary candidate's own figures,
  // read back out of the candidate list rather than typed alongside it. That is
  // what stops "4.21 km² on the card, 203 km² on the map" from being possible.
  const candidates = sarCandidates()
  const primary = candidates.find((c) => c.classification === 'OIL_CANDIDATE')
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
    candidates,
    confidence: primary?.confidence ?? 0,
    slick_area_km2: primary?.area_km2 ?? 0,
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

/**
 * Ranked candidates for the demo attribution run.
 *
 * Ranking is derived from real geometry — distance to the slick — rather than a
 * hand-written table, so the three highlighted vessels on the map are exactly
 * the three vessels the panel ranks.
 */
function rankedVessels(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): RankedVesselDto[] {
  const factorBase: Record<FactorKey, number> = {
    spatial: 0.9,
    temporal: 0.86,
    trajectory: 0.88,
    anomaly: 0.74,
    environmental: 0.8,
  }
  // demoCandidateVessels() is already ordered nearest-first.
  return demoCandidateVessels(center)
    .map((v, i) => {
      const lon = v.position.longitude
      const lat = v.position.latitude
      const km = distanceKm({ lon, lat }, center)
      const scale = DEMO_CANDIDATE_COUNT > 1 ? i / (DEMO_CANDIDATE_COUNT - 1) : 0
      // Proximity dominates, so the closest vessel leads. The top score lands
      // near 0.84, keeping the existing conclusion thresholds and copy valid.
      const proximity = 1 - Math.min(1, km / DEMO_ATTRIBUTION_RADIUS_KM)
      const score = Math.round((0.44 + 0.44 * proximity + 0.05 * (1 - scale)) * 1000) / 1000
      const factors = Object.fromEntries(
        FACTOR_KEYS.map((k) => [k, Math.round((factorBase[k] * (1 - 0.3 * scale)) * 1000) / 1000]),
      ) as Record<FactorKey, number>
      return {
        rank: 0,
        mmsi: v.mmsi,
        name: v.name,
        vessel_type: v.type,
        imo: v.imo ?? null,
        score,
        factors,
        factor_evidence: Object.fromEntries(
          FACTOR_KEYS.map((k) => [
            k,
            {
              note: `${DEMO_PROVENANCE_NOTE} — synthetic ${k} factor`,
              weight: factors[k],
              distance_km: Math.round(km * 10) / 10,
              position: { lon, lat },
            },
          ]),
        ),
        data_quality: {
          reliability: i === 0 ? 'HIGH' : 'MEDIUM',
          notes: [DEMO_PROVENANCE_NOTE],
          messages_in_window: 214 - i * 37,
          median_cadence_min: 9 + i * 4,
          interpolation_fraction: 0.04,
          coverage_gaps: i === 0 ? 0 : i,
          anomalies: i === 0 ? [] : ['sparse coverage'],
        },
        min_distance_km: Math.round(km * 10) / 10,
        time_of_closest_approach: syntheticIso(-4.9),
        closest_position: { lon, lat },
        warnings: [DEMO_PROVENANCE_NOTE],
      }
    })
    .map((v, idx) => ({ ...v, rank: idx + 1 }))
}

export function attributionDto(center: { lon: number; lat: number } = DEMO_SPILL_LOCATION): AttributionRunDto {
  const { lon, lat } = center
  const inScope = demoCandidateVessels(center)
  const ranked = rankedVessels(center)
  const total = demoFleet().length
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
    ranking: (() => {
      const top = ranked[0]?.score ?? 0
      const second = ranked[1]?.score ?? 0
      const margin = Math.round((top - second) * 100) / 100
      return { top_score: top, second_score: second, margin, decisive: margin > 0.2 }
    })(),
    rankedVessels: ranked,
    warnings: [DEMO_PROVENANCE_NOTE],
    scoreWarnings: [],
    errors: [],
    origin: { lat, lon },
    timeRange: { earliest: syntheticIso(-6), latest: syntheticIso(-4.5), preferred: syntheticIso(-5) },
    releaseTime: syntheticIso(-5),
    radiusKm: DEMO_ATTRIBUTION_RADIUS_KM,
    maxGapMin: 90,
    seed: DEMO_SEED,
    environmentSource: DEMO_PROVENANCE,
    aisQuery: {
      sourceState: DEMO_PROVENANCE,
      provider: DEMO_AIS_SOURCE,
      dataset: 'SYNTHETIC AIS',
      vesselCount: total,
      elapsedMs: 420,
      warnings: [DEMO_PROVENANCE_NOTE],
    },
    filter: {
      kept: inScope.length,
      dropped: total - inScope.length,
      stats: { total, inside_radius: inScope.length },
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
    case 'detection': {
      const primary = sarCandidates().find((c) => c.classification === 'OIL_CANDIDATE')
      return {
        referenceId: DEMO_SAR_OBSERVATION_ID,
        referenceType: 'sarObservation',
        // Read from the candidates, so the stage record cannot quote an area the
        // map is not drawing.
        summary: {
          candidates: 3,
          topConfidence: primary?.confidence ?? 0,
          slickAreaKm2: primary?.area_km2 ?? 0,
        },
      }
    }
    case 'characterization':
      return { referenceId: DEMO_SAR_OBSERVATION_ID, referenceType: 'sarObservation', summary: { primaryCandidate: DEMO_SLICK_ID } }
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
      return { referenceId: DEMO_ATTRIBUTION_RUN_ID, referenceType: 'attributionRun', summary: { provider: DEMO_AIS_SOURCE, vesselCount: DEMO_FLEET_SIZE, sourceState: DEMO_PROVENANCE } }
    case 'attribution': {
      const ranking = attributionDto().ranking
      return {
        referenceId: DEMO_ATTRIBUTION_RUN_ID,
        referenceType: 'attributionRun',
        summary: {
          rankedVessels: DEMO_CANDIDATE_COUNT,
          margin: ranking?.margin ?? 0,
          decisive: ranking?.decisive ?? false,
        },
      }
    }
    case 'conclusion':
      return { referenceId: DEMO_ATTRIBUTION_RUN_ID, referenceType: 'attributionRun', summary: { conclusion: 'candidate', mmsi: demoCandidateVessels()[0]?.mmsi ?? null } }
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
    candidate: status ? topCandidateSummary() : null,
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

/**
 * Synthetic environmental grid for the demo session.
 *
 * The live ERA5/CMEMS integrations are not connected, so this grid is the only
 * thing the current and wind overlays may ever draw from in demo mode. It is a
 * coarse regional lattice over the operating box: each axis keeps a large-scale
 * drift with a smaller gyre term, so the vector field reads as ocean-like
 * without pretending to be a real forecast.
 */
export function demoEnvironmentGrid(axis: 'current' | 'wind') {
  const west = 46
  const east = 96
  const south = -2
  const north = 24
  const cols = 9
  const rows = 5
  const fields: { lat: number; lon: number; u: number; v: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = south + ((north - south) * r) / (rows - 1)
      const lon = west + ((east - west) * c) / (cols - 1)
      // Monsoon drift: strong westerly in summer, easing north of the equator.
      const seasonal = Math.cos((lat * Math.PI) / 180)
      // A slow gyre so the field curves instead of running in straight lines.
      const gyre = Math.sin(((lon - 70) * Math.PI) / 42) * 0.45
      if (axis === 'wind') {
        fields.push({
          lat: Number(lat.toFixed(2)),
          lon: Number(lon.toFixed(2)),
          u: Number((3.4 * seasonal + gyre * 1.6).toFixed(3)),
          v: Number((0.6 * seasonal - 0.9 * gyre).toFixed(3)),
        })
      } else {
        fields.push({
          lat: Number(lat.toFixed(2)),
          lon: Number(lon.toFixed(2)),
          u: Number((0.34 * seasonal + gyre * 0.22).toFixed(3)),
          v: Number((0.08 * seasonal - 0.12 * gyre).toFixed(3)),
        })
      }
    }
  }
  return {
    source: `${DEMO_PROVENANCE} ${axis === 'wind' ? 'WIND' : 'CURRENT'}`,
    note: DEMO_PROVENANCE_NOTE,
    fields,
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
    vesselId: demoCandidateVessels({ lon: session.spillLon, lat: session.spillLat })[0]?.id ?? null,
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
  // Same ring the map draws and the SAR observation reports, so the incident
  // record cannot describe a third, different slick.
  const ring = slickRing(center, 0.005651, 11, 1.9, 38)
  const m = ringMetrics(ring, center)
  return {
    slick: {
      geometry: { type: 'Polygon', coordinates: [ring] },
      area_km2: m.areaKm2,
      centroid: { lat: center.lat, lon: center.lon },
      orientation: m.orientationDeg,
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