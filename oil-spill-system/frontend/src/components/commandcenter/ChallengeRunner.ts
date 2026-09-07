import { create } from 'zustand'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useBacktrackingStore, useAttributionStore, useGroundTruthStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'

/**
 * Live challenge sequencer — "watch the judge solve it" driver.
 *
 * Runs the real pipeline step by step so the map and stores animate live over
 * the websocket: scenario → clock → spill → SAR detection → forward drift →
 * full 8-stage investigation. Every channel is labelled honestly (CONTROLLED /
 * LOCAL_FIXTURE provenance) until Phase 3 wires Open-Meteo and EONET.
 *
 * `DEMO` = auto-bootstrapped on cold open; `LIVE` = judge pressed the button.
 */
export type ChallengePhase =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'detecting'
  | 'drifting'
  | 'investigating'
  | 'done'
  | 'failed'

export type ChallengeLog = { at: string; msg: string }

type ChallengeStoreState = {
  phase: ChallengePhase
  label: 'DEMO' | 'LIVE' | null
  error: string | null
  log: ChallengeLog[]
  setPhase: (phase: ChallengePhase) => void
  fail: (error: string) => void
}

export const useChallengeStore = create<ChallengeStoreState>((set) => ({
  phase: 'idle',
  label: null,
  error: null,
  log: [],
  setPhase: (phase) => set({ phase }),
  fail: (error) => set({ phase: 'failed' as const, error }),
}))

/**
 * Wipe per-case stores so a fresh challenge starts from a clean slate.
 * The simulation store is deliberately left alone — createSimulation already
 * resets its fields and rebinds the persisted active-simulation id.
 */
export function resetCaseState(): void {
  useMapStore.getState().clearSelection()
  useInvestigationStore.getState().reset()
  useBacktrackingStore.getState().clear()
  useAttributionStore.getState().clear()
  useSarStore.getState().reset()
  useGroundTruthStore.getState().reveal()
  useGroundTruthStore.setState({ locked: true, revealed: false, actualOrigin: null })
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function tell(msg: string): void {
  useChallengeStore.setState((s) => ({
    log: [...s.log.slice(-7), { at: new Date().toISOString().slice(11, 19), msg }],
  }))
}

let busy = false

export async function runLiveChallenge(label: 'DEMO' | 'LIVE' = 'LIVE'): Promise<void> {
  if (busy) return
  busy = true

  const sim = useSimulationStore.getState()
  try {
    resetCaseState()

    useChallengeStore.setState({
      phase: 'preparing',
      label,
      error: null,
      log: [],
    })
    tell('Preparing scenario…')

    // 1 — fresh captain-mode scenario (west Indian Ocean fleet)
    await sim.createSimulation()
    const simulationId = useSimulationStore.getState().simulationId
    if (!simulationId) throw new Error('Scenario creation returned no simulation id.')
    tell(`Scenario ${simulationId.slice(0, 8)}… created`)

    // 2 — start the clock
    await useSimulationStore.getState().start()
    tell('Simulation clock started')

    // 3 — roll the clock so the fleet leaves visible tracks
    await useSimulationStore.getState().advance(12)
    await sleep(700)

    // 3b — anchor the demo on the first vessel of the fleet
    const vessels = useSimulationStore.getState().vessels
    const anchor = vessels[0] ?? null
    if (anchor) useSimulationStore.getState().selectVessel(anchor.id)
    useChallengeStore.setState({ phase: 'running' })

    // 4 — release the spill (creates the detected incident, labelled observe)
    if (anchor) {
      await useSimulationStore.getState().releaseSpill()
      tell('Spill released — incident created')
    } else {
      throw new Error('No vessel available to release the spill.')
    }
    await sleep(900)

    // 5 — SAR detection (LOCAL_FIXTURE, explicitly labelled demo)
    const simId = useSimulationStore.getState().simulationId
    if (!simId) throw new Error('Simulation id lost during detection.')
    useChallengeStore.setState({ phase: 'detecting' })
    await useSarStore.getState().detect(simId)
    tell('SAR candidate detected')

    // 6 — forward drift (CONTROLLED test field until Phase 3)
    useChallengeStore.setState({ phase: 'drifting' })
    await useSimulationStore.getState().runForwardDrift()
    tell('Forward drift run complete')
    await sleep(700)

    // 7 — full investigation pipeline (detection → … → attribution/conclusion)
    const incidentId = useSimulationStore.getState().spill?.incidentId ?? null
    if (!incidentId) throw new Error('No incident id to investigate.')
    useChallengeStore.setState({ phase: 'investigating' })
    await useInvestigationStore.getState().start(incidentId)
    tell('Investigation pipeline engaged')
    useChallengeStore.setState({ phase: 'done' })
  } catch (e) {
    useChallengeStore.getState().fail(e instanceof Error ? e.message : String(e))
  } finally {
    busy = false
  }
}

/** Human label for the current phase, used by the case bar status chip. */
export function phaseLabel(phase: ChallengePhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing demo case…'
    case 'running':
      return 'Simulation live'
    case 'detecting':
      return 'SAR detection running…'
    case 'drifting':
      return 'Forward drift running…'
    case 'investigating':
      return 'Investigation pipeline running…'
    case 'done':
      return 'Pipeline armed — watching stages'
    case 'failed':
      return 'Challenge failed'
    default:
      return ''
  }
}