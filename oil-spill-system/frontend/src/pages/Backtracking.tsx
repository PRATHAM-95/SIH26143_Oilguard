import { useEffect } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { MapLayersPanel } from '@/components/ui/MapLayersPanel'
import { ProvenancePill } from '@/components/ui/primitives'
import { MissionWorkspace } from '@/components/workspace/MissionWorkspace'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { OverviewIntel } from '@/components/intel/IntelPanel'
import { BacktraceIcon } from '@/components/ui/Icon'
import { useBacktrackingStore } from '@/store/featureStores'
import { useSimulationStore } from '@/store/simulationStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useBacktrackingLayers } from '@/components/backtracking/BacktrackingMap'

function formatLatLng(loc: { lon: number; lat: number }): string {
  return `${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°`
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace('.000Z', 'Z')
}

function ConcentrationBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  const cls = level === 'HIGH' ? 'ok' : level === 'MEDIUM' ? 'warn' : 'warn'
  return <span className={`status-chip status-chip--${cls}`}>{level ?? '—'}</span>
}

function ProvenancePanel() {
  const environmentSource = useBacktrackingStore((s) => s.environmentSource)
  const status = useBacktrackingStore((s) => s.status)
  return (
    <Panel title="Provenance">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="field-label">Forcing source</span>
          <ProvenancePill value={environmentSource ?? 'CONTROLLED'} />
        </div>
        <KeyValue
          label="Data state"
          value={
            status === 'completed'
              ? environmentSource === 'CONTROLLED'
                ? 'Controlled / synthetic (no real forcing credentials)'
                : 'Real environmental forcing'
              : 'Awaiting run'
          }
        />
        <div className="text-faint" style={{ fontSize: '10.5px' }}>
          {environmentSource === 'CONTROLLED'
            ? 'Result derived from deterministic controlled forcing, not real currents/wind.'
            : 'Result derived from real environmental forcing.'}
        </div>
      </div>
    </Panel>
  )
}

function SourcePanel() {
  const origin = useBacktrackingStore((s) => s.origin)
  const uncertaintyKm = useBacktrackingStore((s) => s.uncertaintyKm)
  const sourceConcentration = useBacktrackingStore((s) => s.sourceConcentration)
  const environmentalQuality = useBacktrackingStore((s) => s.environmentalQuality)
  const trajectoryAgreement = useBacktrackingStore((s) => s.trajectoryAgreement)
  const ensembleStability = useBacktrackingStore((s) => s.ensembleStability)
  const status = useBacktrackingStore((s) => s.status)

  if (status !== 'completed' || origin === null) {
    return (
      <Panel title="Source Estimation">
        <EmptyState
          label="Awaiting backtracking"
          hint="Run the backtracking to estimate the probable source region."
        />
      </Panel>
    )
  }

  return (
    <Panel title="Probable Source Region">
      <div className="stack">
        <KeyValue label="Origin estimate" value={formatLatLng(origin)} />
        <KeyValue
          label="Uncertainty"
          value={uncertaintyKm != null ? `± ${uncertaintyKm.toFixed(1)} km` : '—'}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="text-dim">Source concentration</span>
          <ConcentrationBadge level={sourceConcentration} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="text-dim">Forcing quality</span>
          <ConcentrationBadge level={environmentalQuality} />
        </div>
        <KeyValue
          label="Trajectory agreement"
          value={trajectoryAgreement != null ? `${(trajectoryAgreement * 100).toFixed(0)}%` : '—'}
        />
        <KeyValue
          label="Ensemble stability"
          value={ensembleStability != null ? ensembleStability.toFixed(2) : '—'}
        />
      </div>
    </Panel>
  )
}

function SourceWindowPanel() {
  const originTimeRange = useBacktrackingStore((s) => s.originTimeRange)
  const status = useBacktrackingStore((s) => s.status)

  if (status !== 'completed' || !originTimeRange) {
    return (
      <Panel title="Source Time Window">
        <EmptyState label="No estimate" hint="Awaiting source window." />
      </Panel>
    )
  }

  return (
    <Panel title="Source Time Window">
      <div className="stack">
        <KeyValue label="Earliest" value={formatTime(originTimeRange.earliest)} />
        <KeyValue label="Preferred" value={formatTime(originTimeRange.preferred)} />
        <KeyValue label="Latest" value={formatTime(originTimeRange.latest)} />
        <div className="text-faint" style={{ fontSize: '10.5px' }}>
          The source event is bounded within this window; a single exact time is
          not claimed.
        </div>
      </div>
    </Panel>
  )
}

function Timeline() {
  const status = useBacktrackingStore((s) => s.status)
  const durationHours = useBacktrackingStore((s) => s.durationHours)
  const duration = durationHours ?? 6

  const ticks = []
  const steps: number[] = duration <= 1 ? [0, 1] : [0, Math.ceil(duration / 4), Math.ceil(duration / 2), Math.ceil((3 * duration) / 4), duration]
  for (const t of steps) {
    ticks.push({ label: `T-${t}h`, isEnd: t >= duration })
  }

  return (
    <Panel title="Timeline">
      <div className="stack">
        <div className="timeline" aria-label="Backtracking timeline">
          <span className="timeline-tick">Observation</span>
          {ticks.map((t, i) => (
            <span
              key={i}
              className={`timeline-tick${t.isEnd ? ' timeline-tick--end' : ''}`}
            >
              {t.label}
            </span>
          ))}
          <span className="timeline-tick timeline-tick--end">Source window</span>
        </div>
        <div className="text-faint" style={{ fontSize: '10.5px' }}>
          Reverse-trajectory from the observed slick ({duration} h backward).
        </div>
        <div className="text-faint" style={{ fontSize: '10.5px' }}>
          {status === 'running' ? 'Computing ensemble backward trajectories…' : 'Ensemble backward advection.'}
        </div>
      </div>
    </Panel>
  )
}

function EnsemblePanel() {
  const ensembleSummary = useBacktrackingStore((s) => s.ensembleSummary)
  const ensembleSize = useBacktrackingStore((s) => s.ensembleSize)
  const particlesPerMember = useBacktrackingStore((s) => s.particlesPerMember)
  const quality = useBacktrackingStore((s) => s.quality)
  const status = useBacktrackingStore((s) => s.status)

  return (
    <Panel title="Ensemble">
      <div className="stack">
        {status === 'completed' && ensembleSummary ? (
          <>
            <KeyValue label="Members" value={String(ensembleSummary.member_count ?? ensembleSize ?? '—')} />
            <KeyValue label="Converged" value={String(ensembleSummary.converged_count ?? '—')} />
            <KeyValue
              label="Mean distance"
              value={
                ensembleSummary.mean_endpoint_distance_km != null
                  ? `${ensembleSummary.mean_endpoint_distance_km.toFixed(1)} km`
                  : '—'
              }
            />
            <KeyValue label="Particles/member" value={particlesPerMember != null ? String(particlesPerMember) : '—'} />
            {quality && (
              <KeyValue
                label="Invalid / land / domain"
                value={`${quality.invalid_particles} / ${quality.land_hits} / ${quality.domain_exits}`}
              />
            )}
          </>
        ) : (
          <EmptyState label="No ensemble" hint="Run backtracking to populate." />
        )}
      </div>
    </Panel>
  )
}

function EvidencePanel() {
  const status = useBacktrackingStore((s) => s.status)
  const sourceConcentration = useBacktrackingStore((s) => s.sourceConcentration)
  const trajectoryAgreement = useBacktrackingStore((s) => s.trajectoryAgreement)
  const uncertainties = useBacktrackingStore((s) => s.uncertaintyKm)
  const warnings = useBacktrackingStore((s) => s.warnings)

  if (status !== 'completed') {
    return (
      <Panel title="Evidence Basis">
        <EmptyState label="No evidence" hint="Computed values appear after a run." />
      </Panel>
    )
  }

  const points: string[] = []
  points.push(
    sourceConcentration === 'HIGH'
      ? 'Endpoints are tightly concentrated (high trajectory convergence).'
      : sourceConcentration === 'MEDIUM'
        ? 'Endpoints are moderately concentrated.'
        : 'Endpoints are widely dispersed — the source region is weakly constrained.',
  )
  if (trajectoryAgreement != null) {
    points.push(
      `${(trajectoryAgreement * 100).toFixed(0)}% of endpoints fall within the 90% contour.`,
    )
  }
  if (uncertainties != null) {
    points.push(`Uncertainty radius ±${uncertainties.toFixed(1)} km (2σ endpoint spread).`)
  }

  return (
    <Panel title="Why This Region Is Probable">
      <div className="stack">
        {points.map((p, i) => (
          <div key={i} className="text-dim" style={{ fontSize: '11px', lineHeight: 1.4 }}>
            • {p}
          </div>
        ))}
        {warnings.length > 0 && (
          <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.35 }}>
            {warnings.slice(0, 3).join(' ')}
          </div>
        )}
      </div>
    </Panel>
  )
}

function Toolbar() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const status = useBacktrackingStore((s) => s.status)
  const busy = useBacktrackingStore((s) => s.busy)
  const clear = useBacktrackingStore((s) => s.clear)
  const hasResult = useBacktrackingStore((s) => s.status === 'completed')
  const running = busy || status === 'running'

  return (
    <div className="toolbar-title">
      <span className="toolbar-title-label">
        <BacktraceIcon size={14} /> Source Estimation
      </span>
      <span className="text-faint">
        Reverse-ensemble from the observed slick to a probable source window.
      </span>
      <div className="toolbar-spacer" />
      <Button
        variant="primary"
        disabled={!simulationId || running}
        onClick={() => {
          if (!simulationId) return
          void useBacktrackingStore.getState().run(simulationId)
        }}
      >
        {running ? 'Backtracking…' : 'Run backtracking'}
      </Button>
      {hasResult ? (
        <Button disabled={running} onClick={clear}>
          Clear estimate
        </Button>
      ) : null}
    </div>
  )
}

export default function Backtracking() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const btStatus = useBacktrackingStore((s) => s.status)
  const hasSelection = useMapStore((s) => s.selection != null)
  useSimulationConnection(simulationId)
  const btLayers = useBacktrackingLayers()

  const setLayer = useMapStore((s) => s.setLayer)
  const btCompleted = btStatus === 'completed'
  useEffect(() => {
    if (btStatus === 'completed') {
      setLayer('backtracking', true)
      setLayer('sourceProbability', true)
      setLayer('uncertainty', true)
    }
  }, [btStatus, setLayer])

  useEffect(() => {
    return () => {
      setLayer('backtracking', false)
      setLayer('sourceProbability', false)
      setLayer('uncertainty', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const available: MapLayerId[] = btCompleted
    ? ['backtracking', 'sourceProbability', 'uncertainty']
    : []

  return (
    <MissionWorkspace
      toolbar={<Toolbar />}
      map={
        <div className="map-pane">
          <MapView layers={btLayers} onSelect={(s) => useMapStore.getState().select(s)}>
            <MapFurniture />
          </MapView>
          <MapLayersPanel available={available} />
          <div className="map-note">
            Endpoints cluster on the probable source region. Click the origin or region to inspect its bounds.
          </div>
        </div>
      }
      rail={
        <div className="rail-stack-inner">
          {hasSelection ? <ContextualPanel /> : <OverviewIntel />}
          <SourcePanel />
          <SourceWindowPanel />
          <Timeline />
          <EnsemblePanel />
          <EvidencePanel />
          <ProvenancePanel />
        </div>
      }
    />
  )
}