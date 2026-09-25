import { useEffect, useMemo } from 'react'
import { SocketClient, WsTopics, type WsHandlers } from '@/lib/ws'
import { useInvestigationStore } from '@/store/investigationStore'
import { useConnectionStore } from '@/store/connectionStore'
import { isDemoMode } from '@/lib/demo/mode'
import { DemoInvestigationDriver } from '@/lib/demo/driver'

/**
 * STEP 11: subscribes an investigation's event wire and drives the
 * investigation store.
 *
 * Live mode opens the real /ws/investigation/{id} JSON WebSocket and re-fetches
 * full state (GET /api/investigation/{id}) on every (re)connect so no frame is
 * missed while disconnected.
 *
 * CONTROLLED DEMO mode opens a deterministic demo driver instead: no socket is
 * created, and the driver replays the remaining stage frames at a fixed cadence
 * from the demo session (which survives reloads). It does not call load() on
 * open — page-level bootstrap hydrates from the demo REST adapter instead.
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

    const onEvent: WsHandlers['onEvent'] = (event) => {
      applyWsEvent(event as Parameters<typeof applyWsEvent>[0])
    }
    const onStatus: WsHandlers['onStatus'] = (status) => {
      setConnection('websocket', status === 'open' ? 'online' : 'offline')
    }

    if (isDemoMode()) {
      const demo = new DemoInvestigationDriver(investigationId)
      demo.connect({ onEvent, onStatus })
      return () => {
        demo.disconnect()
        setConnection('websocket', 'offline')
      }
    }

    const client = new SocketClient(topic)
    client.connect({
      onEvent,
      onStatus: (status) => {
        setConnection('websocket', status === 'open' ? 'online' : 'offline')
        if (status === 'open') {
          void load(investigationId)
        }
      },
    })

    return () => {
      client.disconnect()
      setConnection('websocket', 'offline')
    }
  }, [topic, investigationId, applyWsEvent, load, setConnection])
}