import { useMemo } from 'react'
import { KeyValue } from '@/components/ui/Panel'
import {
  ProvenancePill,
  RankBadge,
  ScoreBar,
  Disclaimer,
  MiniStat,
  fmtLatLng,
  fmtTime,
} from '@/components/ui/primitives'
import { IntelShell, IntelSection, IntelClearButton } from '@/components/intel/IntelPanel'
import { useSelectionFocus, type SelectionFocus } from '@/components/workspace/selection'
import { useSimulationStore } from '@/store/simulationStore'
import { useSarStore } from '@/store/sarStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { stageSourceRegionRing, stageUncertaintyKm, stageOrigin } from '@/components/map/InvestigationMap'
import type { AttributionFactorKey } from '@/types/domain'

const FACTOR_LABELS: Record<string, string> = {
  spatial: 'Spatial match',
  temporal: 'Temporal match',
  trajectory: 'Trajectory match',
  anomaly: 'Behaviour anomaly',
  environmental: 'Environmental consistency',
}

const DEFAULT_WEIGHTS: Record<AttributionFactorKey, number> = {
  spatial: 0.25,
  temporal: 0.2,
  trajectory: 0.25,
  anomaly: 0.15,
  environmental: 0.15,
}

const FACTOR_ORDER: AttributionFactorKey[] = ['spatial', 'temporal', 'trajectory', 'anomaly', 'environmental']

function SpillView() {
  const spill = useSimulationStore((s) => s.spill)
  if (!spill?.spillEventId) return <div className="text-faint">No spill released on this simulation.</div>
  return (
    <div className="stack">
      <IntelSection label="Event">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <MiniStat label="Event" value={spill.spillEventId.slice(0, 18) + '…'} />
          <MiniStat label="Incident" value={spill.incidentId ? spill.incidentId.slice(0, 18) + '…' : '—'} />
        </div>
        <KeyValue label="Oil type" value={spill.oilType ?? '—'} />
        <KeyValue label="Quantity" value={spill.quantityKg != null ? `${spill.quantityKg} kg` : '—'} />
        <KeyValue label="Position" value={fmtLatLng(spill.location)} />
        <KeyValue label="Time" value={fmtTime(spill.time)} />
      </IntelSection>
      <Disclaimer>
        This is the observation point of the released slick — a marker for the
        event, not an estimate of the source.
      </Disclaimer>
    </div>
  )
}

function VesselView({ id }: { id?: string | null }) {
  const vessel = useSimulationStore((s) => s.vessels.find((v) => v.id === id))
  if (!vessel) return <div className="text-faint">Vessel position unavailable (live stream).</div>
  return (
    <div className="stack">
      <IntelSection label="Vessel">
        <KeyValue label="Vessel" value={vessel.name} />
        <KeyValue label="Type" value={vessel.type} />
        <KeyValue label="MMSI" value={vessel.mmsi} />
        <div className="row" style={{ flexWrap: 'wrap', paddingTop: 4 }}>
          <MiniStat label="Speed" value={vessel.speed !== 0 ? `${vessel.speed.toFixed(1)} kn` : '—'} />
          <MiniStat label="Heading" value={vessel.heading !== 0 ? `${vessel.heading.toFixed(0)}°` : '—'} />
        </div>
        <KeyValue label="Position" value={fmtLatLng(vessel.position)} />
      </IntelSection>
      <div className="text-faint" style={{ fontSize: '10.5px' }}>
        Live position from Captain Mode (simulated fleet).
      </div>
    </div>
  )
}

function SarView({ id }: { id?: string | null }) {
  const candidate = useSarStore((s) => s.candidates.find((c) => c.id === id))
  const provenance = useSarStore((s) => s.provenance)
  if (!candidate) return <div className="text-faint">Candidate not available.</div>
  const oil = candidate.classification === 'OIL_CANDIDATE'
  return (
    <div className="stack">
      <IntelSection label="Detection">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className={`status-chip ${oil ? 'status-chip--ok' : 'status-chip--warn'}`}>
            {candidate.classification.replace('_', ' ')}
          </span>
          <ProvenancePill value={provenance} />
        </div>
        <ScoreBar label="Detector confidence" value={candidate.confidence} />
        <div className="row" style={{ flexWrap: 'wrap', paddingTop: 4 }}>
          <MiniStat label="Area" value={`${candidate.areaKm2.toFixed(2)} km²`} />
          <MiniStat label="Aspect" value={candidate.aspectRatio != null ? candidate.aspectRatio.toFixed(2) : '—'} />
        </div>
        <KeyValue label="Length / width" value={candidate.lengthKm != null || candidate.widthKm != null ? `${candidate.lengthKm?.toFixed(1) ?? '—'} × ${candidate.widthKm?.toFixed(1) ?? '—'} km` : '—'} />
        <KeyValue label="Contrast Δσ⁰" value={candidate.contrastDb != null ? `${candidate.contrastDb.toFixed(1)} dB` : '—'} />
        <KeyValue label="Incidence" value={candidate.incidenceDeg != null ? `${candidate.incidenceDeg.toFixed(0)}°` : '—'} />
      </IntelSection>
      {candidate.hints.length > 0 && (
        <div className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.35 }}>
          Look-alike hints: {candidate.hints.join(' · ')}
        </div>
      )}
      <Disclaimer>
        Detector classification from radar backscatter — a candidate, not ground
        truth. Look-alikes (biological films, wind sheltering) can appear as dark
        features.
      </Disclaimer>
    </div>
  )
}

function SourceRegionView() {
  const stages = useInvestigationStore((s) => s.stages)
  const backtrack = stages.find((s) => s.stageId === 'backtracking')
  const summary = backtrack?.summary ?? {}
  const timeRange = summary.originTimeRange
  const otr =
    typeof timeRange === 'object' && timeRange !== null
      ? (timeRange as { earliest?: string; latest?: string; preferred?: string })
      : null
  const uncertainty = stageUncertaintyKm(stages)
  const region = stageSourceRegionRing(stages)

  return (
    <div className="stack">
      <IntelSection label="Region">
        <div className="row" style={{ flexWrap: 'wrap', paddingTop: 2 }}>
          <MiniStat label="Uncertainty" value={uncertainty != null ? `± ${uncertainty.toFixed(1)} km` : '—'} />
          <MiniStat label="Region area" value={region ? `${region.length} vertices` : '—'} />
        </div>
        <KeyValue label="Preferred source time" value={fmtTime(otr?.preferred, '—')} />
        <KeyValue label="Window" value={`${fmtTime(otr?.earliest)} → ${fmtTime(otr?.latest)}`} />
        {typeof summary.sourceConcentration === 'string' ? (
          <KeyValue label="Source concentration" value={summary.sourceConcentration} />
        ) : null}
      </IntelSection>
      <Disclaimer>
        The source is shown as an uncertainty region from the backtracking
        ensemble — not a single exact point. A bounded window, not a precise
        release time, is claimed.
      </Disclaimer>
    </div>
  )
}

function OriginView() {
  const stages = useInvestigationStore((s) => s.stages)
  const origin = stageOrigin(stages)
  const uncertainty = stageUncertaintyKm(stages)
  if (!origin) return <div className="text-faint">No origin estimate yet.</div>
  return (
    <div className="stack">
      <IntelSection label="Estimate">
        <KeyValue label="Estimated origin" value={fmtLatLng(origin)} />
        <KeyValue label="Uncertainty" value={uncertainty != null ? `± ${uncertainty.toFixed(1)} km` : '—'} />
      </IntelSection>
      <Disclaimer>
        Estimated backtracking origin. Its bounding region communicates the
        uncertainty; avoid treating the marker as the exact discharge point.
      </Disclaimer>
    </div>
  )
}

function AisView({ focus }: { focus: SelectionFocus }) {
  const stages = useInvestigationStore((s) => s.stages)
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const ranked = useMemo(() => {
    const raw = stages.find((s) => s.stageId === 'attribution')?.summary?.rankedVessels
    return Array.isArray(raw) ? (raw as { rank: number; score: number }[]) : []
  }, [stages])

  const candidate = focus.candidate ?? null
  if (!candidate) return <div className="text-faint">Candidate data not available.</div>

  const first = ranked[0]
  const margin =
    candidate.score != null && first?.score != null ? candidate.score - first.score : null
  const decisive = conclusion?.decisive
  return (
    <div className="stack">
      <IntelSection label={candidate.mmsi ? `MMSI ${candidate.mmsi}` : 'Candidate'}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <RankBadge rank={candidate.rank} />
          <span className="text-dim">{candidate.name ?? 'Unnamed vessel'}</span>
        </div>
        {candidate.mmsi ? <KeyValue label="MMSI" value={candidate.mmsi} /> : null}
        <ScoreBar
          label="Composite score"
          value={candidate.score}
          display={candidate.score != null ? (candidate.score * 100).toFixed(1) + '%' : '—'}
        />
        <KeyValue
          label="Closest approach"
          value={`${candidate.minDistanceKm?.toFixed(1) ?? '—'} km${candidate.timeOfClosestApproach ? ` @ ${fmtTime(candidate.timeOfClosestApproach)}` : ''}`}
        />
        {candidate.factors ? (
          <div className="stack" style={{ gap: 4, marginTop: 2 }}>
            {FACTOR_ORDER.filter((f) => candidate.factors?.[f] != null).map((f) => (
              <ScoreBar
                key={f}
                label={FACTOR_LABELS[f]}
                value={candidate.factors?.[f] ?? null}
                weight={DEFAULT_WEIGHTS[f]}
              />
            ))}
          </div>
        ) : null}
        <KeyValue
          label="Margin vs top"
          value={margin != null ? `${Math.abs(margin * 100).toFixed(1)}%${decisive === false ? ' (not decisive)' : ''}` : '—'}
        />
      </IntelSection>
      <Disclaimer>
        Ranked candidate — <strong>not a confirmed culprit</strong>. Ranking is a
        composite likelihood for the search window, weighted by spatial,
        temporal and behaviour factors; a top ranking is not a declaration of
        cause.
      </Disclaimer>
    </div>
  )
}

/** Right-rail intelligence panel — renders the detail for the selected object. */
export function ContextualPanel() {
  const focus = useSelectionFocus()

  if (!focus.selection) {
    return (
      <IntelShell eyebrow="Object details" title="Nothing selected">
        <div className="intel-empty">
          <div>
            <div className="empty-label">Select an object on the map</div>
            <div className="text-faint">
              Spill, slick, candidate, source region, vessel or origin.
            </div>
          </div>
        </div>
      </IntelShell>
    )
  }

  switch (focus.kind) {
    case 'spill':
    case 'slick':
      return (
        <IntelShell eyebrow="Observation" title={focus.label ?? 'Spill'} actions={<IntelClearButton />}>
          <SpillView />
        </IntelShell>
      )
    case 'vessel':
      return (
        <IntelShell eyebrow="Live fleet" title={focus.label ?? 'Vessel'} actions={<IntelClearButton />}>
          <VesselView id={focus.selection.id} />
        </IntelShell>
      )
    case 'sar_candidate':
      return (
        <IntelShell
          eyebrow="SAR detection"
          title={focus.label ?? 'SAR candidate'}
          actions={<IntelClearButton />}
        >
          <SarView id={focus.selection.id} />
        </IntelShell>
      )
    case 'source_region':
      return (
        <IntelShell eyebrow="Analysis" title="Probable source region" actions={<IntelClearButton />}>
          <SourceRegionView />
        </IntelShell>
      )
    case 'origin':
      return (
        <IntelShell eyebrow="Analysis" title="Estimated origin" actions={<IntelClearButton />}>
          <OriginView />
        </IntelShell>
      )
    case 'ais_candidate':
      return (
        <IntelShell
          eyebrow="AIS candidate"
          title={focus.label ?? 'Candidate'}
          actions={<IntelClearButton />}
        >
          <AisView focus={focus} />
        </IntelShell>
      )
    default:
      return (
        <IntelShell eyebrow="Object details" title={focus.label ?? 'Selected object'} actions={<IntelClearButton />}>
          <div className="text-faint">No detail view for this object.</div>
        </IntelShell>
      )
  }
}