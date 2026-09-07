import type { InvestigationStageId, InvestigationStageStatus } from '@/types/domain'

/**
 * WebSocket event contract, aligned with SYSTEM_SPEC §15.3.
 *
 * Backend topics:
 *   /ws/simulation/{id}
 *   /ws/investigation/{id}
 */

export type WsEventType =
  | 'clock_update'
  | 'vessel_moved'
  | 'spill_released'
  | 'oil_particles'
  | 'forward_drift.started'
  | 'forward_drift.completed'
  | 'forward_drift.failed'
  | 'investigation_started'
  | 'step_complete'
  | 'origin_estimated'
  | 'vessels_ranked'
  | 'investigation_complete'
  | 'investigation_failed'
  | 'investigation_cancelled'
  | 'groundtruth.revealed'
  | 'sar_observation.started'
  | 'sar_observation.completed'
  | 'sar_observation.failed'
  | 'backtracking.started'
  | 'backtracking.completed'
  | 'backtracking.failed'
  | 'ais_search.started'
  | 'ais_search.completed'
  | 'ais_search.failed'
  | 'vessels_filtered'
  | 'attribution.started'
  | 'vessel_scores_ready'
  | 'attribution.completed'

export type LatLngData = { lat: number; lon: number }

export type SimulationEventPayloadMap = {
  clock_update: { type: 'clock_update'; time: string }
  vessel_moved: {
    type: 'vessel_moved'
    vesselId: string
    position: LatLngData
    speed: number
    heading: number
  }
  spill_released: {
    type: 'spill_released'
    spillEventId: string
    location: LatLngData
    vesselId: string
  }
  oil_particles: {
    type: 'oil_particles'
    particles: { lat: number; lon: number; radius: number; opacity: number }[]
  }
  'forward_drift.started': {
    type: 'forward_drift.started'
    forwardDriftRunId?: string
    message?: string
  }
  'forward_drift.completed': {
    type: 'forward_drift.completed'
    forwardDriftRunId: string
    message?: string
  }
  'forward_drift.failed': {
    type: 'forward_drift.failed'
    forwardDriftRunId?: string
    message?: string
  }
}

/** STEP 11: investigation lifecycle frames (pushed on /ws/investigation/{id}). */
export type InvestigationEventPayloadMap = {
  investigation_started: {
    type: 'investigation_started'
    investigationId: string
    simulationId?: string
    message?: string
  }
  step_complete: {
    type: 'step_complete'
    investigationId?: string
    simulationId?: string
    stageId?: InvestigationStageId
    stageStatus?: InvestigationStageStatus
    progress?: number
    detail?: string
    message?: string
  }
  origin_estimated: {
    type: 'origin_estimated'
    investigationId?: string
    simulationId?: string
    stageId?: string
    originEstimate?: { lat: number; lon: number } | null
    uncertaintyKm?: number
    confidence?: number
    message?: string
  }
  vessels_ranked: {
    type: 'vessels_ranked'
    investigationId?: string
    simulationId?: string
    stageId?: string
    rankedVessels?: unknown
    margin?: number
    message?: string
  }
  investigation_complete: {
    type: 'investigation_complete'
    investigationId?: string
    simulationId?: string
    stageId?: string
    stageStatus?: string
    progress?: number
    conclusionStatus?: string | null
    conclusion?: Record<string, unknown> | null
    message?: string
  }
  investigation_failed: {
    type: 'investigation_failed'
    investigationId?: string
    simulationId?: string
    message?: string
  }
  investigation_cancelled: {
    type: 'investigation_cancelled'
    investigationId?: string
    simulationId?: string
    message?: string
  }
  'groundtruth.revealed': { type: 'groundtruth.revealed'; actualOrigin: LatLngData }
}

/** Step 07: SAR observation lifecycle events (pushed on the simulation topic). */
export type SarEventPayloadMap = {
  'sar_observation.started': {
    type: 'sar_observation.started'
    sarObservationId?: string
    message?: string
  }
  'sar_observation.completed': {
    type: 'sar_observation.completed'
    sarObservationId?: string
    message?: string
    sarResult?: Record<string, unknown>
  }
  'sar_observation.failed': {
    type: 'sar_observation.failed'
    sarObservationId?: string
    message?: string
  }
}

/** Step 09: backtracking lifecycle events (pushed on the simulation topic). */
export type BacktrackEventPayloadMap = {
  'backtracking.started': {
    type: 'backtracking.started'
    backtrackRunId?: string
    message?: string
  }
  'backtracking.completed': {
    type: 'backtracking.completed'
    backtrackRunId?: string
    message?: string
  }
  'backtracking.failed': {
    type: 'backtracking.failed'
    backtrackRunId?: string
    message?: string
  }
  origin_estimated: {
    type: 'origin_estimated'
    origin: LatLngData
    uncertainty_km: number
    confidence: number
  }
}

/**
 * Step 10: AIS / attribution lifecycle events (pushed on the simulation topic).
 * Field names match SimulationEvent's camelCase wire contract; ranked_vessels
 * payloads are passed through verbatim from the scientific service (snake_case).
 */
export type AttributionEventPayloadMap = {
  'ais_search.started': {
    type: 'ais_search.started'
    attributionRunId?: string
    aisSource?: string
    message?: string
  }
  'ais_search.completed': {
    type: 'ais_search.completed'
    attributionRunId?: string
    aisSource?: string
    vesselCount?: number
    result?: Record<string, unknown>
    message?: string
  }
  'ais_search.failed': {
    type: 'ais_search.failed'
    attributionRunId?: string
    message?: string
  }
  vessels_filtered: {
    type: 'vessels_filtered'
    kept?: number
    dropped?: number
    filterStats?: Record<string, unknown>
    message?: string
  }
  'attribution.started': {
    type: 'attribution.started'
    attributionRunId?: string
    message?: string
  }
  vessel_scores_ready: {
    type: 'vessel_scores_ready'
    attributionRunId?: string
    rankedVessels?: unknown
    weightsUsed?: Record<string, unknown>
    message?: string
  }
  'attribution.completed': {
    type: 'attribution.completed'
    attributionRunId?: string
    conclusion?: string
    result?: Record<string, unknown>
    message?: string
  }
}

export type SimulationWsEvent = SimulationEventPayloadMap[keyof SimulationEventPayloadMap]
export type InvestigationWsEvent =
  InvestigationEventPayloadMap[keyof InvestigationEventPayloadMap]
export type SarWsEvent = SarEventPayloadMap[keyof SarEventPayloadMap]
export type BacktrackWsEvent = BacktrackEventPayloadMap[keyof BacktrackEventPayloadMap]
export type AttributionWsEvent = AttributionEventPayloadMap[keyof AttributionEventPayloadMap]
export type WsEvent =
  | SimulationWsEvent
  | InvestigationWsEvent
  | SarWsEvent
  | BacktrackWsEvent
  | AttributionWsEvent

export const WS_EVENT_TYPES: readonly WsEventType[] = [
  'clock_update',
  'vessel_moved',
  'spill_released',
  'oil_particles',
  'forward_drift.started',
  'forward_drift.completed',
  'forward_drift.failed',
  'investigation_started',
  'step_complete',
  'origin_estimated',
  'vessels_ranked',
  'investigation_complete',
  'investigation_failed',
  'investigation_cancelled',
  'groundtruth.revealed',
  'sar_observation.started',
  'sar_observation.completed',
  'sar_observation.failed',
  'backtracking.started',
  'backtracking.completed',
  'backtracking.failed',
  'ais_search.started',
  'ais_search.completed',
  'ais_search.failed',
  'vessels_filtered',
  'attribution.started',
  'vessel_scores_ready',
  'attribution.completed',
]

export function isWsEvent(value: unknown): value is WsEvent {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return typeof type === 'string' && (WS_EVENT_TYPES as readonly string[]).includes(type)
}