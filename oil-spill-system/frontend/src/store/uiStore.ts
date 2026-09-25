import { create } from 'zustand'

/**
 * Shared workspace UI state — the single source of truth for the Phase 3
 * command-centre chrome: which intelligence module is active, what the
 * Analysis & Control rail is doing, and whether the rail is collapsed.
 *
 * It deliberately holds *presentation* state only. Pipeline outcomes still
 * live in their domain stores (simulation / sar / backtracking / attribution)
 * so the UI layer never fabricates results.
 */

export type ActiveModule =
  | 'monitoring'
  | 'detection'
  | 'characterization'
  | 'tracking'
  | 'attribution'
  | 'investigation'

export const MODULE_LABEL: Record<ActiveModule, string> = {
  monitoring: 'Live Monitoring',
  detection: 'Detection',
  characterization: 'Characterization',
  tracking: 'Tracking & Drift',
  attribution: 'Attribution',
  investigation: 'Investigation',
}

export type AnalysisType = 'detection' | 'backtracking' | 'forward-drift' | 'vessel-attribution'

/** Analysis lifecycle — mirrors the live challenge phases, never created locally. */
export type AnalysisStatus = 'idle' | 'starting' | 'running' | 'completed' | 'failed'

export type RightPanelTab = 'quick' | 'simulation' | 'vessels' | 'reports'

type UiStoreState = {
  activeModule: ActiveModule
  setActiveModule: (module: ActiveModule) => void

  analysisType: AnalysisType
  setAnalysisType: (type: AnalysisType) => void

  /** Derived from the challenge sequencer so START ANALYSIS stays honest. */
  analysisStatus: AnalysisStatus
  setAnalysisStatus: (status: AnalysisStatus) => void

  rightPanelTab: RightPanelTab
  setRightPanelTab: (tab: RightPanelTab) => void

  panelCollapsed: boolean
  setPanelCollapsed: (collapsed: boolean) => void
  togglePanel: () => void

  /** Historical reference gallery (public-domain DWH archive) visibility. */
  referenceOpen: boolean
  setReferenceOpen: (open: boolean) => void

  /**
   * M11 Phase 2 — Command Center map pane. Presentation-level toggle only:
   * when false the MaritimeMapTheater is unmounted and the read-only
   * StationOverview is shown instead. Map/domain state always lives in the
   * existing domain stores, never here.
   */
  mapPaneOpen: boolean
  setMapPaneOpen: (open: boolean) => void
  toggleMapPane: () => void

  /**
   * On-map layer catalogue drawer. Presentation only — the layer catalogue
   * itself and every toggle live in `mapStore`. Shared here so the compact
   * map toolbar and the drawer it opens cannot drift apart.
   */
  layersOpen: boolean
  setLayersOpen: (open: boolean) => void
  toggleLayers: () => void
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeModule: 'monitoring',
  setActiveModule: (activeModule) => set({ activeModule }),

  analysisType: 'detection',
  setAnalysisType: (analysisType) => set({ analysisType }),

  analysisStatus: 'idle',
  setAnalysisStatus: (analysisStatus) => set({ analysisStatus }),

  rightPanelTab: 'quick',
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),

  panelCollapsed: false,
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),

  referenceOpen: false,
  setReferenceOpen: (referenceOpen) => set({ referenceOpen }),

  mapPaneOpen: false,
  setMapPaneOpen: (mapPaneOpen) => set({ mapPaneOpen }),
  toggleMapPane: () => set((s) => ({ mapPaneOpen: !s.mapPaneOpen })),

  layersOpen: false,
  setLayersOpen: (layersOpen) => set({ layersOpen }),
  toggleLayers: () => set((s) => ({ layersOpen: !s.layersOpen })),
}))