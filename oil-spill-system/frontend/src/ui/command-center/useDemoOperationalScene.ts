import { useEffect, useRef } from 'react'
import { isDemoMode } from '@/lib/demo/mode'
import { DEMO_SIMULATION_ID, readDemoSession, writeDemoSession } from '@/lib/demo/seed'
import { rememberActiveSimulation, useSimulationStore } from '@/store/simulationStore'
import { useMapStore, type MapLayerId } from '@/store/mapStore'

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

/**
 * Opening operational layers for a fresh demo session.
 *
 * The catalogue ships with most layers off so a cold live map stays uncluttered.
 * The demo is meant to show the full maritime picture, so these are switched on
 * once, on a pristine session only — after that the user's own choices stand.
 * Currents and wind are included because the demo carries a synthetic grid for
 * them; they render faint, so they add context without crowding the ocean.
 */
const PRIMED_LAYERS: [MapLayerId, boolean][] = [
  ['slick', true],
  ['sarSlicks', true],
  ['vessels', true],
  ['eez', true],
  ['sarFootprint', true],
  ['shippingLanes', true],
  ['currents', true],
  ['wind', true],
  // Analysis output is only useful once the run that produced it exists.
  ['attribution', true],
  // Forward model output is deliberately left off: it is a prediction, and the
  // opening frame should show observations and the incident, not a forecast.
  ['drift', false],
  ['backtracking', false],
  ['sourceProbability', false],
]

export function useDemoOperationalScene() {
  const primed = useRef(false)

  useEffect(() => {
    if (!isDemoMode() || primed.current) return
    primed.current = true

    const session = readDemoSession()
    if (!session.spilled && session.invPhase === 'none') {
      writeDemoSession(PRIMED_SCENE)
    }

    const map = useMapStore.getState()
    for (const [id, on] of PRIMED_LAYERS) map.setLayer(id, on)

    if (!useSimulationStore.getState().simulationId) {
      rememberActiveSimulation(DEMO_SIMULATION_ID)
      // Adoption is enough — the page's existing [simulationId] effects then
      // perform the real hydration.
      useSimulationStore.setState({ simulationId: DEMO_SIMULATION_ID })
    }
  }, [])
}
