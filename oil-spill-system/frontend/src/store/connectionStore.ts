import { create } from 'zustand'
import type { ConnectionKind, ConnectionStateMessage } from '@/types/domain'

type ConnectionState = {
  connections: Record<ConnectionKind, 'online' | 'offline' | 'unknown'>
  lastApiCheck: string | null
  setConnection: (kind: ConnectionKind, status: ConnectionStateMessage['status']) => void
  markApiChecked: () => void
  reset: () => void
}

const initial: Pick<
  ConnectionState,
  'connections' | 'lastApiCheck'
> = {
  connections: {
    api: 'unknown',
    websocket: 'offline',
    mongo: 'unknown',
    python: 'unknown',
  },
  lastApiCheck: null,
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initial,
  setConnection: (kind, status) =>
    set((s) => ({ connections: { ...s.connections, [kind]: status } })),
  markApiChecked: () => set({ lastApiCheck: new Date().toISOString() }),
  reset: () => set(initial),
}))