import { useConnectionStore } from '@/store/connectionStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useUtcClock } from '@/hooks/useUtcClock'
import { useDataProvenance } from '@/ui/hooks/useDataProvenance'
import { isDemoMode } from '@/lib/demo/mode'
import { OilGuardMark } from '@/components/ui/Icon'

/**
 * Command Center global header.
 *
 * Every capsule reports real store state and carries an explicit status word —
 * a chip is never green without naming what is actually up. In controlled-demo
 * mode the header says so, so simulated telemetry can never be mistaken for
 * live telemetry.
 */

type Tone = 'ok' | 'warn' | 'down' | 'idle'

const TONE_WORD: Record<Tone, string> = {
  ok: 'Online',
  warn: 'Attention',
  down: 'Offline',
  idle: 'Idle',
}

function Capsule({
  id,
  label,
  tone,
  title,
}: {
  id: string
  label: string
  tone: Tone
  title: string
}) {
  return (
    <span className="cc-capsule" data-capsule={id} data-tone={tone} title={title}>
      <span className="cc-capsule-dot" aria-hidden="true" />
      <span className="cc-capsule-label">{label}</span>
      <span className="cc-capsule-state">{TONE_WORD[tone]}</span>
    </span>
  )
}

/** UTC ISO string -> "HH:MM:SS" shifted by a whole number of minutes. */
function clockIn(iso: string, offsetMinutes: number): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000)
  return shifted.toISOString().slice(11, 19)
}

export function GlobalHeader() {
  const iso = useUtcClock()
  const provenance = useDataProvenance()
  const connections = useConnectionStore((s) => s.connections)
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const sarProvenance = useSarStore((s) => s.provenance)
  const demo = isDemoMode()

  const connectionTone = (kind: 'mongo' | 'api' | 'websocket'): Tone => {
    const state = connections[kind]
    if (state === 'online') return 'ok'
    if (state === 'offline') return 'down'
    return 'idle'
  }

  const satelliteTone: Tone =
    sarProvenance === 'UNAVAILABLE' ? 'down' : sarProvenance ? 'ok' : 'idle'

  const aisTone: Tone = vesselCount > 0 ? 'ok' : 'idle'

  const driftTone: Tone =
    driftStatus === 'completed'
      ? 'ok'
      : driftStatus === 'running'
        ? 'warn'
        : driftStatus === 'failed'
          ? 'down'
          : 'idle'

  return (
    <header className="cc-header" role="banner">
      <div className="cc-brand">
        <span className="cc-brand-mark" aria-hidden="true">
          <OilGuardMark size={22} />
        </span>
        <span className="cc-brand-text">
          <span className="cc-brand-title">Maritime Oil Spill Intelligence</span>
          <span className="cc-brand-sub">Detect &bull; Trace &bull; Attribute &bull; Protect</span>
        </span>
      </div>

      <div className="cc-header-capsules">
        <Capsule
          id="mongo"
          label="MongoDB"
          tone={connectionTone('mongo')}
          title={`MongoDB connection: ${connections.mongo}`}
        />
        <Capsule
          id="satellite"
          label="Satellite Feed"
          tone={satelliteTone}
          title={`SAR provenance: ${sarProvenance ?? 'no observation ingested yet'}`}
        />
        <Capsule
          id="ais"
          label="AIS Feed"
          tone={aisTone}
          title={`${vesselCount} AIS vessel${vesselCount === 1 ? '' : 's'} in the active simulation`}
        />
        <Capsule
          id="drift"
          label="Drift Engine"
          tone={driftTone}
          title={`Forward drift model: ${driftStatus}`}
        />

        {demo ? (
          <span
            className="cc-demochip"
            title="This workspace is running a controlled demonstration. Simulated and fixture data are labelled as such throughout."
          >
            <span className="cc-demochip-dot" aria-hidden="true" />
            Controlled Demo &middot; Simulated Data
          </span>
        ) : (
          <Capsule
            id="provenance"
            label="Provenance"
            tone={provenance.kind === 'live' ? 'ok' : 'idle'}
            title={provenance.label}
          />
        )}
      </div>

      <div className="cc-header-right">
        <div className="cc-clock">
          <div className="cc-clock-main">
            <span className="cc-clock-time">{clockIn(iso, 0)}</span>
            <span className="cc-clock-zone">UTC</span>
          </div>
          <div className="cc-clock-main">
            <span className="cc-clock-time">{clockIn(iso, 330)}</span>
            <span className="cc-clock-zone">IST</span>
          </div>
          <div className="cc-clock-date">{new Date(iso).toISOString().slice(0, 10)}</div>
        </div>

        <span className="cc-head-div" aria-hidden="true" />

        <button type="button" className="cc-user" title="Signed in as Nikhil Singh — Analyst">
          <span className="cc-user-avatar" aria-hidden="true">
            NS
          </span>
          <span className="cc-user-text">
            <span className="cc-user-name">Nikhil Singh</span>
            <span className="cc-user-role">Analyst</span>
          </span>
          <span className="cc-user-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
    </header>
  )
}
