import { create } from 'zustand'
import type { DataSourceStatus, EnvironmentState } from '@/types/domain'

/** Live bathymetry readout at the cursor (ETOPO1 via OpenTopoData). */
type DepthState = {
  depthM: number | null
  fetchedAt: number | null
  error: string | null
}

type EnvironmentStoreState = EnvironmentState & {
  setCurrentStatus: (status: DataSourceStatus, note?: string) => void
  setWindStatus: (status: DataSourceStatus, note?: string) => void
  depth: DepthState
  setDepthReading: (depthM: number | null, error?: string | null) => void
}

const initial = {
  current: {
    status: 'awaiting',
    label: 'Ocean current',
    note: 'Awaiting data',
  } satisfies EnvironmentState['current'],
  wind: {
    status: 'awaiting',
    label: 'Wind field',
    note: 'Awaiting data',
  } satisfies EnvironmentState['wind'],
  depth: {
    depthM: null,
    fetchedAt: null,
    error: null,
  } satisfies DepthState,
}

export const useEnvironmentStore = create<EnvironmentStoreState>((set) => ({
  ...initial,
  setCurrentStatus: (status, note) =>
    set((s) => ({ current: { ...s.current, status, note: note ?? s.current.note } })),
  setWindStatus: (status, note) =>
    set((s) => ({ wind: { ...s.wind, status, note: note ?? s.wind.note } })),
  setDepthReading: (depthM, error = null) =>
    set((s) => ({ depth: { ...s.depth, depthM, fetchedAt: Date.now(), error } })),
}))