import { Button } from '@/components/ui/Button'
import {
  useChallengeStore,
  runLiveChallenge,
  phaseLabel,
  resetCaseState,
} from '@/components/commandcenter/ChallengeRunner'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useAttributionStore } from '@/store/featureStores'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useInvestigationStore } from '@/store/investigationStore'

type ProvTone = 'run' | 'ok' | 'demo' | 'danger' | 'na'

function ProvChip({ keyName, value, tone }: { keyName: string; value: string; tone: ProvTone }) {
  return (
    <span className={`cc-prov cc-prov--${tone}`} title={`${keyName} · ${value}`}>
      <span className="cc-prov-dot" aria-hidden="true" />
      <span className="cc-prov-key">{keyName}</span>
      <span className="cc-prov-val">{value}</span>
    </span>
  )
}

function sarTone(value: string | null): ProvTone {
  if (!value) return 'na'
  if (/UNAVAIL/i.test(value)) return 'danger'
  if (/REAL|CACHED|SENTINEL/i.test(value)) return 'ok'
  if (/FIXTURE|SYNTHETIC/i.test(value)) return 'demo'
  return 'na'
}

function onOff(value: string | null): ProvTone {
  if (!value) return 'na'
  if (/OPEN_METEO|OPEN-METEO|CMEMS|ERA5|REAL|CACHED/i.test(value)) return 'ok'
  if (/CONTROLLED|TEST|FIXTURE|SYNTHETIC|DEMO/i.test(value)) return 'demo'
  return 'na'
}

function formatAis(value: string | null, investigating: boolean): { value: string; tone: ProvTone } {
  if (value) {
    return {
      value: value.replace(/_/g, ' '),
      tone: /OPEN|REAL|CMEMS/i.test(value) ? 'ok' : onOff(value),
    }
  }
  if (investigating) return { value: 'QUERYING', tone: 'run' }
  return { value: 'AWAITING', tone: 'na' }
}

/** Case identity + live provenance strip + challenge action — the toolbar bar. */
export function CaseHeader() {
  const challengePhase = useChallengeStore((s) => s.phase)
  const challengeLabel = useChallengeStore((s) => s.label)
  const challengeError = useChallengeStore((s) => s.error)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const clock = useSimulationStore((s) => s.clock)
  const simStatus = useSimulationStore((s) => s.status)
  const driftEnv = useSimulationStore((s) => s.drift.environmentSource)
  const sar = useSarStore((s) => s.provenance)
  const sarActive = useSarStore((s) => s.active)
  const current = useEnvironmentStore((s) => s.current)
  const wind = useEnvironmentStore((s) => s.wind)
  const aisSource = useAttributionStore((s) => s.aisSource)
  const invStatus = useInvestigationStore((s) => s.status)

  const running = challengePhase === 'preparing' || challengePhase === 'running'
  const investigating = invStatus === 'CREATED' || invStatus === 'RUNNING'

  const windValue = driftEnv
    ? driftEnv
    : wind.status === 'available'
      ? wind.label.split('/')[0].trim()
      : wind.status === 'awaiting'
        ? 'AWAITING'
        : wind.status === 'unavailable'
          ? 'UNAVAILABLE'
          : 'DEMO'
  const currentValue = driftEnv
    ? driftEnv
    : current.status === 'available'
      ? current.label.split('/')[0].trim()
      : current.status === 'awaiting'
        ? 'AWAITING'
        : current.status === 'unavailable'
          ? 'UNAVAILABLE'
          : 'DEMO'

  const tagClass =
    challengeLabel === 'DEMO' ? 'cc-case-tag cc-case-tag--demo' : 'cc-case-tag cc-case-tag--live'
  const clockLabel = clock
    ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ').replace('Z', '') + 'Z'
    : '—'

  const simPhase = challengePhase === 'done' && invStatus === 'COMPLETED' ? 'done' : challengePhase

  return (
    <div className="cc-casebar">
      <div className={tagClass}>
        <span className="cc-mode-pill">{challengeLabel ?? (simulationId ? 'CASE' : 'IDLE')}</span>
        <div style={{ minWidth: 0 }}>
          <div className="cc-case-name">MARITIME INCIDENT INTELLIGENCE</div>
          <div className="cc-case-sub">
            <span>Active case</span>
            {simulationId ? <span className="cc-id">{simulationId.slice(0, 14)}…</span> : null}
            <span className="cc-id">T {clockLabel}</span>
            {simStatus ? <span className="cc-id">{simStatus.replace('_', ' ')}</span> : null}
          </div>
        </div>
      </div>

      <div className="cc-prov-strip" aria-label="Data provenance">
        <ProvChip
          keyName="SAR"
          value={sar ? sar.replace(/_/g, ' ') : sarActive ? 'PROCESSING' : 'AWAITING'}
          tone={sarActive ? 'run' : sarTone(sar)}
        />
        <ProvChip
          keyName="WINDS"
          value={windValue.replace(/_/g, ' ')}
          tone={driftEnv ? onOff(driftEnv) : wind.status === 'awaiting' ? 'na' : wind.status === 'unavailable' ? 'danger' : wind.status === 'demo' ? 'demo' : 'ok'}
        />
        <ProvChip
          keyName="CURRENTS"
          value={currentValue.replace(/_/g, ' ')}
          tone={driftEnv ? onOff(driftEnv) : current.status === 'awaiting' ? 'na' : current.status === 'unavailable' ? 'danger' : current.status === 'demo' ? 'demo' : 'ok'}
        />
        <ProvChip
          keyName="AIS"
          value={formatAis(aisSource, investigating).value}
          tone={formatAis(aisSource, investigating).tone}
        />
      </div>

      <div className="cc-actions">
        {challengePhase !== 'idle' ? (
          <span className={`cc-phase-note${challengePhase === 'failed' ? ' cc-phase-note--fail' : ''}`}>
            <span className="cc-prov-dot" aria-hidden="true" />
            {phaseLabel(simPhase)}
          </span>
        ) : null}
        {challengeError ? (
          <span className="cc-phase-note cc-phase-note--fail" title={challengeError}>
            {challengeError.slice(0, 60)}
          </span>
        ) : null}
        <Button
          variant="primary"
          disabled={running || challengePhase === 'detecting' || challengePhase === 'drifting' || challengePhase === 'investigating'}
          onClick={() => void runLiveChallenge('LIVE')}
          title="Run the full pipeline live, watch every stage animate"
        >
          {running ? 'Starting…' : 'Start live challenge'}
        </Button>
        {challengePhase === 'done' ? (
          <Button
            title="Clear results and rebuild from a fresh scenario"
            onClick={() => {
              resetCaseState()
              void runLiveChallenge('LIVE')
            }}
          >
            New case
          </Button>
        ) : null}
      </div>
    </div>
  )
}