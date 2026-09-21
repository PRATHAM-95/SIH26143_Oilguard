import { useInvestigationStore, STAGE_LABEL, STAGE_ORDER } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { Panel } from '@/ui/design-system/Panel'
import { StatusBadge, type OperationalStatusTone } from '@/ui/design-system/StatusBadge'
import { ProvenanceLabel } from '@/ui/design-system/ProvenanceLabel'
import type { InvestigationStageState, InvestigationStageId } from '@/types/domain'

function stageTone(status: string): OperationalStatusTone {
  switch (status) {
    case 'completed': return 'ok'
    case 'running': return 'run'
    case 'failed': return 'danger'
    default: return 'idle'
  }
}

function KV({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between text-xs">
      <span className="text-mist">{label}</span>
      <span className={`text-foam ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</span>
    </div>
  )
}

/* ────────────────── Per-stage evidence cards ────────────────── */

function DetectionEvidence() {
  const sar = useSarStore()
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'detection'))

  if (!stage || stage.status === 'pending') {
    return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  }

  const hasCandidates = sar.candidates.length > 0 || stage.summary?.candidateCount != null
  const hasConfidence = stage.summary?.confidence != null
  if (!hasCandidates && !hasConfidence && !sar.provenance) {
    return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Processing SAR detection…' : 'Awaiting acquisition'}</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <KV label="Candidates" value={sar.candidates.length > 0 ? String(sar.candidates.length) : stage.summary?.candidateCount != null ? String(stage.summary.candidateCount) : null} mono />
      <KV label="Confidence" value={stage.summary?.confidence != null ? `${(Number(stage.summary.confidence) * 100).toFixed(1)}%` : null} mono />
      {sar.provenance && (
        <div className="flex justify-between text-xs">
          <span className="text-mist">Source</span>
          <ProvenanceLabel
            kind={sar.provenance === 'REAL_SENTINEL1' || sar.provenance === 'CACHED_SENTINEL1' ? 'live' : sar.provenance === 'SYNTHETIC' ? 'simulated' : sar.provenance === 'LOCAL_FIXTURE' ? 'controlled' : 'empty'}
          />
        </div>
      )}
    </div>
  )
}

function CharacterizationEvidence() {
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'characterization'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  const s = stage.summary ?? {}
  const hasData = s.areaKm2 != null || s.lengthKm != null || s.widthKm != null || s.volumeM3 != null
  if (!hasData) return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Calculating characterization…' : 'Awaiting characterization data'}</p>
  return (
    <div className="flex flex-col gap-1">
      <KV label="Area" value={s.areaKm2 != null ? `${Number(s.areaKm2).toFixed(2)} km²` : null} mono />
      <KV label="Length" value={s.lengthKm != null ? `${Number(s.lengthKm).toFixed(2)} km` : null} mono />
      <KV label="Width" value={s.widthKm != null ? `${Number(s.widthKm).toFixed(2)} km` : null} mono />
      <KV label="Volume" value={s.volumeM3 != null ? `${Number(s.volumeM3).toFixed(1)} m³` : null} mono />
    </div>
  )
}

function EnvironmentEvidence() {
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'environment'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  const s = stage.summary ?? {}
  const hasData = s.windSpeed != null || s.windHeading != null || s.currentSpeed != null || s.environmentSource != null || stage.modelVersion != null
  if (!hasData) return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Acquiring environmental data…' : 'No environmental data'}</p>
  return (
    <div className="flex flex-col gap-1">
      <KV label="Wind speed" value={s.windSpeed != null ? `${Number(s.windSpeed).toFixed(1)} m/s` : null} mono />
      <KV label="Wind heading" value={s.windHeading != null ? `${Number(s.windHeading).toFixed(0)}°` : null} mono />
      <KV label="Current speed" value={s.currentSpeed != null ? `${Number(s.currentSpeed).toFixed(2)} m/s` : null} mono />
      <KV label="Source" value={typeof s.environmentSource === 'string' ? s.environmentSource : (typeof stage.modelVersion === 'string' ? stage.modelVersion : null)} />
    </div>
  )
}

function ForwardDriftEvidence() {
  const drift = useSimulationStore((s) => s.drift)
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'forward_drift'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  const hasDrift = (drift.particleCount != null && drift.particleCount > 0) || drift.particles.length > 0 || drift.durationHours != null
  if (!hasDrift) return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Computing forward drift…' : 'No drift results'}</p>
  return (
    <div className="flex flex-col gap-1">
      <KV label="Particles" value={drift.particleCount ?? (drift.particles.length > 0 ? drift.particles.length : null)} mono />
      <KV label="Duration" value={drift.durationHours != null ? `${drift.durationHours} h` : null} mono />
      {drift.environmentSource && (
        <div className="flex justify-between text-xs">
          <span className="text-mist">Environment</span>
          <ProvenanceLabel kind="simulated" text={drift.environmentSource} />
        </div>
      )}
      {drift.massBalance && (
        <>
          <KV label="Remaining" value={`${drift.massBalance.remainingKg.toFixed(1)} kg`} mono />
          <KV label="Evaporated" value={`${drift.massBalance.evaporatedKg.toFixed(1)} kg`} mono />
        </>
      )}
    </div>
  )
}

function BacktrackingEvidence() {
  const bt = useBacktrackingStore()
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'backtracking'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  const hasData = bt.origin != null || bt.uncertaintyKm != null || bt.confidence != null || bt.ensembleSize != null || bt.durationHours != null
  if (!hasData) return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Computing backtracking ensemble…' : 'No backtracking results'}</p>
  return (
    <div className="flex flex-col gap-1">
      {bt.origin && <KV label="Origin" value={`${bt.origin.lat.toFixed(4)}°, ${bt.origin.lon.toFixed(4)}°`} mono />}
      <KV label="Uncertainty" value={bt.uncertaintyKm != null ? `${bt.uncertaintyKm.toFixed(1)} km` : null} mono />
      <KV label="Confidence" value={bt.confidence != null ? `${(bt.confidence * 100).toFixed(1)}%` : null} mono />
      <KV label="Ensemble" value={bt.ensembleSize != null ? `${bt.ensembleSize} members` : null} mono />
      <KV label="Duration" value={bt.durationHours != null ? `${bt.durationHours} h` : null} mono />
    </div>
  )
}

function AisEvidence() {
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'ais'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  const s = stage.summary ?? {}
  const hasData = s.vesselCount != null || s.kept != null || s.dropped != null || s.radiusKm != null || s.aisSource != null
  if (!hasData) return <p className="text-[10px] text-ink-muted">{stage.status === 'running' ? 'Filtering AIS traffic…' : 'No AIS traffic data'}</p>
  return (
    <div className="flex flex-col gap-1">
      <KV label="Vessels found" value={s.vesselCount != null ? String(s.vesselCount) : (s.kept != null ? String(s.kept) : null)} mono />
      <KV label="Filtered" value={s.dropped != null ? `${s.dropped} excluded` : null} mono />
      <KV label="Search radius" value={s.radiusKm != null ? `${Number(s.radiusKm).toFixed(0)} km` : null} mono />
      <KV label="Source" value={typeof s.aisSource === 'string' ? s.aisSource : null} />
    </div>
  )
}

function AttributionEvidence() {
  const att = useAttributionStore()
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'attribution'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>

  return (
    <div className="flex flex-col gap-2">
      {att.vessels.length > 0 ? (
        <div className="flex flex-col gap-2">
          {att.vessels.slice(0, 5).map((v) => (
            <div key={v.rank} className="flex items-center gap-2 text-xs">
              <span className="text-mist font-mono tabular-nums w-5 text-right shrink-0">#{v.rank}</span>
              <span className="text-foam flex-1 truncate">{v.name ?? 'Unnamed'}</span>
              <span className="font-mono tabular-nums text-foam">{v.score != null ? `${(v.score * 100).toFixed(1)}%` : '—'}</span>
            </div>
          ))}
          {att.vessels.length > 5 && (
            <p className="text-[10px] text-ink-muted">+ {att.vessels.length - 5} more candidates</p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-ink-muted">Awaiting attribution results</p>
      )}
      {att.ranking && (
        <div className="flex flex-col gap-1 border-t border-[var(--border-default)] pt-2">
          <KV label="Top score" value={att.ranking.top_score != null ? `${(att.ranking.top_score * 100).toFixed(1)}%` : null} mono />
          <KV label="Margin" value={att.ranking.margin != null ? `${(att.ranking.margin * 100).toFixed(1)}%` : null} mono />
          <KV label="Decisive" value={att.ranking.decisive != null ? (att.ranking.decisive ? 'Yes' : 'No') : null} />
        </div>
      )}
    </div>
  )
}

function ConclusionEvidence() {
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === 'conclusion'))
  if (!stage || stage.status === 'pending') return <p className="text-[10px] text-ink-muted">Not yet calculated</p>
  if (!conclusion) return <p className="text-[10px] text-ink-muted">Awaiting conclusion</p>

  return (
    <div className="flex flex-col gap-1">
      <KV label="Verdict" value={conclusion.status ?? '—'} />
      {conclusion.candidate && typeof conclusion.candidate === 'object' && (
        <KV label="Candidate" value={String(conclusion.candidate.name ?? conclusion.candidate.mmsi ?? '—')} />
      )}
      <KV label="Top score" value={conclusion.topScore != null ? `${(conclusion.topScore * 100).toFixed(1)}%` : null} mono />
      <KV label="Margin" value={conclusion.margin != null ? `${(conclusion.margin * 100).toFixed(1)}%` : null} mono />
      {conclusion.decisive === false && (
        <p className="text-xs text-warn">Result not decisive</p>
      )}
      {conclusion.reason && <p className="text-[10px] text-ink-muted mt-1">{conclusion.reason}</p>}
    </div>
  )
}

const EVIDENCE_COMPONENTS: Record<string, React.ComponentType> = {
  detection: DetectionEvidence,
  characterization: CharacterizationEvidence,
  environment: EnvironmentEvidence,
  forward_drift: ForwardDriftEvidence,
  backtracking: BacktrackingEvidence,
  ais: AisEvidence,
  attribution: AttributionEvidence,
  conclusion: ConclusionEvidence,
}

/**
 * Renders a single stage card with status, attempt count, and evidence.
 */
export function StageCard({ stageId, stage }: { stageId: InvestigationStageId; stage: InvestigationStageState | undefined }) {
  const EvidenceComponent = EVIDENCE_COMPONENTS[stageId]
  const stat = stage?.status ?? 'pending'

  return (
    <Panel
      title={STAGE_LABEL[stageId] ?? stageId}
      headerActions={
        <div className="flex items-center gap-2">
          <StatusBadge tone={stageTone(stat)}>{stat}</StatusBadge>
          {stage && stage.attemptCount > 1 && (
            <span className="text-[10px] text-ink-muted">{stage.attemptCount} attempts</span>
          )}
        </div>
      }
    >
      {stage?.error && <p className="text-xs text-danger mb-2">{stage.error}</p>}
      {EvidenceComponent ? <EvidenceComponent /> : <p className="text-[10px] text-ink-muted">No data</p>}
    </Panel>
  )
}

/**
 * Renders all 8 stage cards in sequence.
 */
export function AllStageCards() {
  const stages = useInvestigationStore((s) => s.stages)

  return (
    <div className="flex flex-col gap-3">
      {STAGE_ORDER.map((stageId) => {
        const stage = stages.find((s) => s.stageId === stageId)
        return <StageCard key={stageId} stageId={stageId} stage={stage} />
      })}
    </div>
  )
}

/**
 * Renders the focused stage card only (single card view for the contextual console).
 */
export function FocusedStageCard({ stageId }: { stageId: InvestigationStageId }) {
  const stage = useInvestigationStore((s) => s.stages.find((st) => st.stageId === stageId))
  return <StageCard stageId={stageId} stage={stage} />
}
