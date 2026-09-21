import { useInvestigationStore, STAGE_LABEL } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useMapStore } from '@/store/mapStore'
import { useDataProvenance } from '@/ui/hooks/useDataProvenance'
import { Button } from '@/ui/design-system/Button'
import { Panel } from '@/ui/design-system/Panel'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'

import { FocusedStageCard, AllStageCards } from './StageCards'
import { SelectionInspectorCard } from '../cards/SelectionInspectorCard'
import { ChevronDownIcon, RadarIcon } from '@/components/ui/Icon'
import type { InvestigationStageId } from '@/types/domain'

function invStatusTone(status: string | null): OperationalStatusTone {
  switch (status) {
    case 'RUNNING': return 'run'
    case 'COMPLETED': return 'ok'
    case 'FAILED': return 'danger'
    case 'CANCELLED': return 'warn'
    default: return 'idle'
  }
}

function ProgressGauge() {
  const progress = useInvestigationStore((s) => s.progress)
  const status = useInvestigationStore((s) => s.status)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-mist">Pipeline progress</span>
        <StatusBadge tone={invStatusTone(status)}>{status ?? 'Idle'}</StatusBadge>
      </div>
      <div className="w-full h-1.5 bg-[var(--border-default)] rounded overflow-hidden">
        <div
          className="h-full bg-sonar transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-ink-muted tabular-nums">{progress.toFixed(0)}% complete</span>
    </div>
  )
}

function ExecutionControls() {
  const status = useInvestigationStore((s) => s.status)
  const busy = useInvestigationStore((s) => s.busy)
  const actionError = useInvestigationStore((s) => s.actionError)
  const startInv = useInvestigationStore((s) => s.start)
  const retry = useInvestigationStore((s) => s.retry)
  const cancel = useInvestigationStore((s) => s.cancel)
  const incidentId = useSimulationStore((s) => s.spill?.incidentId ?? null)

  const canStart = incidentId && (!status || status === 'CANCELLED' || status === 'FAILED')
  const canRetry = status === 'FAILED'
  const canCancel = status === 'RUNNING'

  return (
    <div className="flex flex-col gap-2">
      {actionError && <p className="text-xs text-danger">{actionError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !canStart}
          onClick={() => incidentId && void startInv(incidentId)}
        >
          Start investigation
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !canRetry}
          onClick={() => void retry()}
        >
          Retry pipeline
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy || !canCancel}
          onClick={() => void cancel()}
        >
          Cancel
        </Button>
      </div>
      {!incidentId && (
        <p className="text-[10px] text-ink-muted">Create a simulation and release a spill first to start an investigation.</p>
      )}
    </div>
  )
}

function GroundTruthReveal() {
  const status = useInvestigationStore((s) => s.status)
  const reveal = useInvestigationStore((s) => s.reveal)
  const lastReveal = useInvestigationStore((s) => s.lastReveal)
  const revealGroundTruth = useInvestigationStore((s) => s.revealGroundTruth)
  const busy = useInvestigationStore((s) => s.busy)

  if (status !== 'COMPLETED') return null

  return (
    <Panel title="Ground-truth evaluation">
      {reveal.revealed && lastReveal ? (
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-mist">Position error</span>
            <span className="font-mono text-foam tabular-nums">{lastReveal.positionError_km?.toFixed(2) ?? '—'} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist">Time error</span>
            <span className="font-mono text-foam tabular-nums">{lastReveal.timeError_min != null ? `${lastReveal.timeError_min.toFixed(0)} min` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mist">Attribution correct</span>
            <span className={`font-semibold ${lastReveal.attributionCorrect ? 'text-ok' : 'text-danger'}`}>
              {lastReveal.attributionCorrect ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-ink-muted">
            Reveal the ground-truth to compare the investigation conclusion against the actual spill origin.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void revealGroundTruth()}
          >
            Reveal ground truth
          </Button>
        </div>
      )}
    </Panel>
  )
}

function ProvenanceSection() {
  const provenance = useInvestigationStore((s) => s.provenance)
  const params = useInvestigationStore((s) => s.params)

  return (
    <Panel title="Provenance">
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span className="text-mist">Aggregation</span>
          <span className="text-foam">{provenance?.aggregation ?? '—'}</span>
        </div>
        {provenance?.perStage && Object.entries(provenance.perStage).map(([stageId, p]) => (
          <div key={stageId} className="flex justify-between">
            <span className="text-mist">{STAGE_LABEL[stageId] ?? stageId}</span>
            <span className="text-foam text-[10px]">{p}</span>
          </div>
        ))}
      </div>
      {params && (
        <details className="mt-2">
          <summary className="text-[10px] text-ink-muted cursor-pointer">Runtime parameters</summary>
          <ul className="mt-1 text-[10px] text-ink-muted list-disc pl-4 space-y-0.5">
            <li>SAR: {params.sarSource} · {params.sarDetector}</li>
            <li>Backtrack: {params.backtrackEnsembleSize}×{params.backtrackParticlesPerMember} · {params.backtrackDurationHours}h</li>
            <li>Drift: {params.forwardDriftParticleCount} particles · {params.forwardDriftDurationHours}h</li>
            <li>Environment: {params.environmentSource}</li>
            <li>AIS: {params.aisSource} · r={params.radiusKm} km · gap={params.maxGapMin} min</li>
            <li>Seed: {params.seed}</li>
          </ul>
        </details>
      )}
    </Panel>
  )
}

export function InvestigationConsole({ rightCollapsed, setRightCollapsed }: { rightCollapsed: boolean; setRightCollapsed: (v: boolean) => void }) {
  const focusedStageId = useInvestigationStore((s) => s.focusedStageId)
  const status = useInvestigationStore((s) => s.status)
  const stages = useInvestigationStore((s) => s.stages)
  const hasSelection = useMapStore((s) => s.selection != null)
  const setFocusedStageId = useInvestigationStore((s) => s.setFocusedStageId)
  useDataProvenance() // read for reactivity, not directly rendered in header

  const currentRunning = stages.find((s) => s.status === 'running')?.stageId
  const activeStageId = focusedStageId || currentRunning

  if (rightCollapsed) {
    return (
      <div className="h-full flex flex-col items-center pt-4">
        <button
          className="text-ink-3 hover:text-ink-1 transition-colors rotate-90"
          onClick={() => setRightCollapsed(false)}
          title="Expand console"
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center space-x-2">
          <RadarIcon size={14} className="text-accent" />
          <div>
            <h2 className="text-xs font-semibold text-ink-1 tracking-wider">Investigation console</h2>
            <p className="text-[10px] text-ink-3 mt-0.5">
              {hasSelection ? 'Feature inspect' : activeStageId ? STAGE_LABEL[activeStageId] : 'Pipeline overview'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {focusedStageId && (
            <button
              className="text-[10px] font-semibold text-ink-3 hover:text-ink-1 tracking-wider transition-colors"
              onClick={() => setFocusedStageId(null)}
              title="Reset to live pipeline stage"
            >
              Live sync
            </button>
          )}
          <button
            className="text-ink-3 hover:text-ink-1 transition-colors"
            onClick={() => setRightCollapsed(true)}
            title="Collapse console"
          >
            <ChevronDownIcon size={16} className="-rotate-90" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-surface)]">
        {hasSelection ? (
          <SelectionInspectorCard />
        ) : (
          <>
            {/* Progress */}
            <Panel title="Pipeline">
              <ProgressGauge />
            </Panel>

            {/* Controls */}
            <Panel title="Execution">
              <ExecutionControls />
            </Panel>

            {/* Stage cards — focused or all */}
            {activeStageId ? (
              <FocusedStageCard stageId={activeStageId as InvestigationStageId} />
            ) : (
              <AllStageCards />
            )}

            {/* Ground truth reveal (conclusion stage, inline) */}
            <GroundTruthReveal />

            {/* Provenance */}
            <ProvenanceSection />
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center px-4">
          <p className="text-[10px] text-ink-muted">
            {!status || status === 'CREATED'
              ? 'System standing by for telemetry link.'
              : status === 'RUNNING'
                ? 'Live scientific pipeline — all sensor models and trajectories reflect deterministic numerical computations.'
                : status === 'COMPLETED'
                  ? 'Scientific pipeline complete — investigation results are final and reproducible.'
                  : status === 'FAILED'
                    ? 'Scientific pipeline failed — check stage errors above.'
                    : 'Scientific pipeline cancelled.'}
          </p>
        </div>
      </div>
    </div>
  )
}
