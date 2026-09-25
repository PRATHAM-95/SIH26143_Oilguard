import type { WsHandlers, WsConnectionStatus } from '@/lib/ws'
import {
  DEMO_INVESTIGATION_ID,
  DEMO_SIMULATION_ID,
  DEMO_STAGE_ORDER,
  demoClock,
  readDemoSession,
  writeDemoSession,
  DEMO_PROVENANCE,
} from './seed'

export type DemoDriverHandlers = WsHandlers

function noop(): void {
  /* no-op */
}

/**
 * Demo stand-in for the simulation WebSocket.
 *
 * No real socket is created. When "connected" it reports open and pushes a
 * single deterministic clock_update (the same frame the live backend signs off
 * with at subscription time); every other payload the UI needs already arrives
 * through the deterministic REST adapter.
 */
export class DemoSimulationDriver {
  private handlers: DemoDriverHandlers = {}
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  connect(handlers: DemoDriverHandlers): void {
    this.handlers = handlers
    this.closed = false
    this.notify('connecting')
    this.openTimer = setTimeout(() => {
      if (this.closed) return
      this.notify('open')
      this.handlers.onEvent?.({
        type: 'clock_update',
        time: demoClock(),
      })
    }, 120)
  }

  disconnect(): void {
    this.closed = true
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
    this.notify('closed')
  }

  send(): void {
    noop()
  }

  private notify(status: WsConnectionStatus): void {
    try {
      this.handlers.onStatus?.(status)
    } catch {
      // listener errors must not break the demo driver
    }
  }
}

/**
 * Demo stand-in for the investigation WebSocket.
 *
 * On connect it reports open and — while the demo session holds the
 * investigation in the `running` phase — replays the remaining stage frames
 * with a fixed interval (no randomness, no wall-clock jitter). It halts the
 * moment the session leaves `running` (covers Cancel) and stores progress after
 * every frame so a reload resumes from the same point. Completion marks the
 * session `completed`.
 */
export class DemoInvestigationDriver {
  private handlers: DemoDriverHandlers = {}
  private timers: ReturnType<typeof setTimeout>[] = []
  private closed = false
  private readonly investigationId: string
  private readonly simulationId: string

  /** ms between consecutive stage frames */
  static readonly STAGE_WINDOW_MS = 1400
  /** ms before the first frame starts */
  static readonly FIRST_FRAME_DELAY_MS = 300

  constructor(investigationId: string = DEMO_INVESTIGATION_ID, simulationId: string = DEMO_SIMULATION_ID) {
    this.investigationId = investigationId
    this.simulationId = simulationId
  }

  connect(handlers: DemoDriverHandlers): void {
    this.handlers = handlers
    this.closed = false
    this.notify('connecting')

    const session = readDemoSession()
    const resumeAt = session.invCompletedCount
    const shouldRun = session.invPhase === 'running' && session.invProgress < 1

    this.timers.push(
      setTimeout(() => {
        if (this.closed) return
        this.notify('open')
        if (shouldRun) {
          this.scheduleRemaining(resumeAt)
        }
      }, DemoInvestigationDriver.FIRST_FRAME_DELAY_MS),
    )
  }

  disconnect(): void {
    this.closed = true
    this.timers.forEach((t) => clearTimeout(t))
    this.timers = []
    this.notify('closed')
  }

  send(): void {
    noop()
  }

  private scheduleRemaining(startIndex: number): void {
    const total = DEMO_STAGE_ORDER.length
    let i = startIndex
    const tick = () => {
      if (this.closed) return
      const session = readDemoSession()
      if (session.invPhase !== 'running') return // cancelled / completed externally
      if (i >= total) {
        writeDemoSession({ invPhase: 'completed', invProgress: 1, invCompletedCount: total })
        this.handlers.onEvent?.({
          type: 'investigation_complete',
          investigationId: this.investigationId,
          simulationId: this.simulationId,
          progress: 1,
          conclusionStatus: 'candidate',
          conclusion: this.conclusionPayload(),
          message: 'Deterministic synthetic pipeline complete.',
        })
        return
      }
      const stageId = DEMO_STAGE_ORDER[i]
      const progress = Math.min(1, (i + 1) / total)
      this.handlers.onEvent?.({
        type: 'step_complete',
        investigationId: this.investigationId,
        simulationId: this.simulationId,
        stageId,
        stageStatus: 'completed',
        progress,
        detail: `Synthetic ${stageId} stage (controlled demo).`,
      })
      writeDemoSession({ invProgress: progress, invCompletedCount: i + 1 })
      i += 1
      this.timers.push(setTimeout(tick, DemoInvestigationDriver.STAGE_WINDOW_MS))
    }
    this.timers.push(setTimeout(tick, 0))
  }

  private conclusionPayload(): Record<string, unknown> {
    return {
      status: 'candidate',
      reason: 'Candidate ranked by deterministic synthetic attribution model.',
      aggregation: DEMO_PROVENANCE,
      provenance: DEMO_PROVENANCE,
      topScore: 0.84,
      margin: 0.43,
      decisive: true,
      candidate: { mmsi: '999117003', name: 'SAMPLE TANKER AURORA', rank: 1 },
      thresholdsUsed: { topScore: 0.5, margin: 0.2 },
      why: 'Closest-approach geometry and trajectory agreement dominate the composite score.',
      referenceAttributionRunId: 'DEMO-ATR-0001',
      referenceBacktrackRunId: 'DEMO-BCK-0001',
    }
  }

  private notify(status: WsConnectionStatus): void {
    try {
      this.handlers.onStatus?.(status)
    } catch {
      // listener errors must not break the demo driver
    }
  }
}