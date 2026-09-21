import { useSimulationStore } from '@/store/simulationStore'
import type { OperationalStatusTone } from '@/ui/design-system/StatusBadge'

function statusTone(status: string | null): OperationalStatusTone {
  switch (status) {
    case 'simulating': return 'run'
    case 'observation': return 'ok'
    case 'captain_mode': return 'warn'
    case 'investigation': return 'ok'
    case 'completed': return 'ok'
    default: return 'idle'
  }
}

/**
 * Simulation-specific vertical control rail for the /simulation route.
 * Shows scenario lifecycle, fleet, spill, and drift status at a glance.
 * This is NOT the 8-stage FlightpathRail — it's purpose-built for captain mode.
 */
export function SimulationControlRail({ collapsed }: { collapsed: boolean }) {
  const status = useSimulationStore((s) => s.status)
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const selectedVessel = useSimulationStore((s) => s.selectedVesselId)
  const spill = useSimulationStore((s) => s.spill)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const clock = useSimulationStore((s) => s.clock)

  const clockLabel = clock
    ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
    : '—'

  const steps = [
    {
      id: 'scenario',
      label: 'Scenario',
      subtitle: status ?? 'No scenario',
      tone: statusTone(status),
      done: status != null,
    },
    {
      id: 'fleet',
      label: 'Fleet',
      subtitle: vesselCount > 0 ? `${vesselCount} vessels` : 'No vessels',
      tone: (vesselCount > 0 ? 'ok' : 'idle') as OperationalStatusTone,
      done: vesselCount > 0,
    },
    {
      id: 'vessel',
      label: 'Vessel',
      subtitle: selectedVessel ? 'Selected' : 'None selected',
      tone: (selectedVessel ? 'ok' : 'idle') as OperationalStatusTone,
      done: !!selectedVessel,
    },
    {
      id: 'spill',
      label: 'Spill',
      subtitle: spill?.spillEventId ? 'Released' : 'Not released',
      tone: (spill?.spillEventId ? 'warn' : 'idle') as OperationalStatusTone,
      done: !!spill?.spillEventId,
    },
    {
      id: 'drift',
      label: 'Forward drift',
      subtitle: driftStatus === 'idle' ? 'Not started' : driftStatus,
      tone: (driftStatus === 'completed' ? 'ok' : driftStatus === 'running' ? 'run' : driftStatus === 'failed' ? 'danger' : 'idle') as OperationalStatusTone,
      done: driftStatus === 'completed',
    },
  ]

  return (
    <nav className="h-full flex flex-col bg-[var(--bg-canvas)]" aria-label="Simulation controls">
      <div className={`p-4 border-b border-[var(--border-default)] flex items-center ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed && (
          <div>
            <h2 className="text-xs font-semibold text-ink-1 tracking-wider">Captain mode</h2>
            <p className="text-[10px] font-mono text-ink-3 mt-0.5">{clockLabel}</p>
          </div>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--border-default)]/50">
            <svg className="w-4 h-4 text-ink-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {steps.map((step) => (
          <div
            key={step.id}
            className="relative w-full flex items-center p-2 rounded text-left"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8">
              {step.done ? (
                <svg className="w-4 h-4 text-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : step.tone === 'run' ? (
                <div className="w-2.5 h-2.5 rounded bg-accent animate-pulse" />
              ) : (
                <div className="w-2 h-2 rounded bg-ink-faint" />
              )}
            </div>

            {!collapsed && (
              <div className="ml-3 overflow-hidden">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm whitespace-nowrap ${step.done || step.tone === 'run' ? 'text-ink-1' : 'text-ink-3'}`}>
                    {step.label}
                  </span>
                </div>
                <p className="text-[10px] text-ink-muted truncate mt-0.5">
                  {step.subtitle}
                </p>
              </div>
            )}

            {collapsed && (
              <span className="sr-only">{step.label}: {step.subtitle}</span>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
