import { useEffect, useMemo } from 'react'
import {
  SocketClient,
  WsTopics,
  type WsEvent,
  type SimulationWsEvent,
  type SarWsEvent,
  type BacktrackWsEvent,
  type AttributionWsEvent,
  type WsHandlers,
} from '@/lib/ws'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useAttributionStore, useBacktrackingStore } from '@/store/featureStores'
import { useConnectionStore } from '@/store/connectionStore'
import { isDemoMode } from '@/lib/demo/mode'
import { DemoSimulationDriver } from '@/lib/demo/driver'

const SIM_EVENT_TYPES = new Set<SimulationWsEvent['type']>([
  'clock_update',
  'vessel_moved',
  'spill_released',
  'oil_particles',
  'forward_drift.started',
  'forward_drift.completed',
  'forward_drift.failed',
])

const SAR_EVENT_TYPES = new Set<SarWsEvent['type']>([
  'sar_observation.started',
  'sar_observation.completed',
  'sar_observation.failed',
])

const BACKTRACK_EVENT_TYPES = new Set<BacktrackWsEvent['type']>([
  'backtracking.started',
  'backtracking.completed',
  'backtracking.failed',
  'origin_estimated',
])

const ATTRIBUTION_EVENT_TYPES = new Set<AttributionWsEvent['type']>([
  'ais_search.started',
  'ais_search.completed',
  'ais_search.failed',
  'vessels_filtered',
  'attribution.started',
  'vessel_scores_ready',
  'attribution.completed',
])

type WireHandlers = {
  applyBacktrackWsEvent: (e: BacktrackWsEvent) => void
  applyAttributionWsEvent: (e: AttributionWsEvent) => void
  applySarWsEvent: (e: SarWsEvent) => void
  applyWsEvent: (e: SimulationWsEvent) => void
}

/** Routes a wire event into the store that owns it (identical for live socket and demo driver). */
function routeEvent(
  h: WireHandlers,
): (event: WsEvent) => void {
  return (event) => {
    // ignore investigation-scoped frames
    if (BACKTRACK_EVENT_TYPES.has(event.type as BacktrackWsEvent['type'])) {
      h.applyBacktrackWsEvent(event as BacktrackWsEvent)
      return
    }
    if (ATTRIBUTION_EVENT_TYPES.has(event.type as AttributionWsEvent['type'])) {
      h.applyAttributionWsEvent(event as AttributionWsEvent)
      return
    }
    if (SAR_EVENT_TYPES.has(event.type as SarWsEvent['type'])) {
      h.applySarWsEvent(event as SarWsEvent)
      return
    }
    if (!SIM_EVENT_TYPES.has(event.type as SimulationWsEvent['type'])) return
    h.applyWsEvent(event as SimulationWsEvent)
  }
}

/**
 * Subscribes a simulation's event wire (live JSON WebSocket by default,
 * deterministic demo driver while CONTROLLED DEMO mode is active) and forwards
 * events into the simulation store (and Step 07 SAR events into the SAR store,
 * Step 09 backtracking events into the backtracking store, Step 10
 * attribution/AIS events into the attribution store).
 *
 * Connection status is reflected in the connection store's `websocket` chip.
 *
 * @param simulationId the simulation to subscribe to (null = no subscription)
 */
export function useSimulationConnection(simulationId: string | null | undefined): void {
  const applyWsEvent = useSimulationStore((s) => s.applyWsEvent)
  const applySarWsEvent = useSarStore((s) => s.applyWsEvent)
  const applyBacktrackWsEvent = useBacktrackingStore((s) => s.applyWsEvent)
  const applyAttributionWsEvent = useAttributionStore((s) => s.applyWsEvent)
  const setConnection = useConnectionStore((s) => s.setConnection)

  const topic = useMemo(
    () => (simulationId ? WsTopics.simulation(simulationId) : null),
    [simulationId],
  )

  useEffect(() => {
    const route = routeEvent({
      applyBacktrackWsEvent,
      applyAttributionWsEvent,
      applySarWsEvent,
      applyWsEvent,
    })

    if (!topic) {
      setConnection('websocket', 'offline')
      return
    }

    const onStatus: WsHandlers['onStatus'] = (status) => {
      setConnection('websocket', status === 'open' ? 'online' : 'offline')
    }

    if (isDemoMode()) {
      const demo = new DemoSimulationDriver()
      demo.connect({ onEvent: route, onStatus })
      return () => {
        demo.disconnect()
        setConnection('websocket', 'offline')
      }
    }

    const client = new SocketClient(topic)
    client.connect({ onEvent: route, onStatus })

    return () => {
      client.disconnect()
      setConnection('websocket', 'offline')
    }
  }, [topic, applyWsEvent, applySarWsEvent, applyBacktrackWsEvent, applyAttributionWsEvent, setConnection])
}