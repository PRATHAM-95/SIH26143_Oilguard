import { get, post } from '@/lib/http'
import type {
  InvestigationConclusionState,
  InvestigationEvidence,
  InvestigationParamsState,
  InvestigationStageState,
  InvestigationStatus,
  InvestigationSummaryState,
} from '@/types/domain'

export type StartInvestigationRequest = {
  sarSource?: string
  sarDetector?: string
  maxCandidates?: number
  backtrackEnsembleSize?: number
  backtrackParticlesPerMember?: number
  backtrackDurationHours?: number
  forwardDriftParticleCount?: number
  forwardDriftDurationHours?: number
  environmentSource?: string
  aisSource?: string
  radiusKm?: number
  maxGapMin?: number
  seed?: number
}

export type InvestigationDto = {
  investigationId: string
  incidentId: string | null
  simulationId: string | null
  spillEventId: string | null
  status: InvestigationStatus
  params: InvestigationParamsState
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  progress: number
  stages: InvestigationStageState[]
  evidence: InvestigationEvidence[]
  conclusion: InvestigationConclusionState
  provenance: { aggregation: string; perStage: Record<string, string> }
  errors: string[]
  warnings: string[]
  reveal: { revealed: boolean }
  reused?: boolean
}

export type RevealResponse = {
  investigationId: string
  revealed: boolean
  positionError_km: number
  timeError_min: number | null
  attributionCorrect: boolean
  scoreMargin: number
  notes: string[]
  revealedAt: string
}

export type InvestigationReport = Record<string, unknown>

/**
 * STEP 11 investigation API — frozen contract (see InvestigationController).
 */
export const investigationApi = {
  /** POST /api/investigation/{incidentId}/start — idempotent; REUSES an active investigation. */
  start: (incidentId: string, req?: StartInvestigationRequest): Promise<InvestigationDto> =>
    post<InvestigationDto>(`/api/investigation/${encodeURIComponent(incidentId)}/start`, req ?? {}),

  /** GET /api/investigation/{id} — full persistent state (re-hydration source). */
  get: (id: string): Promise<InvestigationDto> =>
    get<InvestigationDto>(`/api/investigation/${encodeURIComponent(id)}`),

  /** GET /api/investigation/{id}/steps — ordered stage list. */
  steps: (id: string): Promise<InvestigationStageState[]> =>
    get<InvestigationStageState[]>(`/api/investigation/${encodeURIComponent(id)}/steps`),

  /** GET /api/investigation — filterable list (simulationId / incidentId / status). */
  list: (opts?: {
    simulationId?: string
    incidentId?: string
    status?: InvestigationStatus
  }): Promise<InvestigationSummaryState[]> => {
    const q = new URLSearchParams()
    if (opts?.simulationId) q.set('simulationId', opts.simulationId)
    if (opts?.incidentId) q.set('incidentId', opts.incidentId)
    if (opts?.status) q.set('status', opts.status)
    const qs = q.toString()
    return get<InvestigationSummaryState[]>(`/api/investigation${qs ? `?${qs}` : ''}`)
  },

  /** POST /api/investigation/{id}/retry — resume FAILED/SKIPPED/UNAVAILABLE stages (or one stage). */
  retry: (id: string, stageId?: string): Promise<InvestigationDto> =>
    post<InvestigationDto>(
      `/api/investigation/${encodeURIComponent(id)}/retry`,
      stageId ? { stageId } : {},
    ),

  /** POST /api/investigation/{id}/cancel — cancel a CREATED/RUNNING investigation. */
  cancel: (id: string): Promise<InvestigationDto> =>
    post<InvestigationDto>(`/api/investigation/${encodeURIComponent(id)}/cancel`),

  /** POST /api/investigation/{id}/reveal — ground-truth comparison (COMPLETED only). */
  reveal: (id: string): Promise<RevealResponse> =>
    post<RevealResponse>(`/api/investigation/${encodeURIComponent(id)}/reveal`),

  /** GET /api/investigation/{id}/report — 12-section deterministic report. */
  report: (id: string): Promise<InvestigationReport> =>
    get<InvestigationReport>(`/api/investigation/${encodeURIComponent(id)}/report`),
}