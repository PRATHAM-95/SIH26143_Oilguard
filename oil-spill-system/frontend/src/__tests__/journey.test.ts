/**
 * M11 Phase 7 — Incident journey layer (pure logic only).
 * Focused, strictly additive tests: stage derivation, identity matching,
 * geometry, and no-data degradation. No existing test is touched.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveJourney,
  findMatchedFleetVessel,
  initialBearingDeg,
  type JourneyInput,
} from '@/ui/journey/useDemoJourney'
import { STAGE_ORDER } from '@/store/investigationStore'
import type {
  InvestigationStageId,
  InvestigationStageState,
  InvestigationStageStatus,
} from '@/types/domain'

function stage(id: string, status: string): InvestigationStageState {
  return {
    stageId: id as InvestigationStageId,
    status: status as InvestigationStageStatus,
    attemptCount: 0,
    error: null,
    stageStartedAt: null,
    stageCompletedAt: null,
    referenceId: null,
    referenceType: null,
    provenance: null,
    sourceState: null,
    modelVersion: null,
    summary: null,
    warnings: null,
  }
}

function input(overrides: Partial<JourneyInput> = {}): JourneyInput {
  return {
    simulationId: null,
    simStatus: null,
    fleetSize: 0,
    spillReleased: false,
    driftStatus: 'idle',
    investigationId: null,
    invStatus: null,
    invStages: [],
    btBacktracked: false,
    attRanked: false,
    ...overrides,
  }
}

describe('findMatchedFleetVessel identity matching', () => {
  const fleet = [
    { id: 'a', name: 'MV Captain Demo', mmsi: '999000001', type: 'Tanker', position: { lon: 0, lat: 0 }, speed: 0, heading: 0 },
    { id: 'b', name: 'ENDEAVOR', mmsi: '999000002', type: 'Cargo', position: { lon: 1, lat: 1 }, speed: 12, heading: 90 },
  ]

  it('matches by exact MMSI', () => {
    expect(findMatchedFleetVessel(fleet, '999000001', null)?.id).toBe('a')
    expect(findMatchedFleetVessel(fleet, '999000002', 'wrong name')?.id).toBe('b')
  })

  it('falls back to a case-insensitive trimmed name match', () => {
    expect(findMatchedFleetVessel(fleet, null, '  endeavor ')?.id).toBe('b')
    expect(findMatchedFleetVessel(fleet, null, 'mv captain demo')?.id).toBe('a')
  })

  it('returns null on no identity and on empty pool', () => {
    expect(findMatchedFleetVessel(fleet, null, null)).toBeNull()
    expect(findMatchedFleetVessel([], '999000001', 'MV Captain Demo')).toBeNull()
    expect(findMatchedFleetVessel(fleet, '999999999', 'GHOST')).toBeNull()
  })
})

describe('initialBearingDeg geometry', () => {
  it('computes cardinal bearings from the origin', () => {
    expect(initialBearingDeg({ lon: 0, lat: 0 }, { lon: 0, lat: 10 })).toBeCloseTo(0, 5)
    expect(initialBearingDeg({ lon: 0, lat: 0 }, { lon: 10, lat: 0 })).toBeCloseTo(90, 5)
    expect(initialBearingDeg({ lon: 0, lat: 0 }, { lon: -10, lat: 0 })).toBeCloseTo(270, 5)
  })

  it('normalises to 0..360 and rejects degenerate input', () => {
    expect(initialBearingDeg({ lon: 0, lat: 0 }, { lon: 0, lat: 0 })).toBe(0)
    expect(initialBearingDeg({ lon: Number.NaN, lat: 0 }, { lon: 10, lat: 0 })).toBeNull()
  })
})

describe('deriveJourney phase machine', () => {
  it('is inactive with neither a simulation nor an investigation', () => {
    const j = deriveJourney(input())
    expect(j.active).toBe(false)
    expect(j.guidance.phase).toBe('idle')
    expect(j.pipeline).toBeNull()
  })

  it('shows preflight milestones for an unstarted captain-mode scenario', () => {
    const j = deriveJourney(input({ simulationId: 'SIM-1', simStatus: 'captain_mode', fleetSize: 8 }))
    expect(j.active).toBe(true)
    expect(j.guidance.phase).toBe('captain')
    expect(j.guidance.nextRoute).toBe('/simulation')
    expect(j.preflight.map((n) => n.done)).toEqual([false, false, false])
  })

  it('continues through scenario -> spill -> drift with honest CTAs', () => {
    const scenario = deriveJourney(
      input({ simulationId: 'SIM-1', simStatus: 'simulating', fleetSize: 8 }),
    )
    expect(scenario.guidance.phase).toBe('scenario')
    expect(scenario.guidance.nextRoute).toBe('/simulation')

    const spillPhase = deriveJourney(
      input({ simulationId: 'SIM-1', simStatus: 'simulating', fleetSize: 8, spillReleased: true }),
    )
    expect(spillPhase.guidance.phase).toBe('spill')
    expect(spillPhase.guidance.nextRoute).toBe('/simulation')
    expect(spillPhase.preflight[1].done).toBe(true)

    const driftPhase = deriveJourney(
      input({
        simulationId: 'SIM-1',
        simStatus: 'observation',
        fleetSize: 8,
        spillReleased: true,
        driftStatus: 'completed',
      }),
    )
    expect(driftPhase.guidance.phase).toBe('drift')
    expect(driftPhase.guidance.nextAction).toBe('Launch investigation')
    expect(driftPhase.guidance.nextRoute).toBe('/investigation')
  })

  it('tracks the 8-stage pipeline in store order', () => {
    const stages = [
      stage('detection', 'completed'),
      stage('characterization', 'completed'),
      stage('environment', 'completed'),
      stage('forward_drift', 'running'),
      ...STAGE_ORDER.slice(4).map((id) => stage(id, 'pending')),
    ]
    const j = deriveJourney(
      input({
        simulationId: 'SIM-1',
        simStatus: 'observation',
        investigationId: 'INV-1',
        invStatus: 'RUNNING',
        invStages: stages,
      }),
    )
    expect(j.pipeline?.map((n) => n.id)).toEqual(STAGE_ORDER)
    expect(j.pipeline?.filter((n) => n.status === 'completed')).toHaveLength(3)
    expect(j.guidance.phase).toBe('pipeline')
    expect(j.guidance.context).toContain('3/8')
    expect(j.guidance.nextRoute).toBe('/investigation')
  })

  it('asserts a concluded investigation routes to the dossier', () => {
    const j = deriveJourney(
      input({
        simulationId: 'SIM-1',
        simStatus: 'observation',
        investigationId: 'INV-1',
        invStatus: 'COMPLETED',
        invStages: STAGE_ORDER.map((id) => stage(id, 'completed')),
      }),
    )
    expect(j.guidance.phase).toBe('concluded')
    expect(j.guidance.nextAction).toBe('Open incident dossier')
    expect(j.guidance.nextRoute).toBe('/report')
    expect(j.pipelineComplete).toBe(true)
    expect(j.pipeline).toHaveLength(8)
  })

  it('recognises standalone backtracked and attributed outcomes', () => {
    const bt = deriveJourney(
      input({ simulationId: 'SIM-1', simStatus: 'completed', btBacktracked: true }),
    )
    expect(bt.guidance.phase).toBe('backtracked')
    expect(bt.guidance.nextRoute).toBe('/attribution')

    const att = deriveJourney(
      input({
        simulationId: 'SIM-1',
        simStatus: 'completed',
        btBacktracked: true,
        attRanked: true,
      }),
    )
    expect(att.guidance.phase).toBe('attributed')
    expect(att.guidance.nextAction).toBe('Review attribution')
    expect(att.guidance.nextRoute).toBe('/attribution')
  })

  it('degrades gracefully when the investigation is cancelled (no fake progress)', () => {
    const j = deriveJourney(
      input({
        simulationId: 'SIM-1',
        simStatus: 'observation',
        investigationId: 'INV-1',
        invStatus: 'CANCELLED',
        invStages: STAGE_ORDER.map((id) => stage(id, 'pending')),
      }),
    )
    expect(j.active).toBe(true)
    expect(j.pipeline).toBeNull()
    expect(j.guidance.phase).toBe('scenario')
  })
})