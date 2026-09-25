import { useEffect, useRef } from 'react'
import { isDemoMode } from '@/lib/demo/mode'
import { DEMO_SIMULATION_ID, readDemoSession, writeDemoSession } from '@/lib/demo/seed'
import { rememberActiveSimulation, useSimulationStore } from '@/store/simulationStore'

/**
 * Controlled-demo operational scene.
 *
 * Landing directly on `/command-center?demo=1` used to show an empty chart: the
 * stores were only populated once a challenge had been run, so the demo's own
 * seed data never reached the map. This closes that gap using only what
 * already exists — the deterministic demo adapter, the existing session store
 * and the ordinary `refreshState` path — so the map renders the seeded fleet,
 * slick, SAR candidates and investigation through the real code path.
 *
 * Two guardrails:
 *  - The session is only primed while it is *pristine*. A journey already in
 *    progress (the welcome experience) is never clobbered.
 *  - Nothing happens outside demo mode. Live deployments are untouched.
 */

/** A believable mid-investigation point in the deterministic scenario. */
const PRIMED_SCENE = {
  clockOffsetHours: 2,
  spilled: true,
  sarDetected: true,
  driftRun: true,
  backtrackRun: true,
  attributionRun: true,
  invPhase: 'completed' as const,
  invProgress: 1,
  invCompletedCount: 8,
  revealed: true,
}

export function useDemoOperationalScene() {
  const primed = useRef(false)

  useEffect(() => {
    if (!isDemoMode() || primed.current) return
    primed.current = true

    const session = readDemoSession()
    if (!session.spilled && session.invPhase === 'none') {
      writeDemoSession(PRIMED_SCENE)
    }

    if (!useSimulationStore.getState().simulationId) {
      rememberActiveSimulation(DEMO_SIMULATION_ID)
      // Adoption is enough — the page's existing [simulationId] effects then
      // perform the real hydration.
      useSimulationStore.setState({ simulationId: DEMO_SIMULATION_ID })
    }
  }, [])
}
