import { create } from 'zustand'

type ShellState = {
  leftCollapsed: boolean
  rightCollapsed: boolean
  toggleLeft: () => void
  toggleRight: () => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
}

export const useShellStore = create<ShellState>((set) => ({
  leftCollapsed: false,
  rightCollapsed: false,
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),
}))
