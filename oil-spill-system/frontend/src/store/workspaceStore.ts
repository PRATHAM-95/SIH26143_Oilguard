import { create } from 'zustand'
import { resetWorkspace } from '@/lib/api/workspaceApi'
import { useSimulationStore, clearSimulationMemory } from '@/store/simulationStore'
import { useIncidentStore } from '@/store/incidentStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore, useGroundTruthStore } from '@/store/featureStores'
import { useInvestigationStore } from '@/store/investigationStore'
import { useMapStore } from '@/store/mapStore'

type ResetStatus = 'idle' | 'resetting' | 'reset' | 'error'

type WorkspaceState = {
  status: ResetStatus
  error: string | null
  resetWorkspace: () => Promise<void>
}

/**
 * Full-slate workspace reset — the honest "start fresh, no previous incident"
 * moment. Calls DELETE /api/workspace (drops every persisted case collection in
 * MongoDB) and only then clears the local client stores + session storage.
 *
 * Nothing is soft-erased or faked: if the API cannot confirm at least one
 * dropped collection, the local stores are left untouched and the control
 * reports the failure verbatim.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  status: 'idle',
  error: null,

  resetWorkspace: async () => {
    set({ status: 'resetting', error: null })
    try {
      const result = await resetWorkspace()
      const dropped = result.dropped ?? []

      if (dropped.length === 0) {
        set({
          status: 'error',
          error: `The workspace API reported no dropped collections (${result.status}). MongoDB may be offline — nothing was erased.`,
        })
        return
      }

      // API confirmed the wipe — now clear every client-side store so the
      // workspace reflects an empty, honest slate.
      clearSimulationMemory()
      useSimulationStore.getState().reset()
      useIncidentStore.getState().reset()
      useSarStore.getState().reset()
      useBacktrackingStore.getState().clear()
      useAttributionStore.getState().clear()
      useInvestigationStore.getState().reset()
      useMapStore.getState().clearSelection()
      useGroundTruthStore.setState({ locked: true, revealed: false, actualOrigin: null })

      set({ status: 'reset', error: null })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ status: 'error', error: message })
    }
  },
}))