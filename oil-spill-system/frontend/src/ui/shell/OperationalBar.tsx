import { useDataProvenance } from '@/ui/hooks/useDataProvenance'
import { useUtcClock } from '@/hooks/useUtcClock'
import { useConnectionStore } from '@/store/connectionStore'
import { useSimulationStore } from '@/store/simulationStore'
import { BrandLockup } from '@/ui/design-system'
import { DEMO_MODE_LABEL, isDemoMode } from '@/lib/demo/mode'

export function OperationalBar() {
  const clock = useUtcClock()
  const provenance = useDataProvenance()
  const connections = useConnectionStore((s) => s.connections)
  const simulationId = useSimulationStore((s) => s.simulationId)

  // Only show "Controlled", "Simulated", "No data", etc. (text with dot, no badge/pill)
  const caseRef = simulationId ? `CASE-${simulationId.slice(0, 8)}` : 'NO-CASE'

  return (
    <div className="flex items-center justify-between h-10 px-4 border-b border-[var(--border-default)] bg-[var(--bg-canvas)] text-xs font-mono select-none">
      <div className="flex items-center space-x-6 text-ink-3">
        <BrandLockup />
        <span className="text-ink-1">{caseRef}</span>
        <span>{clock.slice(11, 19)} ZULU</span>
        {isDemoMode() && (
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
            {DEMO_MODE_LABEL}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded ${provenance.dotClass}`} />
          <span className={provenance.toneClass}>{provenance.label}</span>
        </div>

        <div className="flex items-center space-x-4 text-ink-3">
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded ${connections.api === 'online' ? 'bg-ok' : 'bg-warn'}`} />
            <span>API</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded ${connections.websocket === 'online' ? 'bg-ok' : 'bg-warn'}`} />
            <span>WSS</span>
          </div>
        </div>

        <button 
          className="flex items-center space-x-1 text-ink-3 hover:text-ink-1 transition-colors px-2 py-1 rounded bg-[var(--border-default)]/50"
          title="Command Palette (Cmd+K)"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
          }}
        >
          <span>Cmd+K</span>
        </button>
      </div>
    </div>
  )
}
