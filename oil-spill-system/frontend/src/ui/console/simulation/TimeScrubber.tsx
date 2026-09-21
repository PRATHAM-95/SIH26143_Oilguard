import { useSimulationStore } from '@/store/simulationStore'
import { Button } from '@/ui/design-system/Button'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'

function statusTone(s: string | null): OperationalStatusTone {
  switch (s) {
    case 'simulating': return 'run'
    case 'observation':
    case 'completed': return 'ok'
    case 'captain_mode': return 'warn'
    default: return 'idle'
  }
}

/**
 * Compact time control bar for the simulation console.
 * Displays simulation clock and advance-time step buttons.
 * Uses mono font for timestamps per MASTER_BRIEF §6.3.
 */
export function TimeScrubber() {
  const status = useSimulationStore((s) => s.status)
  const clock = useSimulationStore((s) => s.clock)
  const busy = useSimulationStore((s) => s.busy)
  const advance = useSimulationStore((s) => s.advance)

  const simulating = status === 'simulating'
  const clockLabel = clock
    ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
    : '—'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-mist">Simulation clock</span>
        <StatusBadge tone={statusTone(status)}>
          {status ?? 'Idle'}
        </StatusBadge>
      </div>

      <div className="font-mono text-sm text-foam tabular-nums tracking-tight">
        {clockLabel}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-ink-muted shrink-0">Advance</span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !simulating}
          onClick={() => void advance(1)}
        >
          +1h
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !simulating}
          onClick={() => void advance(6)}
        >
          +6h
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !simulating}
          onClick={() => void advance(12)}
        >
          +12h
        </Button>
      </div>
    </div>
  )
}
