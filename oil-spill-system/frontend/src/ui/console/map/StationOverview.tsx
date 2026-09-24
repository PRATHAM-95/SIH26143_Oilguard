import { type ReactNode } from 'react'
import {
  StatusBadge,
  type OperationalStatusTone,
} from '@/ui/design-system'
import type {
  SimulationStatus,
  InvestigationStageStatus,
} from '@/types/domain'
import {
  MAP_LAYER_CATALOG,
  LAYER_GROUP_ORDER,
  LAYER_GROUP_LABEL,
  useMapStore,
  type MapLayerId,
} from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useConnectionStore } from '@/store/connectionStore'
import { useInvestigationStore, STAGE_ORDER } from '@/store/investigationStore'
import { useEezStore } from '@/store/eezStore'
import { useWeatherStore } from '@/store/weatherStore'
import { useIncidentFeedStore } from '@/store/incidentFeedStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import '@/styles/station-overview.css'

type Tone = OperationalStatusTone

const connTone = (s: string): Tone =>
  s === 'online' ? 'ok' : s === 'offline' ? 'danger' : 'idle'

const feedTone = (s: string): Tone =>
  s === 'available'
    ? 'ok'
    : s === 'fetching' || s === 'loading' || s === 'processing' || s === 'running'
      ? 'run'
      : s === 'unavailable' || s === 'failed'
        ? 'danger'
        : 'idle'

const simTone = (s: SimulationStatus | null): Tone =>
  s === 'completed'
    ? 'ok'
    : s === 'observation'
      ? 'warn'
      : s === 'simulating' || s === 'captain_mode' || s === 'investigation'
        ? 'run'
        : 'idle'

const stageTone = (s: InvestigationStageStatus): Tone =>
  s === 'completed'
    ? 'ok'
    : s === 'running'
      ? 'run'
      : s === 'failed'
        ? 'danger'
        : 'idle'

function fmtLonLat(lon: number, lat: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(3)}°${latDir} · ${Math.abs(lon).toFixed(3)}°${lonDir}`
}

function fmtTs(ts: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts.slice(0, 19).replace('T', ' ')
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="so-row">
      <span className="so-k">{k}</span>
      <span className="so-v">{v}</span>
    </div>
  )
}

function Dots({ statuses }: { statuses: InvestigationStageStatus[] }) {
  return (
    <div className="so-dots" aria-hidden="true">
      {statuses.map((s, i) => (
        <span key={i} className={`so-dot so-dot--${stageTone(s)}`} />
      ))}
    </div>
  )
}

function Card({
  code,
  label,
  trailing,
  children,
}: {
  code: string
  label: string
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="so-card" aria-label={label}>
      <div className="so-card-head">
        <span className="so-eye">
          <span className="so-eye-code">{code}</span>
          <span className="so-eye-label">{label}</span>
        </span>
        {trailing}
      </div>
      <div className="so-card-body">{children}</div>
    </section>
  )
}

/**
 * M11 Phase 2 — Command Center station overview. The map is closed by default;
 * this restrained register deck is the landing surface. Strictly read-only: it
 * renders only verified state from the existing domain stores, never derives
 * outcomes, and carries no navigation/controls (stage navigation stays in the
 * FlightpathRail / Contextual Console).
 */
export function StationOverview() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const simStatus = useSimulationStore((s) => s.status)
  const clock = useSimulationStore((s) => s.clock)
  const vesselCount = useSimulationStore((s) => s.vessels.length)
  const spill = useSimulationStore((s) => s.spill)
  const driftStatus = useSimulationStore((s) => s.drift.status)
  const driftParticles = useSimulationStore((s) => s.drift.particles.length)

  const connections = useConnectionStore((s) => s.connections)
  const lastApiCheck = useConnectionStore((s) => s.lastApiCheck)

  const invStatus = useInvestigationStore((s) => s.status)
  const invStages = useInvestigationStore((s) => s.stages)

  const eezStatus = useEezStore((s) => s.status)
  const eezFeatureCount = useEezStore((s) => s.featureCount)
  const weatherStatus = useWeatherStore((s) => s.status)
  const incidentStatus = useIncidentFeedStore((s) => s.status)
  const incidentEventCount = useIncidentFeedStore((s) => s.feed?.events?.length ?? null)

  const sarStatus = useSarStore((s) => s.status)
  const sarCandidates = useSarStore((s) => s.candidates.length)
  const sarSlickAreaKm2 = useSarStore((s) => s.slickAreaKm2)
  const sarAcquisitionTime = useSarStore((s) => s.acquisitionTime)

  const btStatus = useBacktrackingStore((s) => s.status)
  const btOriginTime = useBacktrackingStore((s) => s.originTime)
  const btConfidence = useBacktrackingStore((s) => s.confidence)

  const attStatus = useAttributionStore((s) => s.status)
  const attRanked = useAttributionStore((s) => s.ranked)
  const attVesselCount = useAttributionStore((s) => s.vessels.length)

  const visibility = useMapStore((s) => s.visibility)
  const basemap = useMapStore((s) => s.basemap)

  const stageStatuses = STAGE_ORDER.map((id) => {
    const st = invStages.find((x) => x.stageId === id)
    return st ? st.status : 'pending'
  })
  const completedCount = stageStatuses.filter((s) => s === 'completed').length

  const spillHasLocation = Boolean(spill?.location)
  const spillPos = spill?.location
    ? fmtLonLat(spill.location.lon, spill.location.lat)
    : '—'
  const spillQty = spill?.quantityKg != null ? `${spill.quantityKg.toLocaleString()} kg` : '—'
  const spillType = spill?.type ?? 'SPILL'
  const spillWait = spill ? clock ?? '—' : '—'

  const connRows: { key: string; kind: string; status: string }[] = [
    { key: 'api', kind: 'API', status: connections.api },
    { key: 'websocket', kind: 'WEBSOCKET', status: connections.websocket },
    { key: 'mongo', kind: 'MONGO', status: connections.mongo },
    { key: 'python', kind: 'PYTHON', status: connections.python },
  ]

  const feedRows = [
    {
      kind: 'EEZ',
      state: eezStatus,
      detail: eezStatus === 'available' ? `${eezFeatureCount} boundaries` : 'fetched on demand',
    },
    {
      kind: 'WEATHER',
      state: weatherStatus,
      detail: weatherStatus === 'available' ? 'live · Open-Meteo' : 'no live data — never faked',
    },
    {
      kind: 'INCIDENTS',
      state: incidentStatus,
      detail:
        incidentStatus === 'available' ? `${incidentEventCount ?? 0} events · EONET` : 'no live incidents — never faked',
    },
  ]

  const posture = LAYER_GROUP_ORDER.map((g) => {
    const entries = Object.entries(MAP_LAYER_CATALOG).filter(([, meta]) => meta.group === g)
    const on = entries.filter(([id]) => visibility[id as MapLayerId]).length
    return { g, on, total: entries.length }
  })

  return (
    <div className="so-root">
      <div className="so-scroll">
        <div className="so-grid">
          <Card code="SIM" label="Scenario & spill">
            <Row k="SIMULATION" v={<StatusBadge tone={simTone(simStatus)}>{simStatus?.toUpperCase() ?? 'NONE'}</StatusBadge>} />
            <Row k="SIM ID" v={simulationId ?? '—'} />
            <Row k="CLOCK" v={clock ?? '—'} />
            <Row k="TRACKED VESSELS" v={String(vesselCount)} />
            <Row k="SPILL" v={spillHasLocation ? spillType : 'NO SPILL RELEASED'} />
            {spillHasLocation && (
              <>
                <Row k="POSITION" v={spillPos} />
                <Row k="QUANTITY · TYPE" v={`${spillQty} · ${spill?.oilType ?? '—'}`} />
                <Row k="SPILL TIME" v={spillWait} />
              </>
            )}
            {driftStatus !== 'idle' && (
              <Row k="FORWARD DRIFT" v={`${driftStatus} · ${driftParticles} particles`} />
            )}
          </Card>

          <Card code="LNK" label="Live connections">
            {connRows.map(({ kind, status }) => (
              <Row key={kind} k={kind} v={<StatusBadge tone={connTone(status)}>{status.toUpperCase()}</StatusBadge>} />
            ))}
            <Row k="LAST API CHECK" v={fmtTs(lastApiCheck)} />
          </Card>

          <Card
            code="INV"
            label="Investigation pipeline"
            trailing={<>
              <span className="so-code">{completedCount}/{STAGE_ORDER.length} COMPLETE</span>
            </>}
          >
            <Dots statuses={stageStatuses} />
            <div className="so-note">
              {invStatus ? `INVESTIGATION ${invStatus}` : 'NO INVESTIGATION IN PROGRESS'}
            </div>
          </Card>

          <Card code="ENV" label="Environment & feeds">
            {feedRows.map(({ kind, state }) => (
              <Row key={kind} k={kind} v={<StatusBadge tone={feedTone(state)}>{state.toUpperCase()}</StatusBadge>} />
            ))}
            <div className="so-note">{feedRows.map((r) => r.detail).join(' · ')}</div>
          </Card>

          <Card code="ANL" label="Derived analysis">
            <Row k="SAR" v={<StatusBadge tone={feedTone(sarStatus)}>{sarStatus.toUpperCase()}</StatusBadge>} />
            <Row k="CANDIDATES" v={String(sarCandidates)} />
            <Row k="SLICK AREA" v={sarSlickAreaKm2 != null ? `${sarSlickAreaKm2.toFixed(2)} km²` : '—'} />
            <Row k="ACQUISITION" v={fmtTs(sarAcquisitionTime)} />
            <Row k="BACKTRACK" v={<StatusBadge tone={feedTone(btStatus)}>{btStatus.toUpperCase()}</StatusBadge>} />
            <Row k="ORIGIN TIME" v={fmtTs(btOriginTime)} />
            <Row k="CONFIDENCE" v={btConfidence != null ? `${btConfidence.toFixed(2)}` : '—'} />
            <Row k="ATTRIBUTION" v={<StatusBadge tone={feedTone(attStatus)}>{attStatus.toUpperCase()}</StatusBadge>} />
            <Row k="RANKED VESSELS" v={attRanked ? String(attVesselCount) : '—'} />
          </Card>

          <Card code="MAP" label="Map posture">
            {posture.map(({ g, on, total }) => (
              <Row key={g} k={LAYER_GROUP_LABEL[g].toUpperCase()} v={`${on}/${total} ACTIVE`} />
            ))}
            <Row k="BASEMAP" v={basemap === 'satellite' ? 'SATELLITE' : 'DARK'} />
            <div className="so-note">select OPEN MAP to inspect the operation</div>
          </Card>
        </div>

        <div className="so-foot">
          <span className="so-k">STATION OVERVIEW · READ-ONLY · PRESENTATION STATE FROM LIVE STORES</span>
        </div>
      </div>
    </div>
  )
}