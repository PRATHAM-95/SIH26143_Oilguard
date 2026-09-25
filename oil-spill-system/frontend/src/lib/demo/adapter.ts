import {
  attributionDto,
  backtrackingDto,
  demoClock,
  demoDepthReading,
  demoEnvironmentGrid,
  demoFleet,
  demoHealthInfo,
  demoIncidentDto,
  demoIncidentFeed,
  demoLiveWeather,
  demoPythonPing,
  demoSimulationDto,
  demoSpillDto,
  demoWorkspaceReset,
  driftParticles,
  forwardDriftResponse,
  investigationDto,
  investigationStageStates,
  investigationSummary,
  providersReport,
  readDemoSession,
  reportRecord,
  resetDemoSession,
  revealResponse,
  sarObservation,
  writeDemoSession,
  DEMO_SPILL_LOCATION,
} from './seed'

/**
 * CONTROLLED DEMO REST adapter (M11 Phase 6).
 *
 * While demo mode is active the REST transport listed in the status bar is the
 * demo adapter (it is the "api" the UI sees as online); the real Spring Boot
 * backend / FastAPI scientific service / Open-Meteo / NASA EONET / ETOPO1 are
 * never contacted. Every response is deterministic, self-consistent and
 * honestly labelled as SYNTHETIC data.
 *
 * Unrecognised routes throw instead of silently fabricating a fallback so a
 * future endpoint can never half-run in demo mode by accident.
 */
export function demoRoute(method: string, path: string, body: unknown): unknown {
  const p = path.split('?')[0]
  const seg = p.split('/').filter(Boolean) // e.g. ['api','simulation',id,...]

  const rest = (i: number): string | undefined => seg[i]
  const isSim = seg[1] === 'simulation'
  const isInv = seg[1] === 'investigation'

  // POST /api/simulation — a fresh create resets the demo session.
  if (method === 'POST' && p === '/api/simulation') {
    resetDemoSession()
    return { simulationId: 'DEMO-SIM-0001', status: 'captain_mode', clock: demoClock() }
  }

  // -------------------------------------------------------------------------
  // /api/simulation/{id}...
  // -------------------------------------------------------------------------
  // GET /api/simulation/{id}
  if (method === 'GET' && seg.length === 3 && isSim) return demoSimulationDto()

  // POST /api/simulation/{id}/start
  if (method === 'POST' && seg.length === 4 && isSim && rest(3) === 'start') {
    return { simulationId: 'DEMO-SIM-0001', status: 'simulating', clock: demoClock() }
  }

  // POST /api/simulation/{id}/advance
  if (method === 'POST' && seg.length === 4 && isSim && rest(3) === 'advance') {
    writeDemoSession({ clockOffsetHours: Math.min(6, readDemoSession().clockOffsetHours + 1) })
    return { clock: demoClock(), particles: driftParticles() }
  }

  // GET /api/simulation/{id}/vessels
  if (method === 'GET' && seg.length === 4 && isSim && rest(3) === 'vessels') {
    return { vessels: demoFleet() }
  }

  // POST /api/simulation/{id}/vessels/{vesselId}/move
  if (method === 'POST' && seg.length === 6 && isSim && rest(3) === 'vessels' && rest(5) === 'move') {
    const position = body as { latitude?: number; longitude?: number }
    return {
      position: {
        latitude: position?.latitude ?? DEMO_SPILL_LOCATION.lat,
        longitude: position?.longitude ?? DEMO_SPILL_LOCATION.lon,
      },
      timestamp: demoClock(),
    }
  }

  // POST /api/simulation/{id}/vessels/{vesselId}/spill
  if (method === 'POST' && seg.length === 6 && isSim && rest(3) === 'vessels' && rest(5) === 'spill') {
    const fleet = demoFleet()
    const vessel = fleet.find((v) => v.id === rest(4)) ?? fleet[0]
    writeDemoSession({
      spilled: true,
      spillLon: vessel.position.longitude,
      spillLat: vessel.position.latitude,
    })
    const spill = demoSpillDto()
    return {
      spillEventId: spill.spillEventId,
      incidentId: spill.incidentId,
      location: { latitude: vessel.position.latitude, longitude: vessel.position.longitude },
    }
  }

  // POST /api/simulation/{id}/sar/detect
  if (method === 'POST' && seg.length === 5 && isSim && rest(3) === 'sar' && rest(4) === 'detect') {
    writeDemoSession({ sarDetected: true })
    return sarObservation()
  }

  // GET /api/simulation/{id}/sar/observations
  if (method === 'GET' && seg.length === 5 && isSim && rest(3) === 'sar' && rest(4) === 'observations') {
    return readDemoSession().sarDetected ? [sarObservation()] : []
  }

  // POST /api/simulation/{id}/forward-drift
  if (method === 'POST' && seg.length === 4 && isSim && rest(3) === 'forward-drift') {
    const s = readDemoSession()
    writeDemoSession({ driftRun: true })
    const req = body as { durationHours?: number; oilType?: string }
    return forwardDriftResponse(
      { durationHours: req?.durationHours, oilType: req?.oilType },
      { lon: s.spillLon, lat: s.spillLat },
    )
  }

  // POST /api/simulation/{id}/backtrack
  if (method === 'POST' && seg.length === 4 && isSim && rest(3) === 'backtrack') {
    const s = readDemoSession()
    writeDemoSession({ backtrackRun: true })
    return backtrackingDto({ lon: s.spillLon, lat: s.spillLat })
  }

  // GET /api/simulation/{id}/backtrack/runs
  if (method === 'GET' && seg.length === 5 && isSim && rest(3) === 'backtrack' && rest(4) === 'runs') {
    const s = readDemoSession()
    return s.backtrackRun ? [backtrackingDto({ lon: s.spillLon, lat: s.spillLat })] : []
  }

  // -------------------------------------------------------------------------
  // /api/attribution/...
  // -------------------------------------------------------------------------
  // POST /api/attribution/run
  if (method === 'POST' && p === '/api/attribution/run') {
    const s = readDemoSession()
    writeDemoSession({ attributionRun: true })
    return attributionDto({ lon: s.spillLon, lat: s.spillLat })
  }

  // GET /api/attribution/runs
  if (method === 'GET' && p === '/api/attribution/runs') {
    const s = readDemoSession()
    return s.attributionRun ? [attributionDto({ lon: s.spillLon, lat: s.spillLat })] : []
  }

  // GET /api/attribution/runs/{runId}
  if (method === 'GET' && seg.length === 4 && seg[1] === 'attribution' && rest(2) === 'runs') {
    const s = readDemoSession()
    return s.attributionRun
      ? attributionDto({ lon: s.spillLon, lat: s.spillLat })
      : { attributionRunId: rest(3), status: 'failed', errors: ['no demo attribution run yet'] }
  }

  // GET /api/attribution/providers
  if (method === 'GET' && p === '/api/attribution/providers') return providersReport()

  // -------------------------------------------------------------------------
  // /api/environment/...
  // -------------------------------------------------------------------------
  if (method === 'GET' && (p === '/api/environment/current' || p === '/api/environment/wind')) {
    return demoEnvironmentGrid(p === '/api/environment/wind' ? 'wind' : 'current')
  }

  // Live feeds are honestly bypassed (available:false + reason) so the
  // Live Weather / incident chips never light up on fake data.
  if (method === 'GET' && p === '/api/environment/live-weather') return demoLiveWeather()
  if (method === 'GET' && p === '/api/environment/incidents') return demoIncidentFeed()
  if (method === 'GET' && p === '/api/environment/depth') return demoDepthReading()
  if (method === 'GET' && p === '/api/environment/ping-python') return demoPythonPing()

  if (method === 'GET' && p === '/api/health') return demoHealthInfo()

  // GET /api/incidents/{id}
  if (method === 'GET' && seg.length === 3 && seg[1] === 'incidents') return demoIncidentDto()

  // DELETE /api/workspace
  if (method === 'DELETE' && p === '/api/workspace') {
    resetDemoSession()
    return demoWorkspaceReset()
  }

  // -------------------------------------------------------------------------
  // STEP 11 — /api/investigation/...
  // -------------------------------------------------------------------------
  // POST /api/investigation/{incidentId}/start — idempotent
  if (method === 'POST' && seg.length === 4 && isInv && rest(3) === 'start') {
    writeDemoSession({ invPhase: 'running', invProgress: 0, invCompletedCount: 0 })
    return investigationDto()
  }

  // POST /api/investigation/{id}/cancel
  if (method === 'POST' && seg.length === 4 && isInv && rest(3) === 'cancel') {
    writeDemoSession({ invPhase: 'cancelled' })
    return investigationDto()
  }

  // POST /api/investigation/{id}/retry — restart a completed/failed demo run
  if (method === 'POST' && seg.length === 4 && isInv && rest(3) === 'retry') {
    if (readDemoSession().invPhase === 'completed') {
      writeDemoSession({ invPhase: 'running', invProgress: 0, invCompletedCount: 0 })
    }
    return investigationDto()
  }

  // POST /api/investigation/{id}/reveal
  if (method === 'POST' && seg.length === 4 && isInv && rest(3) === 'reveal') {
    writeDemoSession({ revealed: true })
    return revealResponse()
  }

  // GET /api/investigation/{id}/steps
  if (method === 'GET' && seg.length === 4 && isInv && rest(3) === 'steps') {
    return investigationStageStates(readDemoSession())
  }

  // GET /api/investigation/{id}/report
  if (method === 'GET' && seg.length === 4 && isInv && rest(3) === 'report') {
    return reportRecord()
  }

  // GET /api/investigation/{id}
  if (method === 'GET' && seg.length === 3 && isInv) return investigationDto()

  // GET /api/investigation — summary list
  if (method === 'GET' && p === '/api/investigation') {
    return readDemoSession().invPhase === 'none' ? [] : [investigationSummary()]
  }

  throw new Error(`CONTROLLED DEMO — unhandled route ${method} ${path}`)
}