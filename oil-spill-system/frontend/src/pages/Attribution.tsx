import { useEffect, useState } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { MapLayersPanel } from '@/components/ui/MapLayersPanel'
import { RankBadge, ProvenancePill } from '@/components/ui/primitives'
import { MissionWorkspace } from '@/components/workspace/MissionWorkspace'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { OverviewIntel } from '@/components/intel/IntelPanel'
import { RankIcon } from '@/components/ui/Icon'
import { useAttributionStore, useBacktrackingStore } from '@/store/featureStores'
import { useSimulationStore } from '@/store/simulationStore'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useAttributionLayers } from '@/components/attribution/AttributionMap'
import type { AttributionFactorKey } from '@/types/domain'

const FACTOR_LABELS: Record<AttributionFactorKey, string> = {
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

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').replace('.000Z', 'Z')
}

function StateChip({ state }: { state: string | null }) {
  const cls =
    state === 'CONTROLLED' ? 'ok' : state === 'UNAVAILABLE' ? 'danger' : state ? 'warn' : ''
  return <span className={`status-chip status-chip--${cls}`}>{state ?? '—'}</span>
}

function ConclusionBanner() {
  const conclusion = useAttributionStore((s) => s.conclusion)
  const ranking = useAttributionStore((s) => s.ranking)
  const status = useAttributionStore((s) => s.status)
  const warnings = useAttributionStore((s) => s.warnings)

  if (status !== 'completed') return null

  const candidate = conclusion === 'candidate'
  return (
    <Panel title={candidate ? 'Candidate Identified' : 'Attribution Inconclusive'}>
      <div className="stack">
        <div className="text-faint" style={{ fontSize: '10.5px' }}>
          {candidate
            ? 'One vessel is clearly ranked above the others with a decisive margin. Ranked candidates are not a declaration of cause.'
            : ranking
              ? `Top score ${ranking.top_score.toFixed(2)} with margin ${ranking.margin.toFixed(3)} — insufficient evidence for a decisive candidate.`
              : 'No decisive ranking could be established.'}
        </div>
        {ranking && (
          <KeyValue label="Margin" value={`${ranking.margin.toFixed(3)}`} />
        )}
        {warnings.length > 0 && (
          <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.35 }}>
            {warnings.slice(0, 4).map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

function RankedTable() {
  const vessels = useAttributionStore((s) => s.vessels)
  const status = useAttributionStore((s) => s.status)
  const ranked = useAttributionStore((s) => s.ranked)
  const [selected, setSelected] = useState<number | null>(null)

  const selectedRank = selected ?? vessels[0]?.rank ?? null

  useEffect(() => {
    if (vessels.length > 0) setSelected(null)
  }, [vessels])

  if (status === 'completed' && (ranked || vessels.length > 0)) {
    return (
      <>
        <table className="data-table" aria-label="Vessel ranking">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Vessel</th>
              <th className="num">Score</th>
              <th className="num">Distance</th>
              <th>AIS</th>
              <th className="num">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {vessels.map((row) => (
              <tr key={`${row.rank}-${row.mmsi}`}>
                <td><RankBadge rank={row.rank} /></td>
                <td>
                  <div>{row.name ?? 'Unnamed vessel'}</div>
                  {row.mmsi ? <div className="text-faint" style={{ fontSize: '10.5px' }}>MMSI {row.mmsi}</div> : null}
                </td>
                <td className="num">{row.score != null ? row.score.toFixed(3) : '—'}</td>
                <td className="num">{row.minDistanceKm != null ? `${row.minDistanceKm.toFixed(1)} km` : '—'}</td>
                <td>
                  <span className={`status-chip status-chip--${row.dataQuality?.reliability === 'HIGH' ? 'ok' : row.dataQuality?.reliability === 'MEDIUM' ? 'warn' : 'danger'}`}>
                    {row.dataQuality?.reliability ?? '—'}
                  </span>
                </td>
                <td className="num">
                  <button
                    className={selectedRank === row.rank ? 'link-btn' : 'link-btn link-btn--dim'}
                    onClick={() => setSelected(row.rank)}
                  >
                    {selectedRank === row.rank ? 'Selected' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vessels.length === 0 && (
          <div className="text-faint" style={{ fontSize: '11px' }}>
            No candidates survived filtering within the search window/radius.
          </div>
        )}
      </>
    )
  }

  return <EmptyState label="No attribution yet" hint="Run the AIS analysis to rank candidate vessels." />
}

const EVIDENCE_FACTORS: AttributionFactorKey[] = ['spatial', 'temporal', 'trajectory', 'anomaly', 'environmental']

function VesselEvidence() {
  const vessels = useAttributionStore((s) => s.vessels)
  const weightsUsed = useAttributionStore((s) => s.weightsUsed)
  const [selected, setSelected] = useState<number | null>(null)
  const vessel = vessels.find((v) => v.rank === (selected ?? vessels[0]?.rank)) ?? vessels[0]

  if (!vessel) {
    return (
      <Panel title="Vessel Evidence">
        <EmptyState label="Awaiting scoring" hint="Select a ranked vessel to inspect its five-factor evidence." />
      </Panel>
    )
  }

  const weights = weightsUsed ?? DEFAULT_WEIGHTS

  return (
    <Panel
      title="Vessel Evidence"
      right={vessel.name ? <span className="text-faint">{vessel.rank}. {vessel.name}</span> : undefined}
    >
      <div className="stack">
        {vessel.mmsi ? (
          <KeyValue label="Vessel" value={`${vessel.mmsi}${vessel.vesselType ? ` · ${vessel.vesselType}` : ''}`} />
        ) : null}
        <KeyValue
          label="Closest approach"
          value={
            vessel.minDistanceKm != null
              ? `${vessel.minDistanceKm.toFixed(1)} km${vessel.timeOfClosestApproach ? ` @ ${formatTime(vessel.timeOfClosestApproach)}` : ''}`
              : '—'
          }
        />
        {EVIDENCE_FACTORS.map((factor) => {
          const score = vessel.factors?.[factor] ?? null
          const evidence = vessel.factorEvidence?.[factor] ?? {}
          const weight = weights[factor] ?? DEFAULT_WEIGHTS[factor]
          const note =
            typeof evidence.note === 'string' && evidence.note
              ? evidence.note
              : evidence.time_diff_hours != null
                ? `|Δt| ${Number(evidence.time_diff_hours).toFixed(1)} h`
                : evidence.closest_approach_km != null
                  ? `${Number(evidence.closest_approach_km).toFixed(1)} km at closest approach`
                  : null
          return (
            <div className="evidence-row" key={factor}>
              <span className={`evidence-flag ${score != null && score >= 0.5 ? '' : 'evidence-flag--faint'}`} aria-hidden="true">
                ◆
              </span>
              <div style={{ flex: 1 }}>
                <div className="evidence-label">
                  {FACTOR_LABELS[factor]} <span className="text-faint">· {(weight * 100).toFixed(0)}%</span>
                </div>
                <div className="evidence-value">{score != null ? score.toFixed(3) : '—'}</div>
                {note ? (
                  <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.35 }}>
                    {note}
                  </div>
                ) : null}
                {factor === 'anomaly' && vessel.dataQuality?.anomalies && vessel.dataQuality.anomalies.length > 0 && (
                  <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.35 }}>
                    Signals: {vessel.dataQuality.anomalies.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {vessel.dataQuality && (
          <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.4, borderTop: '1px solid var(--line, #1c2733)', paddingTop: '6px' }}>
            <div><strong>AIS reliability</strong></div>
            <div>{vessel.dataQuality.reliability} · messages in window: {vessel.dataQuality.messagesInWindow ?? '—'}</div>
            <div>
              cadence {vessel.dataQuality.medianCadenceMin != null ? `${vessel.dataQuality.medianCadenceMin.toFixed(0)} min` : '—'}
              {vessel.dataQuality.interpolationFraction != null ? ` · ${Math.round(vessel.dataQuality.interpolationFraction * 100)}% reconstructed` : ''}
            </div>
            {vessel.dataQuality.notes.slice(0, 3).map((n, i) => (
              <div key={i}>• {n}</div>
            ))}
          </div>
        )}
        {vessels.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {vessels.map((v) => (
              <button
                key={v.rank}
                className="chip-btn"
                onClick={() => setSelected(v.rank)}
                style={{ opacity: selected === v.rank || (selected == null && v === vessel) ? 1 : 0.5 }}
              >
                {v.rank}
              </button>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

function ProvenancePanel() {
  const providers = useAttributionStore((s) => s.providers)
  const sourceState = useAttributionStore((s) => s.sourceState)
  const aisSource = useAttributionStore((s) => s.aisSource)
  const attributionModelVersion = useAttributionStore((s) => s.attributionModelVersion)
  const controlled = providers?.['controlled']

  return (
    <Panel title="Data Provenance">
      <div className="stack">
        <KeyValue label="AIS source" value={aisSource ?? 'CONTROLLED'} />
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="field-label">Source state</span>
          <div className="row" style={{ gap: 4 }}>
            <StateChip state={sourceState ?? null} />
            <ProvenancePill value={aisSource ?? 'CONTROLLED'} />
          </div>
        </div>
        <KeyValue label="Attribution model" value={attributionModelVersion ?? 'ais-scoring-v1'} />
        <div className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.35 }}>
          {controlled?.note ??
            'Only deterministic seeded simulated AIS traffic (CONTROLLED) is available in this build; real feeds report UNAVAILABLE and are never faked.'}
        </div>
        {providers &&
          Object.entries(providers)
            .filter(([key]) => key !== 'controlled')
            .map(([key, p]) => (
              <div key={key} className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.35 }}>
                {key}: {p.state ?? '—'}
                {p.note ? ` — ${p.note}` : ''}
              </div>
            ))}
      </div>
    </Panel>
  )
}

function StatesPanel() {
  const status = useAttributionStore((s) => s.status)
  const vesselCount = useAttributionStore((s) => s.vesselCount)
  const kept = useAttributionStore((s) => s.kept)
  const dropped = useAttributionStore((s) => s.dropped)
  const aiq = useAttributionStore((s) => s.aisQuery)

  const stages: { id: string; label: string; state: 'done' | 'active' | 'pending' | 'error'; detail?: string }[] = [
    {
      id: 'search',
      label: 'AIS query',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? vesselCount != null
              ? 'done'
              : 'active'
            : 'pending',
      detail: aiq?.provider ? `${aiq.provider} · ${aiq.dataset}` : undefined,
    },
    {
      id: 'filter',
      label: 'Filtering',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? vesselCount != null
              ? kept != null || dropped != null
                ? 'done'
                : 'active'
              : 'pending'
            : 'pending',
      detail: kept != null ? `${kept} kept · ${dropped ?? 0} dropped` : undefined,
    },
    {
      id: 'score',
      label: 'Scoring',
      state:
        status === 'completed'
          ? 'done'
          : status === 'running'
            ? kept != null
              ? 'active'
              : 'pending'
            : 'pending',
      detail: status === 'completed' ? 'five-factor composite' : undefined,
    },
  ]

  return (
    <Panel title="AIS Analysis Pipeline">
      <div className="stack">
        {stages.map((s) => (
          <div key={s.id} className="evidence-row">
            <span className={`evidence-flag evidence-flag--${s.state === 'done' ? '' : s.state === 'active' ? 'faint' : 'faint'}`} aria-hidden="true">
              {s.state === 'done' ? '✓' : s.state === 'error' ? '✗' : '○'}
            </span>
            <div>
              <div className="evidence-label">{s.label}</div>
              {s.detail ? <div className="evidence-value">{s.detail}</div> : null}
            </div>
          </div>
        ))}
        {status === 'failed' && <div className="text-faint" style={{ fontSize: '10.5px' }}>Run failed — review errors.</div>}
      </div>
    </Panel>
  )
}

function Toolbar() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const status = useAttributionStore((s) => s.status)
  const busy = useAttributionStore((s) => s.busy)
  const clear = useAttributionStore((s) => s.clear)
  const backtrackRunId = useBacktrackingStore((s) => s.runId)
  const hasResult = useAttributionStore((s) => s.status === 'completed')
  const running = busy || status === 'running'

  return (
    <div className="toolbar-title">
      <span className="toolbar-title-label">
        <RankIcon size={14} /> Vessel Attribution
      </span>
      <span className="text-faint">
        Rank AIS traffic within the source window against the search criteria.
      </span>
      <div className="toolbar-spacer" />
      <Button
        variant="primary"
        disabled={!simulationId || running}
        onClick={() => {
          if (!simulationId) return
          void useAttributionStore.getState().run(simulationId, {
            backtrackRunId: backtrackRunId ?? undefined,
          })
        }}
      >
        {running ? 'Analysing AIS…' : 'Run AIS attribution'}
      </Button>
      {hasResult ? (
        <Button disabled={running} onClick={clear}>
          Clear result
        </Button>
      ) : null}
    </div>
  )
}

export default function Attribution() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const status = useAttributionStore((s) => s.status)
  const hasSelection = useMapStore((s) => s.selection != null)
  useSimulationConnection(simulationId)
  const layers = useAttributionLayers()
  const available: MapLayerId[] = status === 'completed' ? ['attribution'] : []

  useEffect(() => {
    void useAttributionStore.getState().loadProviders()
    if (simulationId) {
      void useAttributionStore.getState().loadRuns(simulationId)
    }
  }, [simulationId])

  useEffect(() => {
    return () => {
      useMapStore.getState().setLayer('attribution', false)
    }
  }, [])

  return (
    <MissionWorkspace
      toolbar={<Toolbar />}
      map={
        <div className="map-pane">
          <MapView layers={layers} onSelect={(s) => useMapStore.getState().select(s)}>
            <MapFurniture />
          </MapView>
          <MapLayersPanel available={available} />
          <div className="map-note">
            Ranked candidate positions with links to the estimated source — ranked, never a declaration of cause.
          </div>
        </div>
      }
      rail={
        <div className="rail-stack-inner">
          {hasSelection ? <ContextualPanel /> : <OverviewIntel />}
          <ConclusionBanner />
          <StatesPanel />
          <Panel title="Ranked Vessels">
            <RankedTable />
          </Panel>
          {(status === 'completed') ? (
            <VesselEvidence />
          ) : (
            <Panel title="Vessel Evidence">
              <EmptyState label="Awaiting scoring" hint="Ranked candidates and factor evidence appear after a run." />
            </Panel>
          )}
          <ProvenancePanel />
        </div>
      }
    />
  )
}