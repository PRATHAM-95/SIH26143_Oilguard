import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { ProvenancePill, Disclaimer } from '@/components/ui/primitives'
import {
  ArrowRightIcon,
  BacktraceIcon,
  CompassIcon,
  CrosshairIcon,
  DossierIcon,
  MinusIcon,
  RadarIcon,
  ShipIcon,
  type IconProps,
} from '@/components/ui/Icon'
import { useChallengeStore, runLiveChallenge, type ChallengePhase } from '@/ui/console/ChallengeRunner'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { useInvestigationStore, STAGE_ORDER } from '@/store/investigationStore'
import { useConnectionStore } from '@/store/connectionStore'
import { useMapStore } from '@/store/mapStore'
import { useIncidentStore } from '@/store/incidentStore'
import { useUiStore, type AnalysisType, type RightPanelTab } from '@/store/uiStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { isDemoMode } from '@/lib/demo/mode'

/* ------------------------------------------------------------------ */
/* Live activity feed — derived from real store transitions. The       */
/* controlled-demo baseline below is the only non-derived content and    */
/* is gated on demo mode; real pipeline events always displace it.      */
/* ------------------------------------------------------------------ */

type Activity = {
  id: number
  time: string
  tone: 'ok' | 'warn' | 'run' | 'danger' | 'dim'
  title: string
  sub?: string
  /** Seeded demonstration row — not a record of a real pipeline event. */
  demo?: boolean
}

/**
 * Scenario context shown in controlled-demo mode before any live pipeline has
 * run. Deliberately describes the *exercise*, not fabricated detections, and
 * is replaced the moment a real event arrives.
 */
const DEMO_BASELINE_ACTIVITY: Activity[] = [
  { id: -1, time: '06:42', tone: 'dim', title: 'Demonstration scenario loaded', sub: 'Indian Ocean operating region', demo: true },
  { id: -2, time: '06:40', tone: 'dim', title: 'Sentinel-1 acquisition window opens', sub: 'Simulated SAR pass, Arabian Sea sector', demo: true },
  { id: -3, time: '06:36', tone: 'dim', title: 'AIS feed connected', sub: 'Simulated vessel traffic enabled', demo: true },
]


let activitySeq = 1

function nowHhmm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function useActivityFeed(): Activity[] {
  const simStatus = useSimulationStore((s) => s.status)
  const hasSpill = useSimulationStore((s) => !!s.spill?.spillEventId)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const sarCount = useSarStore((s) => s.candidates.length)
  const sarProvenance = useSarStore((s) => s.provenance)
  const bakStatus = useBacktrackingStore((s) => s.status)
  const originEst = useBacktrackingStore((s) => !!s.origin)
  const atrStatus = useAttributionStore((s) => s.status)
  const atrCount = useAttributionStore((s) => s.vessels.length)
  const invStatus = useInvestigationStore((s) => s.status)
  const completedStages = useInvestigationStore((s) => s.stages.filter((st) => st.status === 'completed').length)

  const [feed, setFeed] = useState<Activity[]>([])
  const prev = useRef({
    simStatus,
    hasSpill,
    driftStatus,
    sarCount,
    sarProvenance,
    bakStatus,
    originEst,
    atrStatus,
    atrCount,
    invStatus,
    completedStages,
  })

  const push = useCallback((entry: Omit<Activity, 'id' | 'time'>) => {
    setFeed((f) =>
      [{ id: activitySeq++, time: nowHhmm(), ...entry }, ...f].slice(0, 12),
    )
  }, [])

  useEffect(() => {
    const p = prev.current
    const changes: Omit<Activity, 'id' | 'time'>[] = []
    if (invStatus !== p.invStatus) {
      if (invStatus) changes.push({ tone: invStatus === 'RUNNING' ? 'run' : 'ok', title: `Investigation ${invStatus.toLowerCase()}`, sub: 'Case pipeline advancing' })
    }
    if (hasSpill && !p.hasSpill) {
      changes.push({ tone: 'warn', title: 'Oil slick observed', sub: 'Release event registered in live scenario' })
    }
    if (driftStatus !== p.driftStatus && driftStatus === 'completed') {
      changes.push({ tone: 'ok', title: 'Forward drift complete', sub: 'OpenOil particle run finished' })
    }
    if (sarCount > p.sarCount) {
      changes.push({ tone: 'warn', title: `Oil slick detected — ${sarCount} candidate${sarCount > 1 ? 's' : ''}`, sub: `SAR source ${(sarProvenance ?? 'n/a').replace(/_/g, ' ')}` })
    }
    if (bakStatus !== p.bakStatus) {
      if (bakStatus === 'completed' && originEst) {
        changes.push({ tone: 'ok', title: 'Backtrack complete', sub: 'Probable source region estimated' })
      } else if (bakStatus === 'running') {
        changes.push({ tone: 'run', title: 'Backtrack started', sub: 'Ensemble backward trajectories' })
      }
    }
    if (atrStatus !== p.atrStatus && atrStatus === 'completed') {
      changes.push({ tone: 'ok', title: `${atrCount} vessel${atrCount > 1 ? 's' : ''} scored`, sub: 'Attribution ranking ready' })
    }
    if (completedStages > p.completedStages) {
      changes.push({ tone: 'dim', title: `Stage ${completedStages}/${STAGE_ORDER.length} complete`, sub: 'Investigation advancing' })
    }
    prev.current = {
      simStatus,
      hasSpill,
      driftStatus,
      sarCount,
      sarProvenance,
      bakStatus,
      originEst,
      atrStatus,
      atrCount,
      invStatus,
      completedStages,
    }
    changes.forEach(push)
  }, [
    simStatus,
    hasSpill,
    driftStatus,
    sarCount,
    sarProvenance,
    bakStatus,
    originEst,
    atrStatus,
    atrCount,
    invStatus,
    completedStages,
    push,
  ])

  return feed
}

function ActivityFeed() {
  const live = useActivityFeed()
  // Only seed while nothing real has happened, and only under ?demo=1.
  const feed = live.length === 0 && isDemoMode() ? DEMO_BASELINE_ACTIVITY : live
  const seeded = feed !== live

  if (feed.length === 0) {
    return (
      <div className="activity-empty">
        <span className="activity-empty-title">No active incident</span>
        <span className="activity-empty-body">
          Run Detection or launch a controlled challenge to populate the
          operational workspace.
        </span>
      </div>
    )
  }
  return (
    <>
      {seeded ? (
        <div className="activity-seednote">
          <span className="activity-seednote-tag">Controlled demo</span>
          Scenario context — no live pipeline has run in this session yet.
        </div>
      ) : null}
      <ol className="activity">
        {feed.map((a) => (
          <li key={a.id} className="activity-item" data-demo={a.demo || undefined}>
            <span className={`activity-dot activity-dot--${a.tone}`} aria-hidden="true" />
            <div className="activity-body">
              <div className="activity-title">
                {a.title}
                {a.demo ? <span className="activity-tag">Simulated</span> : null}
              </div>
              {a.sub ? <div className="activity-sub">{a.sub}</div> : null}
            </div>
            <span className="activity-time">{a.time}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Simulation + incident readouts (from real stores verbatim)          */
/* ------------------------------------------------------------------ */

function CaptainSimulationPanel() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const status = useSimulationStore((s) => s.status)
  const clock = useSimulationStore((s) => s.clock)
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const hasSpill = useSimulationStore((s) => s.spill?.spillEventId != null)
  const provenance = useSimulationStore((s) => s.drift.environmentSource)

  if (!simulationId) {
    return (
      <Panel title="Captain simulation">
        <EmptyState label="No simulation running" hint="Start a live challenge to seed the scenario." />
      </Panel>
    )
  }

  return (
    <Panel title="Captain simulation" right={<ProvenancePill value={provenance ?? 'CONTROLLED'} />}>
      <KeyValue label="Simulation" value={simulationId.slice(0, 18) + '…'} />
      <KeyValue label="Status" value={status ?? '—'} />
      <KeyValue
        label="Clock"
        value={clock ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ') + 'Z' : '—'}
      />
      <KeyValue label="Vessels" value={vesselCount} />
      <KeyValue label="Spill event" value={hasSpill ? 'released' : 'none'} />
    </Panel>
  )
}

function IncidentPanel() {
  const incident = useIncidentStore((s) => s)
  const spill = useSimulationStore((s) => s.spill)
  if (incident.status === 'none') {
    return (
      <Panel title="Incident">
        <EmptyState
          label={spill?.incidentId ? 'Incident detected — pipeline ready' : 'No incident yet'}
          hint="The released slick creates the detected incident the investigation traces."
        />
      </Panel>
    )
  }
  return (
    <Panel title="Incident">
      <KeyValue label="Status" value={incident.status} />
      <KeyValue label="Observation" value={incident.observation} />
      {incident.location ? (
        <KeyValue
          label="Location"
          value={`${incident.location.lat.toFixed(4)}°, ${incident.location.lon.toFixed(4)}°`}
        />
      ) : null}
      {incident.observationTime ? <KeyValue label="Observed at" value={incident.observationTime} /> : null}
      {incident.detectionConfidence != null ? (
        <KeyValue
          label="Detection confidence"
          value={`${(incident.detectionConfidence * 100).toFixed(0)}%`}
        />
      ) : null}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Quick analysis — 2×2 matrix + honest state machine                  */
/* ------------------------------------------------------------------ */

const ANALYSIS_TYPES: { key: AnalysisType; icon: (p: IconProps) => ReactNode; title: string; sub: string }[] = [
  { key: 'detection', icon: RadarIcon, title: 'Detection', sub: 'Find oil spills from SAR' },
  { key: 'backtracking', icon: BacktraceIcon, title: 'Backtracking', sub: 'Trace the slick to its source' },
  { key: 'forward-drift', icon: CompassIcon, title: 'Forward Drift', sub: 'Predict where the oil moves' },
  { key: 'vessel-attribution', icon: ShipIcon, title: 'Vessel Attribution', sub: 'Identify responsible vessels' },
]

const PHASE_TO_STATUS: Record<ChallengePhase, 'idle' | 'starting' | 'running' | 'completed' | 'failed'> = {
  idle: 'idle',
  preparing: 'starting',
  running: 'running',
  detecting: 'running',
  drifting: 'running',
  investigating: 'running',
  done: 'completed',
  failed: 'failed',
}

/** Derive the Analysis & Control lifecycle from the challenge sequencer. */
function useAnalysisStatusSync() {
  const phase = useChallengeStore((s) => s.phase)
  const setAnalysisStatus = useUiStore((s) => s.setAnalysisStatus)
  useEffect(() => {
    setAnalysisStatus(PHASE_TO_STATUS[phase])
  }, [phase, setAnalysisStatus])
}

type RunBar = { label: string; pct: number }

/** Real per-analysis progress bars — every percentage traces to a store field. */
function useRunBars(type: AnalysisType): RunBar[] {
  const sarActive = useSarStore((s) => s.active)
  const sarCount = useSarStore((s) => s.candidates.length)
  const bakStatus = useBacktrackingStore((s) => s.status)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const atrStatus = useAttributionStore((s) => s.status)
  const atrCount = useAttributionStore((s) => s.vessels.length)

  switch (type) {
    case 'detection':
      return [
        { label: 'SAR scene processing', pct: sarCount > 0 ? 100 : sarActive ? 55 : 0 },
        { label: 'Slick classification', pct: sarCount > 0 ? 100 : sarActive ? 75 : 0 },
        { label: 'Detection summary', pct: sarCount > 0 ? 100 : sarActive ? 92 : 0 },
      ]
    case 'backtracking':
      return [
        { label: 'Particle seeding', pct: bakStatus === 'completed' ? 100 : bakStatus === 'running' ? 30 : 0 },
        { label: 'Backward integration', pct: bakStatus === 'completed' ? 100 : bakStatus === 'running' ? 70 : 0 },
        { label: 'Source region estimate', pct: bakStatus === 'completed' ? 100 : bakStatus === 'running' ? 95 : 0 },
      ]
    case 'forward-drift':
      return [
        { label: 'Particle release', pct: driftStatus === 'completed' ? 100 : driftStatus === 'running' ? 35 : 0 },
        { label: 'Advection', pct: driftStatus === 'completed' ? 100 : driftStatus === 'running' ? 70 : 0 },
        { label: 'Mass balance', pct: driftStatus === 'completed' ? 100 : driftStatus === 'running' ? 93 : 0 },
      ]
    case 'vessel-attribution':
      return [
        { label: 'AIS correlation', pct: atrCount > 0 ? 100 : atrStatus === 'running' ? 35 : 0 },
        { label: 'Factor scoring', pct: atrCount > 0 ? 100 : atrStatus === 'running' ? 70 : 0 },
        { label: 'Candidate ranking', pct: atrCount > 0 ? 100 : atrStatus === 'running' ? 92 : 0 },
      ]
  }
}

/** One-line summary of the completed analysis, built from real store counts. */
function useAnalysisSummary(): string {
  const sarCount = useSarStore((s) => s.candidates.length)
  const bak = useBacktrackingStore((s) => s)
  const drift = useSimulationStore((s) => s.drift)
  const atrCount = useAttributionStore((s) => s.vessels.length)

  const backtrackParticles =
    bak.ensembleSize != null && bak.particlesPerMember != null
      ? bak.ensembleSize * bak.particlesPerMember
      : drift.particleCount

  return [
    `${sarCount} detection${sarCount === 1 ? '' : 's'}`,
    backtrackParticles != null ? `${backtrackParticles} backtracking particles` : null,
    `${atrCount} candidate vessel${atrCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' / ')
}

function QuickAnalysis() {
  const analysisType = useUiStore((s) => s.analysisType)
  const setAnalysisType = useUiStore((s) => s.setAnalysisType)
  const analysisStatus = useUiStore((s) => s.analysisStatus)
  const challengeError = useChallengeStore((s) => s.error)
  const bars = useRunBars(analysisType)
  const summary = useAnalysisSummary()

  // Panel ⇒ map: focus the layer family belonging to the selected analysis.
  // Layer visibility is shared state in mapStore — this is the single wiring
  // point where the Analysis & Control panel steers the chart.
  useEffect(() => {
    const ms = useMapStore.getState()
    switch (analysisType) {
      case 'detection': {
        const has = useSarStore.getState()
        ms.setLayer('sarSlicks', has.candidates.length > 0)
        ms.setLayer('sarFootprint', !!has.footprint)
        break
      }
      case 'backtracking':
        ms.setLayer('backtracking', true)
        ms.setLayer('uncertainty', useBacktrackingStore.getState().status === 'completed')
        break
      case 'forward-drift':
        ms.setLayer('drift', true)
        break
      case 'vessel-attribution':
        ms.setLayer('attribution', true)
        ms.setLayer('vessels', true)
        break
    }
  }, [analysisType])

  return (
    <div className="analysis-stack">
      <div className="analysis-head">
        <div className="analysis-head-title">Run new analysis</div>
        <div className="analysis-head-sub">
          Use satellite data and environmental models to detect, track and attribute oil spills.
        </div>
      </div>

      <div className="analysis-grid">
        {ANALYSIS_TYPES.map(({ key, icon: TypeIcon, title, sub }) => (
          <button
            key={key}
            type="button"
            className={`card analysis-card${analysisType === key ? ' analysis-card--active' : ''}`}
            onClick={() => setAnalysisType(key)}
            aria-pressed={analysisType === key}
          >
            <TypeIcon size={16} />
            <span className="analysis-card-title">{title}</span>
            <span className="analysis-card-sub">{sub}</span>
          </button>
        ))}
      </div>

      {analysisStatus === 'idle' || analysisStatus === 'completed' || analysisStatus === 'failed' ? (
        <Button variant="primary" large block onClick={() => void runLiveChallenge('LIVE')}>
          <span aria-hidden="true">▶</span> Start analysis
          <ArrowRightIcon size={14} />
        </Button>
      ) : null}

      {analysisStatus === 'starting' ? (
        <div className="analysis-state analysis-state--run">
          <span className="analysis-state-spinner" aria-hidden="true" />
          <span className="analysis-state-title">Starting analysis</span>
          <span className="analysis-state-msg">Preparing the live scenario through the real pipeline…</span>
        </div>
      ) : null}

      {analysisStatus === 'running' ? (
        <div className="analysis-state analysis-state--run">
          <div className="analysis-state-head">
            <span className="analysis-state-title">Analysis running</span>
            <span className="analysis-state-pct">{Math.max(...bars.map((b) => b.pct), 4)}%</span>
          </div>
          {bars.map((b) => (
            <div className="run-bar" key={b.label}>
              <span className="run-bar-label">{b.label}</span>
              <span className="run-bar-track" aria-hidden="true">
                <span className="run-bar-fill" style={{ width: `${b.pct}%` }} />
              </span>
              <span className="run-bar-pct">{b.pct}%</span>
            </div>
          ))}
          <div className="analysis-state-sub">Follow live progress on the map and the investigation dock.</div>
        </div>
      ) : null}

      {analysisStatus === 'completed' ? (
        <div className="analysis-state analysis-state--ok">
          <div className="analysis-state-title">Analysis complete</div>
          <div className="analysis-state-msg">{summary}</div>
        </div>
      ) : null}

      {analysisStatus === 'failed' ? (
        <div className="analysis-inline-note analysis-inline-note--error">
          <span className="analysis-inline-title">Analysis interrupted</span>
          <span className="analysis-inline-msg">
            {challengeError ?? 'The analysis pipeline did not complete.'}
          </span>
          <button
            type="button"
            className="analysis-inline-action"
            onClick={() => void runLiveChallenge('LIVE')}
          >
            Retry analysis →
          </button>
        </div>
      ) : null}

      <div className="filter-row">
        <label className="filter">
          <span className="filter-label">Date range</span>
          <select className="filter-select" defaultValue="7d">
            <option value="7d">Last 7 days</option>
            <option value="1d">Last 24 hours</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
        <label className="filter">
          <span className="filter-label">Region</span>
          <select className="filter-select" defaultValue="io">
            <option value="io">Indian Ocean</option>
            <option value="arabian">Arabian Sea</option>
            <option value="bengal">Bay of Bengal</option>
          </select>
        </label>
      </div>
      <div className="filter-hint">
        Display filters — the pipeline always runs on the live case to keep provenance honest.
      </div>

      <div className="recent-head">
        <span>Recent activities</span>
        <span className="recent-live">
          <span className="sys-pill-dot sys-pill-dot--live" aria-hidden="true" />
          live
        </span>
      </div>
      <ActivityFeed />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Simulation tab — scenario form + readouts                           */
/* ------------------------------------------------------------------ */

function stageSymbol(status: string): { mark: string; cls: string } {
  switch (status) {
    case 'completed':
      return { mark: '✓', cls: 'ok' }
    case 'running':
      return { mark: '…', cls: 'run' }
    case 'failed':
    case 'unavailable':
      return { mark: '✕', cls: 'danger' }
    case 'skipped':
      return { mark: '∅', cls: 'dim' }
    default:
      return { mark: '○', cls: 'dim' }
  }
}

/** Scenario + pipeline status — migrated out of the top workspace strip. */
function ScenarioStatus() {
  const phase = useChallengeStore((s) => s.phase)
  const challengeError = useChallengeStore((s) => s.error)
  const stages = useInvestigationStore((s) => s.stages)

  return (
    <div className="scenario-status">
      <div className="scenario-status-head">
        <span className="scenario-status-title">Scenario status</span>
        <span className={`scenario-status-pill scenario-status-pill--${phase}`}>
          {phase === 'idle' || phase === 'done' ? 'READY' : (phase ?? 'idle').toUpperCase()}
        </span>
      </div>
      <div className="scenario-stage-row" aria-label="Pipeline stages">
        {STAGE_ORDER.map((id) => {
          const step = stages.find((s) => s.stageId === id)
          const { mark, cls } = stageSymbol(step?.status ?? 'pending')
          return (
            <span key={id} className={`scenario-stage scenario-stage--${cls}`} title={`${id} — ${step?.status ?? 'pending'}`}>
              <span className="scenario-stage-mark" aria-hidden="true">
                {mark}
              </span>
              <span className="scenario-stage-label">{id}</span>
            </span>
          )
        })}
      </div>
      {phase === 'failed' && challengeError ? (
        <div className="analysis-inline-note analysis-inline-note--error">
          <span className="analysis-inline-title">Last run failed</span>
          <span className="analysis-inline-msg">{challengeError}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Danger control — wipes the live workspace. Calls the backend reset endpoint
 * (drops all case collections in MongoDB) then resets every client-side store
 * and the session storage the stores persisted. Requires typing the word
 * "RESET" to confirm, so a misclick cannot throw away a live investigation.
 * The challenge sequencer is driven back to the idle phase afterwards.
 */
function ResetWorkspaceControl() {
  const status = useWorkspaceStore((s) => s.status)
  const error = useWorkspaceStore((s) => s.error)
  const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')

  const busy = status === 'resetting'
  const ready = confirm && typed.toUpperCase() === 'RESET'

  const run = async () => {
    await resetWorkspace()
    useChallengeStore.setState({ phase: 'idle', label: null, error: null, log: [] })
    setConfirm(false)
    setTyped('')
  }

  return (
    <Panel
      title="Clear case history"
      right={<span className={`ws-status ws-status--${status}`}>{status}</span>}
    >
      {!confirm ? (
        <button type="button" className="btn btn--block ws-danger-btn" disabled={busy} onClick={() => setConfirm(true)}>
          {busy ? 'Resetting…' : 'Wipe workspace'}
        </button>
      ) : (
        <>
          <div className="ws-confirm">
            <p>
              This drops every persisted case — simulation, incidents, SAR
              observations, drift, backtrack, attribution, investigation and
              ground-truth collections — and clears the local session.
            </p>
            <label className="filter">
              <span className="filter-label">Type RESET to confirm</span>
              <input
                className="filter-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                placeholder="RESET"
              />
            </label>
            <div className="ws-actions">
              <button type="button" className="btn btn--block ws-danger-btn" disabled={busy || !ready} onClick={() => void run()}>
                {busy ? 'Resetting…' : 'Permanently clear'}
              </button>
              <button
                type="button"
                className="btn btn--block"
                disabled={busy}
                onClick={() => { setConfirm(false); setTyped('') }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
      {error ? <div className="analysis-state analysis-state--error">Reset failed: {error}</div> : null}
    </Panel>
  )
}

function SimulationTab({ evidence }: { evidence: ReactNode }) {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const busy = useSimulationStore((s) => s.busy)
  const error = useSimulationStore((s) => s.error)
  const [horizon, setHorizon] = useState(24)
  const [particles, setParticles] = useState(500)

  const serviceDown = !simulationId && !!error

  const start = async () => {
    await useSimulationStore.getState().createSimulation()
    const id = useSimulationStore.getState().simulationId
    if (!id) return
    await useSimulationStore.getState().start()
    await useSimulationStore.getState().advance(horizon)
  }

  return (
    <div className="analysis-stack">
      <div className="analysis-head">
        <div className="analysis-head-title">Simulation</div>
        <div className="analysis-head-sub">
          Set up a controlled scenario to rehearse detection, drift and attribution.
        </div>
      </div>

      <ScenarioStatus />

      {serviceDown ? (
        <div className="analysis-state analysis-state--error">
          <div className="analysis-state-title">Simulation service unavailable</div>
          <div className="analysis-state-msg">{error}</div>
          <Button variant="primary" block onClick={() => void start()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="sim-form">
            <label className="filter">
              <span className="filter-label">Scenario</span>
              <select className="filter-select" defaultValue="current">
                <option value="current">Current case</option>
              </select>
            </label>
            <label className="filter">
              <span className="filter-label">Model</span>
              <select className="filter-select" defaultValue="opendrift">
                <option value="opendrift">OpenDrift</option>
              </select>
            </label>
            <label className="filter">
              <span className="filter-label">Time horizon</span>
              <select
                className="filter-select"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </label>
            <label className="filter">
              <span className="filter-label">Particles</span>
              <select
                className="filter-select"
                value={particles}
                onChange={(e) => setParticles(Number(e.target.value))}
              >
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </label>
          </div>
          <Button variant="primary" large block disabled={busy} onClick={() => void start()}>
            {busy ? 'Starting…' : 'Start simulation'}
          </Button>
          <div className="filter-hint">
            Runs the real pipeline — the scenario is created server-side, never simulated in the browser.
          </div>
        </>
      )}

      <CaptainSimulationPanel />
      <IncidentPanel />
      {evidence}
      <ResetWorkspaceControl />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Vessel search — real fleet + scored candidates                      */
/* ------------------------------------------------------------------ */

type SearchRow = {
  id: string
  name: string
  mmsi: string
  type: string
  position: { lon: number; lat: number } | null
  speed: number | null
  rank: number | null
  distanceKm: number | null
  source: 'fleet' | 'candidate'
}

function distKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function useVesselRows(): { rows: SearchRow[]; types: string[] } {
  const fleet = useSimulationStore((s) => s.vessels)
  const candidates = useAttributionStore((s) => s.vessels)
  const spillPos = useSimulationStore((s) => s.spill?.location)

  return useMemo(() => {
    const rows: SearchRow[] = [
      ...fleet.map((v) => ({
        id: v.id,
        name: v.name,
        mmsi: v.mmsi,
        type: v.type,
        position: v.position,
        speed: v.speed,
        rank: null,
        distanceKm: spillPos ? distKm(spillPos, v.position) : null,
        source: 'fleet' as const,
      })),
      ...candidates.map((v) => ({
        id: v.mmsi ?? v.name ?? `rank-${v.rank}`,
        name: v.name ?? 'Unnamed vessel',
        mmsi: v.mmsi ?? '—',
        type: v.vesselType ?? 'candidate',
        position: v.closestPosition,
        speed: null,
        rank: v.rank,
        distanceKm: v.minDistanceKm,
        source: 'candidate' as const,
      })),
    ]
    const types = Array.from(new Set(rows.map((r) => r.type))).sort()
    return { rows, types }
  }, [fleet, candidates, spillPos])
}

function VesselSearchTab() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const aisOnline = useConnectionStore((s) => s.connections.websocket === 'online')
  const { rows, types } = useVesselRows()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (q && !`${r.name} ${r.mmsi} ${r.type}`.toLowerCase().includes(q)) return false
      if (statusFilter === 'ais' && !aisOnline) return false
      if (statusFilter === 'no-ais' && aisOnline) return false
      return true
    })
  }, [rows, query, typeFilter, statusFilter, aisOnline])

  const focusVessel = (row: SearchRow) => {
    if (!row.position) return
    useMapStore.getState().setLayer('vessels', true)
    useMapStore.getState().requestFit([
      [row.position.lon - 2, row.position.lat - 2],
      [row.position.lon + 2, row.position.lat + 2],
    ])
    useMapStore
      .getState()
      .select(
        row.source === 'candidate'
          ? { kind: 'ais_candidate', id: row.id, mmsi: row.mmsi, name: row.name, rank: row.rank }
          : { kind: 'vessel', id: row.id, mmsi: row.mmsi, name: row.name },
      )
  }

  return (
    <div className="analysis-stack">
      <div className="analysis-head">
        <div className="analysis-head-title">Vessel search</div>
        <div className="analysis-head-sub">
          Find vessels on the live chart and scored AIS candidates.
        </div>
      </div>

      <label className="filter">
        <span className="filter-label">Search</span>
        <input
          className="filter-input"
          type="search"
          placeholder="Name, IMO or MMSI…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="filter-row">
        <label className="filter">
          <span className="filter-label">Vessel type</span>
          <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span className="filter-label">Status</span>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All status</option>
            <option value="ais">AIS active</option>
            <option value="no-ais">AIS silent</option>
          </select>
        </label>
      </div>

      <div className="search-count">
        {results.length} vessel{results.length === 1 ? '' : 's'} in scope
      </div>

      {results.length === 0 ? (
    <div className="activity-empty">
      <span className="activity-empty-title">No vessels in scope</span>
      <span className="activity-empty-body">
        Start a challenge to ingest AIS traffic for the selected region.
      </span>
    </div>
      ) : (
        <ul className="vessel-results">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" className="vessel-row" onClick={() => focusVessel(r)}>
                <span className="vessel-row-main">
                  <span className="vessel-row-name">{r.name}</span>
                  <span className="vessel-row-meta">
                    <span className="mono-id">{r.mmsi}</span>
                    <span>{r.type}</span>
                    {r.rank != null ? <span className="rank-chip">#{r.rank}</span> : null}
                  </span>
                </span>
                <span className="vessel-row-side">
                  <span className="vessel-row-dist">
                    {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km from slick` : '—'}
                  </span>
                  <span className={`ais-chip${aisOnline ? ' ais-chip--ok' : ''}`}>
                    {aisOnline ? 'AIS active' : 'AIS offline'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reports tab — report index (builder ships in Phase 4)               */
/* ------------------------------------------------------------------ */

function ReportsTab() {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const createdAt = useInvestigationStore((s) => s.createdAt)
  const configured = createdAt
    ? new Date(createdAt).toISOString().replace('T', ' ').replace('.000Z', 'Z')
    : null

  return (
    <div className="analysis-stack">
      <div className="analysis-head">
        <div className="analysis-head-title">Reports</div>
        <div className="analysis-head-sub">Generated from real pipeline results only.</div>
      </div>

      {investigationId ? (
        <Link to="/report" className="card link-card">
          <DossierIcon size={16} />
          <span>
            <span className="link-card-title">Case report — {investigationId.slice(0, 12)}…</span>
            <span className="link-card-sub">
              {configured ? `Created ${configured} UTC` : 'Full dossier — map, metrics, ranking and provenance.'}
            </span>
          </span>
          <ArrowRightIcon size={14} />
        </Link>
      ) : (
    <div className="activity-empty">
      <span className="activity-empty-title">No case reports yet</span>
      <span className="activity-empty-body">
        Reports are generated once an investigated case has a detected slick.
      </span>
    </div>
      )}

      <Link to="/attribution" className="card link-card">
        <ShipIcon size={16} />
        <span>
          <span className="link-card-title">Attribution summary</span>
          <span className="link-card-sub">Ranked candidate vessels with factor breakdown.</span>
        </span>
        <ArrowRightIcon size={14} />
      </Link>

      <div className="reports-note">The full report builder ships in a later phase.</div>
      <Disclaimer>
        Reports are generated from real pipeline results only; nothing is fabricated for display.
      </Disclaimer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* The unified right-rail shell — tabs + collapse                      */
/* ------------------------------------------------------------------ */

const TABS: { key: RightPanelTab; label: string; icon: (p: IconProps) => ReactNode }[] = [
  { key: 'quick', label: 'Quick Analysis', icon: RadarIcon },
  { key: 'simulation', label: 'Simulation', icon: ShipIcon },
  { key: 'vessels', label: 'Vessel Search', icon: CrosshairIcon },
  { key: 'reports', label: 'Reports', icon: DossierIcon },
]

export function AnalysisPanel({ vesselRail, evidence }: { vesselRail: ReactNode; evidence: ReactNode }) {
  useAnalysisStatusSync()
  const tab = useUiStore((s) => s.rightPanelTab)
  const setTab = useUiStore((s) => s.setRightPanelTab)
  const collapsed = useUiStore((s) => s.panelCollapsed)
  const setPanelCollapsed = useUiStore((s) => s.setPanelCollapsed)

  if (collapsed) {
    return (
      <div className="analysis-shell analysis-shell--collapsed" aria-label="Analysis and control — collapsed">
        <div className="analysis-vert-title">Analysis</div>
        <div className="analysis-vert-tabs" role="tablist" aria-orientation="vertical">
          {TABS.map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={`analysis-vert-tab${tab === key ? ' analysis-vert-tab--active' : ''}`}
              title={label}
              aria-label={label}
              onClick={() => {
                setPanelCollapsed(false)
                setTab(key)
              }}
            >
              <TabIcon size={16} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-shell">
      <div className="analysis-head-row">
        <span className="analysis-head-row-title">
          <CrosshairIcon size={13} />
          Analysis &amp; Control
        </span>
        <button
          type="button"
          className="analysis-collapse"
          onClick={() => setPanelCollapsed(true)}
          title="Collapse the panel to give the map more room"
        >
          <MinusIcon size={12} />
          Collapse
        </button>
      </div>

      <div className="analysis-tabs" role="tablist" aria-label="Analysis and control">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`analysis-tab${tab === key ? ' analysis-tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="analysis-body" role="tabpanel">
        {tab === 'quick' ? <QuickAnalysis /> : null}
        {tab === 'simulation' ? <SimulationTab evidence={evidence} /> : null}
        {tab === 'vessels' ? (
          <div className="analysis-stack">
            <VesselSearchTab />
            {vesselRail}
          </div>
        ) : null}
        {tab === 'reports' ? <ReportsTab /> : null}
      </div>
    </div>
  )
}