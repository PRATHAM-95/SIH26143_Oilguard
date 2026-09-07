import { create } from 'zustand'
import type {
  InvestigationConclusionState,
  InvestigationEvidence,
  InvestigationStageId,
  InvestigationStageState,
  InvestigationStageStatus,
  InvestigationState,
} from '@/types/domain'
import { investigationApi, type InvestigationDto } from '@/lib/api/investigationApi'
import type { InvestigationWsEvent } from '@/lib/ws'

export const STAGE_LABEL: Record<string, string> = {
  detection: 'Detection',
  characterization: 'Characterization',
  environment: 'Environment',
  forward_drift: 'Forward Drift',
  backtracking: 'Backtracking',
  ais: 'AIS Analysis',
  attribution: 'Attribution',
  conclusion: 'Conclusion',
}

export const STAGE_ORDER: InvestigationStageId[] = [
  'detection',
  'characterization',
  'environment',
  'forward_drift',
  'backtracking',
  'ais',
  'attribution',
  'conclusion',
]

export const CRITICAL_STAGES = new Set<string>(['detection', 'backtracking', 'ais', 'attribution'])

const EMPTY_CONCLUSION: InvestigationConclusionState = {
  status: null,
  reason: null,
  aggregation: null,
  provenance: null,
  topScore: null,
  margin: null,
  decisive: null,
  candidate: null,
  thresholdsUsed: null,
  why: null,
  referenceAttributionRunId: null,
  referenceBacktrackRunId: null,
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

function hydrateStage(s: InvestigationStageState): InvestigationStageState {
  return {
    ...s,
    // Backend serialises statuses as UPPERCASE enums (e.g. COMPLETED); every
    // UI consumer expects the lowercase form declared in the domain type.
    status:
      (typeof s.status === 'string' ? s.status.toLowerCase() : s.status) as InvestigationStageStatus,
  }
}

function hydrate(dto: InvestigationDto): InvestigationState {
  return {
    investigationId: dto.investigationId,
    incidentId: dto.incidentId ?? null,
    simulationId: dto.simulationId ?? null,
    spillEventId: dto.spillEventId ?? null,
    status: dto.status,
    progress: dto.progress ?? 0,
    stages: (dto.stages ?? []).map(hydrateStage),
    params: dto.params ?? null,
    conclusion: dto.conclusion && dto.conclusion.status ? dto.conclusion : { ...EMPTY_CONCLUSION },
    evidence: (dto.evidence ?? []) as InvestigationEvidence[],
    provenance: dto.provenance ?? null,
    errors: dto.errors ?? [],
    warnings: dto.warnings ?? [],
    reveal: dto.reveal ?? { revealed: false },
    createdAt: dto.createdAt ?? null,
    startedAt: dto.startedAt ?? null,
    completedAt: dto.completedAt ?? null,
    updatedAt: dto.updatedAt ?? null,
  }
}

const initial: InvestigationState = {
  investigationId: null,
  incidentId: null,
  simulationId: null,
  spillEventId: null,
  status: null,
  progress: 0,
  stages: STAGE_ORDER.map((stageId) => ({
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
  })),
  params: null,
  conclusion: { ...EMPTY_CONCLUSION },
  evidence: [],
  provenance: null,
  errors: [],
  warnings: [],
  reveal: { revealed: false },
  createdAt: null,
  startedAt: null,
  completedAt: null,
  updatedAt: null,
}

type InvestigationStoreState = InvestigationState & {
  /** Stage highlighted in the timeline dock; cleared when an investigation is replaced. */
  focusedStageId: InvestigationStageId | null
  setFocusedStageId: (stageId: InvestigationStageId | null) => void
  busy: boolean
  actionError: string | null
  lastReveal: InvestigationState['reveal'] & {
    positionError_km?: number
    timeError_min?: number | null
    attributionCorrect?: boolean
    scoreMargin?: number
  } | null
  start: (incidentId: string) => Promise<void>
  load: (id: string) => Promise<void>
  loadForSimulation: (simulationId: string) => Promise<void>
  retry: (stageId?: InvestigationStageId) => Promise<void>
  cancel: () => Promise<void>
  revealGroundTruth: () => Promise<void>
  reset: () => void
  applyWsEvent: (event: InvestigationWsEvent) => void
}

export const useInvestigationStore = create<InvestigationStoreState>((set, get) => ({
  ...initial,
  focusedStageId: null,
  busy: false,
  actionError: null,
  lastReveal: null,

  setFocusedStageId: (stageId) => set({ focusedStageId: stageId }),

  start: async (incidentId) => {
    set({ busy: true, actionError: null })
    try {
      const dto = await investigationApi.start(incidentId)
      set({ busy: false, ...hydrate(dto) })
    } catch (e) {
      set({ busy: false, actionError: getErrorMessage(e) })
    }
  },

  load: async (id) => {
    try {
      const dto = await investigationApi.get(id)
      set(hydrate(dto))
    } catch (e) {
      set({ actionError: getErrorMessage(e) })
    }
  },

  loadForSimulation: async (simulationId) => {
    try {
      const list = await investigationApi.list({ simulationId })
      const active = list.find(
        (i) => i.status === 'CREATED' || i.status === 'RUNNING',
      ) ?? list[list.length - 1]
      if (!active) return
      const dto = await investigationApi.get(active.investigationId)
      set(hydrate(dto))
    } catch {
      // no investigation for this simulation yet
    }
  },

  retry: async (stageId) => {
    const id = get().investigationId
    if (!id) {
      set({ actionError: 'No active investigation to retry.' })
      return
    }
    set({ busy: true, actionError: null })
    try {
      const dto = await investigationApi.retry(id, stageId)
      set({ busy: false, ...hydrate(dto) })
    } catch (e) {
      set({ busy: false, actionError: getErrorMessage(e) })
    }
  },

  cancel: async () => {
    const id = get().investigationId
    if (!id) {
      set({ actionError: 'No active investigation to cancel.' })
      return
    }
    set({ busy: true, actionError: null })
    try {
      const dto = await investigationApi.cancel(id)
      set({ busy: false, ...hydrate(dto) })
    } catch (e) {
      set({ busy: false, actionError: getErrorMessage(e) })
    }
  },

  revealGroundTruth: async () => {
    const id = get().investigationId
    if (!id) {
      set({ actionError: 'No completed investigation to reveal.' })
      return
    }
    set({ busy: true, actionError: null })
    try {
      const dto = await investigationApi.reveal(id)
      set({
        busy: false,
        reveal: { revealed: true },
        lastReveal: dto,
      })
      void get().load(id)
    } catch (e) {
      set({ busy: false, actionError: getErrorMessage(e) })
    }
  },

  reset: () =>
    set({ ...initial, focusedStageId: null, busy: false, actionError: null, lastReveal: null }),

  applyWsEvent: (event) => {
    const id = get().investigationId
    if (
      id &&
      event.type !== 'groundtruth.revealed' &&
      event.investigationId &&
      event.investigationId !== id
    )
      return
    switch (event.type) {
      case 'investigation_started': {
        const replay = get().status === 'RUNNING' && get().progress > 0
        set({
          investigationId: event.investigationId ?? get().investigationId,
          status: 'RUNNING',
          progress: replay ? get().progress : 0,
          errors: replay ? get().errors : [],
          warnings: replay ? get().warnings : [],
        })
        break
      }
      case 'step_complete':
        set((s) => ({
          status: s.status === 'CREATED' ? 'RUNNING' : s.status,
          progress: event.progress ?? s.progress,
          stages: s.stages.map((st) =>
            st.stageId === event.stageId
              ? {
                  ...st,
                  status:
                    (event.stageStatus?.toLowerCase() as InvestigationStageStatus) ?? st.status,
                  error:
                    event.detail && event.stageStatus === 'failed' ? event.detail : st.error,
                }
              : st,
          ),
        }))
        break
      case 'origin_estimated':
        set((s) => ({
          stages: s.stages.map((st) =>
            st.stageId === 'backtracking'
              ? {
                  ...st,
                  summary: {
                    ...(st.summary ?? {}),
                    originEstimate: event.originEstimate ?? null,
                    uncertaintyKm: event.uncertaintyKm ?? null,
                    confidence: event.confidence ?? null,
                  },
                }
              : st,
          ),
        }))
        break
      case 'vessels_ranked':
        set((s) => ({
          stages: s.stages.map((st) =>
            st.stageId === 'attribution'
              ? { ...st, summary: { ...(st.summary ?? {}), rankedVessels: event.rankedVessels } }
              : st,
          ),
        }))
        break
      case 'investigation_complete':
        set({
          status: 'COMPLETED',
          progress: 1,
          completedAt: new Date().toISOString(),
          conclusion:
            (event.conclusion as InvestigationConclusionState) ??
            (event.conclusionStatus
              ? { ...EMPTY_CONCLUSION, status: String(event.conclusionStatus) }
              : get().conclusion),
        })
        break
      case 'investigation_failed':
        set({
          status: 'FAILED',
          errors: [...get().errors, event.message ?? 'Investigation failed.'],
        })
        break
      case 'investigation_cancelled':
        set({ status: 'CANCELLED' })
        break
      default:
        break
    }
  },
}))