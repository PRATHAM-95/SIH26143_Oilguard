import { create } from 'zustand'
import type { IncidentState } from '@/types/domain'

type IncidentStoreState = IncidentState & {
  setActive: (
    patch: Pick<IncidentState, 'observation' | 'location' | 'observationTime' | 'detectionConfidence' | 'slickAreaKm2'>,
  ) => void
  complete: () => void
  reset: () => void
}

const initial: Omit<IncidentStoreState, 'setActive' | 'complete' | 'reset'> = {
  status: 'none',
  observation: null,
  location: null,
  observationTime: null,
  detectionConfidence: null,
  slickAreaKm2: null,
}

export const useIncidentStore = create<IncidentStoreState>((set) => ({
  ...initial,
  setActive: (patch) => set({ status: 'active', ...patch }),
  complete: () => set({ status: 'completed' }),
  reset: () => set(initial),
}))