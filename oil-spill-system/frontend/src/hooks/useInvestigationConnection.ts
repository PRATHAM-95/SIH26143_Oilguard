import { useEffect, useMemo } from 'react'
import { SocketClient, WsTopics, type WsHandlers } from '@/lib/ws'
import { useInvestigationStore } from '@/store/investigationStore'
import { useConnectionStore } from '@/store/connectionStore'

/**
 * STEP 11: opens the live JSON WebSocket for an investigation
 * (/ws/investigation/{id}) and drives the investigation store.
 *
 * The REST re-hydration source is GET /api/investigation/{id}; the socket is a
 * live update channel only. On (re)connect the full state is re-fetched so
 * reconnect never misses frames sent while disconnected.
 *
 * @param investigationId the investigation to subscribe to (null = no subscription)
 */
export function useInvestigationConnection(investigationId: string | null | undefined): void {
  const applyWsEvent = useInvestigationStore((s) => s.applyWsEvent)
  const load = useInvestigationStore((s) => s.load)
  const setConnection = useConnectionStore((s) => s.setConnection)

  const topic = useMemo(
    () => (investigationId ? WsTopics.investigation(investigationId) : null),
    [investigationId],
  )

  useEffect(() => {
    if (!topic || !investigationId) {
      setConnection('websocket', 'offline')
      return
    }

    const client = new SocketClient(topic)
    const handlers: WsHandlers = {
      onEvent: (event) => {
        applyWsEvent(event as Parameters<typeof applyWsEvent>[0])
      },
      onStatus: (status) => {
        setConnection('websocket', status === 'open' ? 'online' : 'offline')
        if (status === 'open') {
          void load(investigationId)
        }
      },
    }

    client.connect(handlers)

    return () => {
      client.disconnect()
      setConnection('websocket', 'offline')
    }
  }, [topic, investigationId, applyWsEvent, load, setConnection])
}