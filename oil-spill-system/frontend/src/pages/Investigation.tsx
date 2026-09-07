import { useEffect } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { MapLayersPanel } from '@/components/ui/MapLayersPanel'
import { RankBadge, ScoreBar, ProvenancePill, Disclaimer } from '@/components/ui/primitives'
import { MissionWorkspace } from '@/components/workspace/MissionWorkspace'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { OverviewIntel } from '@/components/intel/IntelPanel'
import { useSelectionRingLayers } from '@/components/workspace/selection'
import {
  InvestigationStepper,
  InvestigationControls,
  EvidenceChain,
  AutoEnableLayers,
} from '@/components/investigation/Stepper'
import { InvestigationTimeline } from '@/components/investigation/InvestigationTimeline'
import { InvestigationPipeline } from '@/components/investigation/Pipeline'
import { SarObservationPanel, useSarLayers, useSarStore } from '@/components/investigation/SarObservation'
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import {
  useInvestigationMapLayers,
  stageRankedVessels,
} from '@/components/map/InvestigationMap'
import {
  STAGE_LABEL,
  STAGE_ORDER,
  useInvestigationStore,
} from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'
import type { InvestigationStageId, InvestigationStageState } from '@/types/domain'

function StageDetail() {
  const stages = useInvestigationStore((s) => s.stages)
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)

  const ordered = STAGE_ORDER.map((id) => stages.find((s) => s.stageId === id)).filter(
    (s): s is InvestigationStageState => s != null,
  )

  return (
    <Panel title="Stage ledger" flush>
      <div className="stack" style={{ maxHeight: 420, overflowY: 'auto' }}>
        {ordered.map((stage) => (
          <StageRow
            key={stage.stageId}
            stage={stage}
            focused={focusedStageId === stage.stageId}
          />
        ))}
        {stages.length === 0 ? (
          <div style={{ padding: 8 }}>
            <EmptyState label="No stages yet" hint="Start the investigation to fill the ledger." />
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

function StageRow({ stage, focused }: { stage: InvestigationStageState; focused: boolean }) {
  const summary = stage.summary ?? {}
  const detail =
    stage.modelVersion ??
    (stage.referenceId ? `${stage.referenceType} · ${stage.referenceId}` : null)

  return (
    <div
      className={`kv${focused ? ' kv--focused' : ''}`}
      data-stage={stage.stageId}
      style={focused ? { background: 'var(--panel-3, #12283a)', boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}
    >
      <span className="kv-label" style={{ textTransform: 'capitalize' }}>
        {STAGE_LABEL[stage.stageId] ?? stage.stageId}
      </span>
      <span className="kv-value">
        <span className={`pill pill--${stage.status}`}>{stage.status}</span>
        {stage.attemptCount > 1 ? <span className="text-faint"> · {stage.attemptCount} attempts</span> : null}
        {stage.error ? <div className="text-danger">{stage.error}</div> : null}
        {summary && Object.keys(summary).length > 0 ? (
          <div className="text-faint" style={{ fontSize: '10.5px', marginTop: 2 }}>
            {detail ?? Object.keys(summary).slice(0, 4).join(', ')}
          </div>
        ) : null}
      </span>
    </div>
  )
}

function CandidateRanking() {
  const stages = useInvestigationStore((s) => s.stages)
  const ranked = stageRankedVessels(stages)

  if (ranked.length === 0) return null

  return (
    <Panel title="Candidate ranking" flush>
      <div className="stack" style={{ padding: 8, gap: 6 }}>
        {ranked.map((c) => (
          <div key={c.rank} className="evidence-row">
            <RankBadge rank={c.rank} />
            <div style={{ flex: 1 }}>
              <div className="evidence-label">{c.name ?? 'Unnamed vessel'}</div>
              <ScoreBar
                label="Composite score"
                value={c.score}
                display={c.score != null ? `${(c.score * 100).toFixed(1)}%` : '—'}
              />
            </div>
          </div>
        ))}
        <Disclaimer>
          Ranked <strong>candidates</strong>, ordered by composite likelihood — a ranking is not a declaration of cause.
        </Disclaimer>
      </div>
    </Panel>
  )
}

function Result() {
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const status = useInvestigationStore((s) => s.status)
  const errors = useInvestigationStore((s) => s.errors)
  const warnings = useInvestigationStore((s) => s.warnings)
  const revealMetrics = useInvestigationStore((s) => s.reveal)
  const lastReveal = useInvestigationStore((s) => s.lastReveal)

  return (
    <Panel title="Conclusion" flush>
      {status !== 'COMPLETED' ? (
        <div style={{ padding: 8 }}>
          <EmptyState
            label={status === 'CREATED' || status === 'RUNNING' ? 'Investigation in progress' : 'No investigation yet'}
            hint={status === null ? 'Start an investigation to see the conclusion.' : undefined}
          />
        </div>
      ) : (
        <div className="stack" style={{ padding: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="field-label">Conclusion</span>
            <span className={`status-chip ${conclusion?.status === 'candidate' ? 'status-chip--ok' : 'status-chip--warn'}`}>
              {conclusion?.status ?? '—'}
            </span>
          </div>
          {conclusion?.candidate && typeof conclusion.candidate === 'object' ? (
            <KeyValue label="Highest-ranked candidate" value={String(conclusion.candidate.mmsi ?? conclusion.candidate.name ?? '—')} />
          ) : null}
          {conclusion?.topScore != null ? (
            <ScoreBar label="Top score" value={conclusion.topScore} display={`${(conclusion.topScore * 100).toFixed(1)}%`} />
          ) : null}
          {conclusion?.margin != null ? (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="field-label">Margin</span>
              <span className={conclusion.decisive === false ? 'text-warn' : 'text-dim'}>
                {(conclusion.margin * 100).toFixed(1)}%{conclusion.decisive === false ? ' · not decisive' : ''}
              </span>
            </div>
          ) : null}
          {conclusion?.aggregation ? (
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="field-label">Provenance</span>
              <ProvenancePill value={conclusion.aggregation} />
            </div>
          ) : null}
          {conclusion?.reason ? (
            <div className="text-faint" style={{ fontSize: '10.5px' }}>
              {conclusion.reason}
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="text-danger">
              {errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div className="text-faint">
              {warnings.map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          ) : null}
          {revealMetrics.revealed && lastReveal ? (
            <>
              <KeyValue
                label="Position error"
                value={`${lastReveal.positionError_km?.toFixed(2) ?? '—'} km`}
              />
              <KeyValue
                label="Time error"
                value={lastReveal.timeError_min != null ? `${lastReveal.timeError_min.toFixed(0)} min` : '—'}
              />
              <KeyValue
                label="Attribution correct"
                value={lastReveal.attributionCorrect ? 'yes' : 'no'}
              />
            </>
          ) : null}
        </div>
      )}
    </Panel>
  )
}

function ProvenancePanel() {
  const provenance = useInvestigationStore((s) => s.provenance)
  const params = useInvestigationStore((s) => s.params)

  return (
    <Panel title="Provenance & Parameters">
      <div className="stack">
        <KeyValue label="Aggregation" value={provenance?.aggregation ?? '—'} />
        <ProvenancePill value={provenance?.aggregation ?? null} />
        {provenance?.perStage
          ? Object.entries(provenance.perStage).map(([stageId, p]) => (
              <KeyValue key={stageId} label={STAGE_LABEL[stageId] ?? stageId} value={p} />
            ))
          : null}
        {params ? (
          <details>
            <summary className="text-faint">Runtime parameters</summary>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '10.5px' }}>
              <li>SAR: {params.sarSource} · {params.sarDetector}</li>
              <li>Backtrack ensemble: {params.backtrackEnsembleSize} × {params.backtrackParticlesPerMember} · {params.backtrackDurationHours}h</li>
              <li>Forward drift: {params.forwardDriftParticleCount} particles · {params.forwardDriftDurationHours}h</li>
              <li>Environment: {params.environmentSource}</li>
              <li>AIS: {params.aisSource} · r={params.radiusKm} km · gap={params.maxGapMin} min</li>
              <li>Seed: {params.seed}</li>
            </ul>
          </details>
        ) : null}
      </div>
    </Panel>
  )
}

function RetryStage({ stageId }: { stageId: InvestigationStageId }) {
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === stageId))
  const status = useInvestigationStore((s) => s.status)
  const busy = useInvestigationStore((s) => s.busy)
  const retry = useInvestigationStore((s) => s.retry)

  const retryable =
    status === 'FAILED' &&
    stage != null &&
    (stage.status === 'failed' || stage.status === 'skipped' || stage.status === 'unavailable')

  if (!retryable) return null
  return (
    <button
      type="button"
      className="link-btn"
      disabled={busy}
      onClick={() => void retry(stageId)}
    >
      Retry {STAGE_LABEL[stageId]}
    </button>
  )
}

export default function Investigation() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)
  const hasSelection = useMapStore((s) => s.selection != null)

  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  useEffect(() => {
    if (simulationId) void loadForSimulation(simulationId)
  }, [simulationId, loadForSimulation])

  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const ringLayers = useSelectionRingLayers()

  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const sar = useSarStore((s) => s)
  const stages = useInvestigationStore((s) => s.stages)

  const regionReady = stages.find((s) => s.stageId === 'backtracking')?.status === 'completed'
  const candidatesReady = stages.find((s) => s.stageId === 'attribution')?.status === 'completed'
  const detectionReady = stages.find((s) => s.stageId === 'detection')?.status === 'completed'
  const envReady = stages.find((s) => s.stageId === 'forward_drift')?.status === 'completed'

  const available: MapLayerId[] = [
    ...(detectionReady || sar.candidates.length > 0 ? (['sarSlicks', 'sarFootprint'] as MapLayerId[]) : []),
    ...(regionReady ? (['uncertainty'] as MapLayerId[]) : []),
    ...(candidatesReady ? (['attribution'] as MapLayerId[]) : []),
    ...(spill?.location ? (['slick'] as MapLayerId[]) : []),
    ...(drift.particles.length > 0 || (drift.extent?.length ?? 0) > 0 ? (['drift'] as MapLayerId[]) : []),
    ...(envReady ? (['drift'] as MapLayerId[]) : []),
    ...(useSimulationStore.getState().vessels.length > 0 ? (['vessels'] as MapLayerId[]) : []),
  ]

  const layers = [...simLayers, ...sarLayers, ...invLayers, ...ringLayers]

  return (
    <MissionWorkspace
      toolbar={
        <>
          <InvestigationStepper />
          <InvestigationControls />
        </>
      }
      map={
        <div className="map-pane">
          <MapView
            layers={layers}
            onSelect={(selection) => useMapStore.getState().select(selection)}
          >
            <MapFurniture />
            <AutoEnableLayers />
          </MapView>
          <MapLayersPanel available={available} />
          <div className="map-note">
            SAR slicks, the source region and AIS candidates appear as their stages finish — click any to inspect.
          </div>
        </div>
      }
      dock={<InvestigationTimeline />}
      rail={
        <div className="rail-stack-inner">
          {hasSelection ? <ContextualPanel /> : <OverviewIntel />}
          <StageDetail />
          <InvestigationPipeline compact />
          <CandidateRanking />
          <Panel title="Evidence Chain">
            <EvidenceChain />
          </Panel>
          <Result />
          <Panel title="Stage recovery">
            <div className="stack">
              <RetryStage stageId="detection" />
              <RetryStage stageId="backtracking" />
              <RetryStage stageId="forward_drift" />
              <RetryStage stageId="attribution" />
            </div>
          </Panel>
          <ProvenancePanel />
          <SarObservationPanel simulationId={simulationId} />
          <div style={{ padding: '4px 6px 10px' }}>
            <Disclaimer>
              Every layer above reflects the recorded investigation state; demo/controlled provenance is always labelled.
            </Disclaimer>
          </div>
        </div>
      }
    />
  )
}