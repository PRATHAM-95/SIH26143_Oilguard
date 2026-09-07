import { create } from 'zustand'
import type { DataSourceStatus, EnvironmentState } from '@/types/domain'

type EnvironmentStoreState = EnvironmentState & {
  setCurrentStatus: (status: DataSourceStatus, note?: string) => void
  setWindStatus: (status: DataSourceStatus, note?: string) => void
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
}

export const useEnvironmentStore = create<EnvironmentStoreState>((set) => ({
  ...initial,
  setCurrentStatus: (status, note) =>
    set((s) => ({ current: { ...s.current, status, note: note ?? s.current.note } })),
  setWindStatus: (status, note) =>
    set((s) => ({ wind: { ...s.wind, status, note: note ?? s.wind.note } })),
}))