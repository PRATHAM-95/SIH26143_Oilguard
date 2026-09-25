import { MODULE_LABEL, useUiStore, type ActiveModule } from '@/store/uiStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useConnectionStore } from '@/store/connectionStore'
import { REGION_BY_ID } from '@/store/mapStore'
import { isDemoMode } from '@/lib/demo/mode'
import { runLiveChallenge, useChallengeStore, type ChallengePhase } from '@/ui/console/ChallengeRunner'

/**
 * Module navigation strip.
 *
 * Two distinct registers, deliberately unequal in weight:
 *   - the amber-anchored operational CONTEXT (what area of ocean this is), and
 *   - the functional MODULE tabs (which capability is in focus).
 *
 * The alert readout is derived from real pipeline state, and the CTA drives the
 * real `runLiveChallenge` sequencer — "no active alerts" genuinely means
 * nothing is running, it is not a hardcoded string.
 */

const MODULE_ORDER: ActiveModule[] = [
  'monitoring',
  'detection',
  'characterization',
  'tracking',
  'attribution',
  'investigation',
]

/** Phases where the sequencer owns the pipeline and re-entry would race it. */
const BUSY_PHASES: ChallengePhase[] = [
  'preparing',
  'running',
  'detecting',
  'drifting',
  'investigating',
]

export function ModuleNavigation() {
  const activeModule = useUiStore((s) => s.activeModule)
  const setActiveModule = useUiStore((s) => s.setActiveModule)
  const phase = useChallengeStore((s) => s.phase)
  const challengeError = useChallengeStore((s) => s.error)
  const investigationStatus = useInvestigationStore((s) => s.status)
  const sarCount = useSarStore((s) => s.candidates.length)
  const hasSpill = useSimulationStore((s) => s.spill != null)
  const connections = useConnectionStore((s) => s.connections)
  const demo = isDemoMode()

  const busy = BUSY_PHASES.includes(phase)

  // Connection loss is surfaced here as well as in the header capsules so the
  // alert readout and the footer health pill always agree.
  const downLinks = (['api', 'websocket', 'mongo'] as const).filter(
    (k) => connections[k] === 'offline',
  )

  // In the controlled demo no live socket is ever expected — the deterministic
  // adapter answers every call locally. Reporting that as an outage would be
  // wrong, so it degrades to an advisory instead of an incident.
  const expectedSocketGap = demo && connections.websocket !== 'online'
  const outage = downLinks.filter((k) => !(expectedSocketGap && k === 'websocket'))

  const activeSignals: string[] = []
  if (busy) activeSignals.push('Pipeline running')
  if (investigationStatus === 'RUNNING') activeSignals.push('Investigation active')
  if (hasSpill) activeSignals.push('Slick under analysis')
  if (sarCount > 0) activeSignals.push(`${sarCount} SAR candidate${sarCount === 1 ? '' : 's'}`)

  const tone =
    phase === 'failed' || outage.length > 0
      ? 'down'
      : expectedSocketGap || activeSignals.length > 0
        ? 'warn'
        : 'ok'

  const headline =
    phase === 'failed'
      ? 'Pipeline Error'
      : outage.length > 0
        ? 'Backend Offline'
        : expectedSocketGap
          ? 'Simulated Feed'
          : activeSignals.length > 0
            ? `${activeSignals.length} Active Alert${activeSignals.length === 1 ? '' : 's'}`
            : 'No Active Alerts'

  const detail =
    challengeError ??
    (outage.length > 0
      ? `${outage.join(', ')} unreachable`
      : expectedSocketGap
        ? 'Demo session · live socket not required'
        : activeSignals.length > 0
          ? activeSignals.join(' · ')
          : 'System nominal')

  return (
    <div className="cc-nav">
      <div className="cc-nav-context" aria-label="Operational context">
        <span className="cc-nav-context-glyph" aria-hidden="true">
          ⚓
        </span>
        <span className="cc-nav-context-text">
          <span className="cc-nav-context-title">Maritime Incident Intelligence</span>
          <span className="cc-nav-context-region">{REGION_BY_ID.io.label} Region</span>
        </span>
      </div>

      <div className="cc-nav-tabs" role="tablist" aria-label="Intelligence modules">
        {MODULE_ORDER.map((module) => (
          <button
            key={module}
            type="button"
            role="tab"
            className="cc-nav-tab"
            aria-selected={activeModule === module}
            onClick={() => setActiveModule(module)}
          >
            {MODULE_LABEL[module]}
          </button>
        ))}
      </div>

      <div className="cc-nav-right">
        <span className="cc-alert" data-tone={tone} title={detail}>
          <span className="cc-alert-dot" aria-hidden="true" />
          <span className="cc-alert-text">
            <span className="cc-alert-title">{headline}</span>
            <span className="cc-alert-sub">{detail}</span>
          </span>
        </span>

        <button
          type="button"
          className="cc-cta"
          disabled={busy}
          onClick={() => void runLiveChallenge('LIVE')}
          title={
            busy
              ? 'A live challenge is already running'
              : 'Run the full detection → attribution pipeline against the live backend'
          }
        >
          {busy ? 'Running…' : 'Start New Challenge'}
          <span className="cc-cta-plus" aria-hidden="true">
            +
          </span>
        </button>
      </div>
    </div>
  )
}
