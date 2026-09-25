/**
 * M11 Phase 7 — Incident Journey layer (STATIC vessels + rich telemetry).
 *
 * The journey layer connects the six flat workstations into one coherent
 * narrative by deriving, READ-ONLY, where an operating case sits between
 * "scenario created" and "investigation concluded". All inputs come from the
 * existing domain stores and the Phase 6 deterministic demo runtime. Nothing
 * here moves or fabricates a vessel: we surface store-derived position and the
 * incident-relative geometry computed from those same positions.
 *
 * The pure derivation functions (`deriveJourney`, `findMatchedFleetVessel`,
 * `initialBearingDeg`) are exported for focused unit tests.
 */
import { useMemo } from 'react'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore, STAGE_ORDER, STAGE_LABEL } from '@/store/investigationStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { haversineKm } from '@/components/map/maritime/geo'
import type {
  AttributionVesselEntry,
  DriftRunStatus,
  IntegratedVessel,
  InvestigationStageId,
  InvestigationStageState,
  InvestigationStageStatus,
  InvestigationStatus,
  SimulationStatus,
} from '@/types/domain'
import type { AppRoutePath } from '@/routes'

export type JourneyPhase =
  | 'idle'
  | 'captain'
  | 'scenario'
  | 'spill'
  | 'drift'
  | 'pipeline'
  | 'backtracked'
  | 'attributed'
  | 'concluded'

/** The canonical 8-stage investigation pipeline — same order as the store. */
export type JourneyStageNode = {
  id: InvestigationStageId
  label: string
  status: InvestigationStageStatus
}

/** Pre-pipeline milestones shown while only a scenario exists. */
export type JourneyPreflightNode = {
  id: 'scenario' | 'spill' | 'drift'
  label: string
  done: boolean
}

export type JourneyGuidance = {
  phase: JourneyPhase
  title: string
  context: string
  nextAction: string | null
  nextRoute: AppRoutePath | null
}

export type JourneyState = {
  /** False when there is no simulation and no investigation — the layer hides. */
  active: boolean
  guidance: JourneyGuidance
  /** Present when an investigation exists; otherwise null (preflight shown). */
  pipeline: JourneyStageNode[] | null
  preflight: JourneyPreflightNode[]
  fleetSize: number
  matchedVessels: number
  pipelineComplete: boolean
}

type MmsiName = { mmsi?: string | null; name?: string | null }

/**
 * Identity match used everywhere the journey must link a fleet vessel (simulation
 * store) to an AIS candidate (attribution/investigation store). MMSI is the
 * contractual key; an explicit name is the fallback so partially-observed
 * candidates still resolve. Comparisons are exact MMSI and case-insensitive
 * trimmed name — never a fuzzy guess.
 */
export function findMatchedFleetVessel<T extends MmsiName>(
  pool: T[],
  mmsi?: string | null,
  name?: string | null,
): T | null {
  if (!Array.isArray(pool) || pool.length === 0) return null
  const targetMmsi = mmsi?.trim()
  if (targetMmsi) {
    const byMmsi = pool.find((v) => v.mmsi?.trim() === targetMmsi)
    if (byMmsi) return byMmsi
  }
  const targetName = name?.trim().toLowerCase()
  if (targetName) {
    const byName = pool.find((v) => v.name?.trim().toLowerCase() === targetName)
    if (byName) return byName
  }
  return null
}

/** Great-circle initial bearing (degrees 0–360) from A toward B; null on degenerate input. */
export function initialBearingDeg(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
): number | null {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  if (
    !Number.isFinite(from.lon) ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(to.lon) ||
    !Number.isFinite(to.lat)
  ) {
    return null
  }
  const dLon = toRad(to.lon - from.lon)
  const y = Math.sin(dLon) * Math.cos(toRad(to.lat))
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLon)
  const brng = toDeg(Math.atan2(y, x))
  const normalized = (brng + 360) % 360
  return Number.isFinite(normalized) ? normalized : null
}

export type JourneyInput = {
  simulationId: string | null
  simStatus: SimulationStatus | null
  fleetSize: number
  spillReleased: boolean
  driftStatus: DriftRunStatus
  investigationId: string | null
  invStatus: InvestigationStatus | null
  invStages: InvestigationStageState[]
  btBacktracked: boolean
  attRanked: boolean
}

const IDLE_GUIDANCE: JourneyGuidance = {
  phase: 'idle',
  title: 'No active case',
  context: 'Create and run a scenario to open the incident journey.',
  nextAction: 'Open simulation',
  nextRoute: '/simulation',
}

/**
 * Pure stage machine: reads verified store state only and derives (a) the
 * journey phase, (b) the headline guidance, (c) the next recommended action.
 * Precedence is documented and deterministic; every branch must be honest —
 * no fake progress, no invented stages.
 */
export function deriveJourney(input: JourneyInput): JourneyState {
  const hasSim = Boolean(input.simulationId)
  const invActive =
    Boolean(input.investigationId) && input.invStages.length > 0 && input.invStatus !== 'CANCELLED'

  // No case at all → the journey layer hides entirely.
  if (!hasSim && !invActive) {
    return {
      active: false,
      guidance: IDLE_GUIDANCE,
      pipeline: null,
      preflight: [],
      fleetSize: input.fleetSize,
      matchedVessels: 0,
      pipelineComplete: false,
    }
  }

  const preflight: JourneyPreflightNode[] = [
    { id: 'scenario', label: 'Scenario', done: input.simStatus !== null && input.simStatus !== 'captain_mode' },
    { id: 'spill', label: 'Spill', done: input.spillReleased },
    { id: 'drift', label: 'Forward drift', done: input.driftStatus === 'completed' },
  ]

  const completedCount = input.invStages.filter((s) => s.status === 'completed').length

  let phase: JourneyPhase = 'idle'
  let title = 'No active case'
  let context = ''
  let nextAction: string | null = null
  let nextRoute: AppRoutePath | null = null

  if (input.invStatus === 'COMPLETED') {
    phase = 'concluded'
    title = 'Investigation concluded'
    context = 'All pipeline stages complete — open the incident dossier.'
    nextAction = 'Open incident dossier'
    nextRoute = '/report'
  } else if (input.invStatus === 'RUNNING') {
    phase = 'pipeline'
    title = 'Investigation in progress'
    context = `${completedCount}/${input.invStages.length} stages complete`
    nextAction = 'Monitor pipeline'
    nextRoute = '/investigation'
  } else if (input.invStatus === 'CREATED') {
    phase = 'pipeline'
    title = 'Investigation ready'
    context = 'Pipeline configured — start the 8-stage run.'
    nextAction = 'Start investigation'
    nextRoute = '/investigation'
  } else if (input.invStatus === 'FAILED') {
    phase = 'pipeline'
    title = 'Investigation failed'
    context = 'A pipeline stage reported an error.'
    nextAction = 'Retry investigation'
    nextRoute = '/investigation'
  } else if (input.attRanked) {
    phase = 'attributed'
    title = 'Vessel attribution ranked'
    context = 'AIS corridor scored — review the ranked candidates.'
    nextAction = 'Review attribution'
    nextRoute = '/attribution'
  } else if (input.btBacktracked) {
    phase = 'backtracked'
    title = 'Source backtracking solved'
    context = 'Backtracking converged on a probable source window.'
    nextAction = 'Run vessel attribution'
    nextRoute = '/attribution'
  } else if (input.driftStatus === 'completed') {
    phase = 'drift'
    title = 'Forward drift complete'
    context = 'Dispersion modelled — ready to launch the investigation.'
    nextAction = 'Launch investigation'
    nextRoute = '/investigation'
  } else if (input.spillReleased) {
    phase = 'spill'
    title = 'Spill observation recorded'
    context = 'Run forward drift to model the dispersion.'
    nextAction = 'Run forward drift'
    nextRoute = '/simulation'
  } else if (input.simStatus === 'captain_mode') {
    phase = 'captain'
    title = 'Scenario configured'
    context = `${input.fleetSize} fleet vessels in Captain mode.`
    nextAction = 'Start simulation'
    nextRoute = '/simulation'
  } else if (hasSim) {
    phase = 'scenario'
    title = 'Scenario in session'
    context = 'Observation running — release a spill to open a case.'
    nextAction = 'Open simulation'
    nextRoute = '/simulation'
  }

  const pipeline: JourneyStageNode[] | null = invActive
    ? STAGE_ORDER.map((id) => {
        const st = input.invStages.find((x) => x.stageId === id)
        return { id, label: STAGE_LABEL[id] ?? id, status: st?.status ?? 'pending' }
      })
    : null

  return {
    active: true,
    guidance: { phase, title, context, nextAction, nextRoute },
    pipeline,
    preflight,
    fleetSize: input.fleetSize,
    matchedVessels: 0,
    pipelineComplete: input.invStatus === 'COMPLETED',
  }
}

/**
 * The unified fleet: every simulation-store vessel joined to its AIS candidate
 * (MMSI/name identity) plus incident-relative geometry (distance & bearing from
 * the released spill). Read-only; candidates stay null when no spill exists.
 */
export type UnifiedVessel = {
  fleet: IntegratedVessel
  candidate: AttributionVesselEntry | null
  /** Great-circle distance (km) from the released spill to the fleet position. */
  distanceKm: number | null
  /** Bearing (deg) from the released spill toward the fleet position. */
  bearingDeg: number | null
  spillLocation: { lon: number; lat: number } | null
}

export function useUnifiedVessels(): UnifiedVessel[] {
  const vessels = useSimulationStore((s) => s.vessels)
  const spill = useSimulationStore((s) => s.spill)
  const candidates = useAttributionStore((s) => s.vessels)

  return useMemo(() => {
    const spillLocation = spill?.location ?? null
    return vessels.map((fleet) => {
      const candidate = findMatchedFleetVessel(candidates, fleet.mmsi, fleet.name)
      let distanceKm: number | null = null
      let bearingDeg: number | null = null
      if (spillLocation) {
        distanceKm = haversineKm(spillLocation, fleet.position)
        bearingDeg = initialBearingDeg(spillLocation, fleet.position)
      }
      return { fleet, candidate, distanceKm, bearingDeg, spillLocation }
    })
  }, [vessels, spill, candidates])
}

export function useUnifiedVesselById(id: string | null | undefined): UnifiedVessel | null {
  const unified = useUnifiedVessels()
  return useMemo(() => unified.find((u) => u.fleet.id === id) ?? null, [unified, id])
}

/** Current incident-journey state derived from the live domain stores. */
export function useJourneyState(): JourneyState {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const simStatus = useSimulationStore((s) => s.status)
  const vessels = useSimulationStore((s) => s.vessels)
  const spill = useSimulationStore((s) => s.spill)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const invStatus = useInvestigationStore((s) => s.status)
  const invStages = useInvestigationStore((s) => s.stages)
  const btStatus = useBacktrackingStore((s) => s.status)
  const btOrigin = useBacktrackingStore((s) => s.origin)
  const attStatus = useAttributionStore((s) => s.status)
  const attVessels = useAttributionStore((s) => s.vessels)

  return useMemo(() => {
    const journey = deriveJourney({
      simulationId,
      simStatus,
      fleetSize: vessels.length,
      spillReleased: Boolean(spill?.spillEventId),
      driftStatus,
      investigationId,
      invStatus,
      invStages,
      btBacktracked: btStatus === 'completed' && btOrigin != null,
      attRanked: attStatus === 'completed' && attVessels.length > 0,
    })
    // Count fleet vessels that resolve to an AIS candidate (identity match).
    const matchedVessels = vessels.filter(
      (v) => findMatchedFleetVessel(attVessels, v.mmsi, v.name) != null,
    ).length
    return { ...journey, fleetSize: vessels.length, matchedVessels }
  }, [
    simulationId,
    simStatus,
    vessels,
    spill,
    driftStatus,
    investigationId,
    invStatus,
    invStages,
    btStatus,
    btOrigin,
    attStatus,
    attVessels,
  ])
}