import { useSimulationStore } from '@/store/simulationStore'
import { useConnectionStore } from '@/store/connectionStore'
import { useUiStore } from '@/store/uiStore'
import { MODULE_LABEL } from '@/store/uiStore'
import { isDemoMode } from '@/lib/demo/mode'

/**
 * System footer.
 *
 * Product identity and operational health only. The previous version printed
 * `NO-CASE`, the raw simulation id and `ENGINE CONTROLLED` — developer
 * telemetry that made the surface read as a debug panel. Those values remain
 * available in the Analysis & Control rail where they belong.
 */
export function SystemFooter() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const connections = useConnectionStore((s) => s.connections)
  const activeModule = useUiStore((s) => s.activeModule)
  const demo = isDemoMode()

  // Same predicate as the module-nav alert, so the two never disagree. A live
  // socket is never expected under the controlled demo, so its absence is an
  // advisory, not an outage.
  const expectedSocketGap = demo && connections.websocket !== 'online'
  const outage = (['api', 'websocket', 'mongo'] as const).filter(
    (k) => connections[k] === 'offline' && !(expectedSocketGap && k === 'websocket'),
  )
  const degraded = outage.length > 0
  const health = degraded
    ? 'Attention Required'
    : expectedSocketGap
      ? 'Simulated Environment'
      : 'All Systems Operational'
  const tone = degraded ? 'warn' : expectedSocketGap ? 'info' : 'ok'

  return (
    <footer className="cc-footer" role="contentinfo">
      <span className="cc-footer-brand">
        <span className="cc-footer-product">OilGuard</span>
        <span className="cc-footer-version">v1.0.0</span>
        <span className="cc-footer-tagline">Indian Ocean Oil Spill Intelligence System</span>
      </span>

      <span className="cc-footer-sep" aria-hidden="true" />

      <span className="cc-footer-item cc-footer-muted">
        Module <span className="cc-footer-value">{MODULE_LABEL[activeModule]}</span>
      </span>

      {simulationId ? (
        <>
          <span className="cc-footer-sep" aria-hidden="true" />
          <span className="cc-footer-item cc-footer-muted">
            Case <span className="cc-footer-value">Active</span>
          </span>
        </>
      ) : null}

      <div className="cc-footer-right">
        <nav className="cc-footer-links" aria-label="Footer">
          <button type="button" className="cc-footer-link">
            About
          </button>
          <button type="button" className="cc-footer-link">
            Documentation
          </button>
          <button type="button" className="cc-footer-link">
            Support
          </button>
          <button type="button" className="cc-footer-link">
            Contact
          </button>
        </nav>

        <span className="cc-footer-sep" aria-hidden="true" />

        <span className="cc-footer-item cc-footer-health" data-tone={tone}>
          <span className="cc-footer-dot" data-tone={tone} aria-hidden="true" />
          {health}
        </span>
      </div>
    </footer>
  )
}
