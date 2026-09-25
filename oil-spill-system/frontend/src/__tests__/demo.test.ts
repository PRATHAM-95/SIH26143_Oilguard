import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveDemoMode } from '../lib/demo/mode'
import {
  demoFleet,
  forwardDriftResponse,
  DEMO_SIMULATION_ID,
  DEMO_INCIDENT_ID,
  DEMO_INVESTIGATION_ID,
  DEMO_SPILL_LOCATION,
  DEMO_STAGE_ORDER,
} from '../lib/demo/seed'
import { demoRoute } from '../lib/demo/adapter'
import { DemoInvestigationDriver } from '../lib/demo/driver'
import { writeDemoSession, resetDemoSession, readDemoSession } from '../lib/demo/seed'
import { STAGE_ORDER } from '../store/investigationStore'

describe('Controlled demo mode resolution', () => {
  it('query param has precedence over the build flag', () => {
    expect(resolveDemoMode(true, '?demo=0')).toBe(false)
    expect(resolveDemoMode(true, '?demo=1')).toBe(true)
    expect(resolveDemoMode(false, '?demo=1')).toBe(true)
    expect(resolveDemoMode(false, '?demo=true')).toBe(true)
    expect(resolveDemoMode(true, '?demo=false')).toBe(false)
  })

  it('falls back to the build flag when no query param is present', () => {
    expect(resolveDemoMode(true, '')).toBe(true)
    expect(resolveDemoMode(true, '?page=1')).toBe(true)
    expect(resolveDemoMode(false, '')).toBe(false)
  })
})

describe('Demo stage pipeline contract', () => {
  it('keeps the demo stage order identical to the canonical store order', () => {
    expect(DEMO_STAGE_ORDER).toEqual(STAGE_ORDER)
    expect(DEMO_STAGE_ORDER).toHaveLength(8)
  })
})

describe('Demo seed determinism', () => {
  it('produces an identical fleet across calls', () => {
    expect(demoFleet()).toEqual(demoFleet())
    expect(demoFleet()).toHaveLength(8)
    expect(demoFleet().every((v) => v.mmsi.startsWith('999'))).toBe(true)
  })

  it('produces identical forward-drift responses across calls', () => {
    const a = forwardDriftResponse({ durationHours: 6 })
    const b = forwardDriftResponse({ durationHours: 6 })
    expect(a).toEqual(b)
    expect(a.particles).toHaveLength(500)
    if (a.extent) expect(a.extent.type).toBe('Polygon')
  })
})

describe('Demo REST adapter', () => {
  beforeEach(() => {
    resetDemoSession()
  })
  afterEach(() => {
    resetDemoSession()
  })

  it('creates a simulation and seeds the fleet', () => {
    const created = demoRoute('POST', '/api/simulation', { region: { north: 1, south: -1, east: 1, west: -1 }, mode: 'captain' }) as {
      simulationId: string
    }
    expect(created.simulationId).toBe(DEMO_SIMULATION_ID)
    const vessels = demoRoute('GET', `/api/simulation/${DEMO_SIMULATION_ID}/vessels`, undefined) as {
      vessels: unknown[]
    }
    expect(vessels.vessels).toHaveLength(8)
  })

  it('starts, releases a spill near the selected vessel, and reflects it on GET', () => {
    demoRoute('POST', '/api/simulation', {})
    demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/start`, {})
    const spill = demoRoute(
      'POST',
      `/api/simulation/${DEMO_SIMULATION_ID}/vessels/SAMPLE-VSL-001/spill`,
      { type: 'accidental', oilType: 'GENERIC CRUDE', quantityKg: 5000 },
    ) as { incidentId: string; location: { latitude: number; longitude: number } }
    expect(spill.incidentId).toBe(DEMO_INCIDENT_ID)
    expect(spill.location.latitude).toBeGreaterThan(0)

    const dto = demoRoute('GET', `/api/simulation/${DEMO_SIMULATION_ID}`, undefined) as {
      spillEvent?: { spillEventId: string }
    }
    expect(dto.spillEvent?.spillEventId).toBeTruthy()
    const session = readDemoSession()
    expect(session.spilled).toBe(true)
    expect(session.spillLat).toBe(spill.location.latitude)
  })

  it('runs SAR detection deterministically and persists observations', () => {
    const obs = demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/sar/detect`, {}) as { observationId: string }
    expect(obs.observationId).toBeTruthy()
    const list = demoRoute('GET', `/api/simulation/${DEMO_SIMULATION_ID}/sar/observations`, undefined) as unknown[]
    expect(list).toHaveLength(1)
  })

  it('advances forward drift with 500 particles and honest synthetic provenance', () => {
    demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/vessels/SAMPLE-VSL-001/spill`, { type: 'accidental', oilType: 'GENERIC CRUDE', quantityKg: 5000 })
    const drift = demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/forward-drift`, { durationHours: 6 }) as {
      particles: unknown[]
      driftRun: { environment_source: string }
    }
    expect(drift.particles).toHaveLength(500)
    expect(drift.driftRun.environment_source).toBe('SYNTHETIC')
  })

  it('runs backtracking from the released spill location', () => {
    demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/vessels/SAMPLE-VSL-001/spill`, { type: 'accidental', oilType: 'GENERIC CRUDE', quantityKg: 5000 })
    const bt = demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/backtrack`, {}) as { status: string; origin_estimate: { lon: number; lat: number } }
    expect(bt.status).toBe('completed')
    expect(Math.abs(bt.origin_estimate.lat - DEMO_SPILL_LOCATION.lat)).toBeLessThan(0.1)
  })

  it('runs attribution with CONTROLLED AIS source and a ranked list', () => {
    const run = demoRoute('POST', '/api/attribution/run', { simulationId: DEMO_SIMULATION_ID }) as {
      status: string
      aisSource: string
      rankedVessels: unknown[]
    }
    expect(run.status).toBe('completed')
    expect(run.aisSource).toBe('CONTROLLED')
    expect(run.rankedVessels.length).toBe(8)
    const providers = demoRoute('GET', '/api/attribution/providers', undefined) as { ais?: Record<string, unknown> }
    expect(providers.ais?.CONTROLLED).toBeTruthy()
  })

  it('surfaces honest availability for live weather / incidents', () => {
    const weather = demoRoute('GET', '/api/environment/live-weather?lat=1&lon=2', undefined) as { available: boolean }
    expect(weather.available).toBe(false)
    const incidents = demoRoute('GET', '/api/environment/incidents?west=1&south=1&east=2&north=2', undefined) as { available: boolean }
    expect(incidents.available).toBe(false)
  })

  it('drives a full investigation lifecycle via the adapter', () => {
    demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/vessels/SAMPLE-VSL-001/spill`, { type: 'accidental', oilType: 'GENERIC CRUDE', quantityKg: 5000 })

    const dto = demoRoute('POST', `/api/investigation/${DEMO_INCIDENT_ID}/start`, {}) as { investigationId: string; status: string; progress: number }
    expect(dto.investigationId).toBe(DEMO_INVESTIGATION_ID)
    expect(dto.status).toBe('RUNNING')
    expect(dto.progress).toBe(0)

    // no-op extra start (idempotent)
    demoRoute('POST', `/api/investigation/${DEMO_INCIDENT_ID}/start`, {})

    // simulate completion then re-read
    writeDemoSession({ invPhase: 'completed', invProgress: 1, invCompletedCount: 8 })
    const done = demoRoute('GET', `/api/investigation/${DEMO_INVESTIGATION_ID}`, undefined) as { status: string; progress: number; conclusion: { status: string | null } }
    expect(done.status).toBe('COMPLETED')
    expect(done.progress).toBe(1)
    expect(done.conclusion.status).toBe('candidate')

    const steps = demoRoute('GET', `/api/investigation/${DEMO_INVESTIGATION_ID}/steps`, undefined) as unknown[]
    expect(steps).toHaveLength(8)
    const report = demoRoute('GET', `/api/investigation/${DEMO_INVESTIGATION_ID}/report`, undefined) as Record<string, unknown>
    expect(report['3_detection']).toBeTruthy()
  })

  it('resets the workspace and the demo session', () => {
    demoRoute('POST', `/api/simulation/${DEMO_SIMULATION_ID}/vessels/SAMPLE-VSL-001/spill`, { type: 'accidental', oilType: 'GENERIC CRUDE', quantityKg: 5000 })
    const result = demoRoute('DELETE', '/api/workspace', undefined) as { status: string; dropped: unknown[] }
    expect(result.status).toBe('RESET')
    expect(result.dropped.length).toBeGreaterThan(0)
    expect(readDemoSession().spilled).toBe(false)
  })

  it('throws on unknown routes instead of fabricating a fallback', () => {
    expect(() => demoRoute('GET', '/api/backtrack', undefined)).toThrow(/unhandled route/)
    expect(() => demoRoute('GET', '/api/nonexistent', undefined)).toThrow(/unhandled route/)
  })
})

describe('Demo investigation driver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetDemoSession()
  })
  afterEach(() => {
    vi.useRealTimers()
    resetDemoSession()
  })

  it('replays every stage in order and marks the session completed', () => {
    writeDemoSession({ invPhase: 'running', invProgress: 0, invCompletedCount: 0 })
    const types: string[] = []
    const statuses: string[] = []
    const driver = new DemoInvestigationDriver(DEMO_INVESTIGATION_ID)
    driver.connect({
      onEvent: (e) => types.push((e as { type: string }).type),
      onStatus: (s) => statuses.push(s),
    })
    vi.advanceTimersByTime(DemoInvestigationDriver.FIRST_FRAME_DELAY_MS)

    for (let i = 0; i < DemoInvestigationDriver.STAGE_WINDOW_MS * 8 + 500; i += DemoInvestigationDriver.STAGE_WINDOW_MS) {
      vi.advanceTimersByTime(DemoInvestigationDriver.STAGE_WINDOW_MS)
    }

    expect(types.filter((t) => t === 'step_complete')).toHaveLength(8)
    expect(types).toContain('investigation_complete')
    const session = readDemoSession()
    expect(session.invPhase).toBe('completed')
    expect(session.invCompletedCount).toBe(8)
    expect(session.invProgress).toBe(1)
    driver.disconnect()
  })

  it('emits completed stages only for a fresh run and halts on cancel', () => {
    writeDemoSession({ invPhase: 'running', invProgress: 0, invCompletedCount: 0 })
    const types: string[] = []
    const driver = new DemoInvestigationDriver(DEMO_INVESTIGATION_ID)
    driver.connect({ onEvent: (e) => types.push((e as { type: string }).type) })
    vi.advanceTimersByTime(DemoInvestigationDriver.FIRST_FRAME_DELAY_MS)
    vi.advanceTimersByTime(DemoInvestigationDriver.STAGE_WINDOW_MS) // first stage lands
    writeDemoSession({ invPhase: 'cancelled' }) // cancel mid-run
    vi.advanceTimersByTime(DemoInvestigationDriver.STAGE_WINDOW_MS * 8)
    expect(types.filter((t) => t === 'step_complete')).toHaveLength(1)
    expect(types).not.toContain('investigation_complete')
    expect(readDemoSession().invPhase).toBe('cancelled')
    driver.disconnect()
  })

  it('does not replay frames for an already-completed investigation', () => {
    writeDemoSession({ invPhase: 'completed', invProgress: 1, invCompletedCount: 8 })
    const types: string[] = []
    const driver = new DemoInvestigationDriver(DEMO_INVESTIGATION_ID)
    driver.connect({ onEvent: (e) => types.push((e as { type: string }).type) })
    vi.advanceTimersByTime(DemoInvestigationDriver.FIRST_FRAME_DELAY_MS + 5000)
    expect(types.filter((t) => t === 'step_complete')).toHaveLength(0)
    driver.disconnect()
  })
})