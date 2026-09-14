import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { KeyValue } from '@/components/ui/Panel'
import { StatusChip } from '@/components/Status'
import { Disclaimer, fmtLatLng } from '@/components/ui/primitives'
import { useMapStore } from '@/store/mapStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import {
  stageRankedVessels,
  stageOrigin,
  stageUncertaintyKm,
} from '@/components/map/InvestigationMap'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useSarStore } from '@/store/sarStore'
import { ChevronDownIcon, CloseIcon } from '@/components/ui/Icon'

/**
 * Intelligence rail primitives — the adaptive right-hand panel of the
 * command workspace. `IntelShell` frames any detail view; `Channel` gives a
 * collapsible secondary section.
 */

export function IntelShell({
  eyebrow,
  title,
  actions,
  children,
  empty,
}: {
  eyebrow: string
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  empty?: { label: string; hint?: string }
}) {
  return (
    <section className="intel">
      <header className="intel-head">
        <div className="intel-head-main">
          <span className="intel-eyebrow">{eyebrow}</span>
          <h2 className="intel-title">{title}</h2>
        </div>
        {actions ? <div className="intel-actions">{actions}</div> : null}
      </header>
      <div className="intel-body">
        {empty ? (
          <div className="intel-empty">
            <div>
              <div className="empty-label">{empty.label}</div>
              {empty.hint ? <div className="text-faint">{empty.hint}</div> : null}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export function IntelClearButton() {
  return (
    <button
      type="button"
      className="icon-btn"
      title="Clear selection"
      aria-label="Clear selection"
      onClick={() => useMapStore.getState().clearSelection()}
    >
      <CloseIcon size={13} />
    </button>
  )
}

export function Channel({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="channel" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="channel-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        {count != null ? <span className="channel-count">{count}</span> : null}
        <span className="chev" aria-hidden="true">
          <ChevronDownIcon size={13} />
        </span>
      </button>
      {open ? <div className="channel-body">{children}</div> : null}
    </section>
  )
}

/**
 * Overview intelligence — shown while nothing on the map is selected.
 * Designed to make the operating picture clear in seconds: what is happening,
 * what the verdict is, what tools are live.
 */
export function OverviewIntel() {
  const simId = useSimulationStore((s) => s.simulationId)
  const clock = useSimulationStore((s) => s.clock)
  const vessels = useSimulationStore((s) => s.vessels)
  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)

  const invStatus = useInvestigationStore((s) => s.status)
  const invProgress = useInvestigationStore((s) => s.progress)
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const stages = useInvestigationStore((s) => s.stages)

  const env = useEnvironmentStore((s) => s.current)
  const wind = useEnvironmentStore((s) => s.wind)
  const sar = useSarStore((s) => s)

  const ranked = stageRankedVessels(stages)
  const top = ranked[0]
  const origin = stageOrigin(stages)
  const uncertainty = stageUncertaintyKm(stages)

  const clockLabel = clock
    ? new Date(clock).toISOString().slice(0, 19).replace('T', ' ').replace('Z', '')
    : '—'

  const invTone =
    invStatus === 'COMPLETED'
      ? 'ok'
      : invStatus === 'FAILED' || invStatus === 'CANCELLED'
        ? 'danger'
        : invStatus === 'RUNNING' || invStatus === 'CREATED'
          ? 'run'
          : 'idle'

  return (
    <IntelShell
      eyebrow="Situation Overview"
      title="Command Center"
      actions={
        <Link to="/report" className="header-link">
          Full dossier
        </Link>
      }
    >
      <IntelSection label="Operating picture">
        <div className="stat-list">
          <div className="stat-row">
            <span className="stat-label">Simulation</span>
            <span className="stat-value">{simId ? simId.slice(0, 10) + '…' : '—'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Sim clock</span>
            <span className="stat-value stat--accent">{clockLabel}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Fleet</span>
            <span className="stat-value">{vessels.length} vessels</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Spill event</span>
            <span className="stat-value">{spill?.spillEventId ? 'released' : 'none'}</span>
          </div>
        </div>
        {drift.status === 'completed' || drift.status === 'running' ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="field-label">Forward drift</span>
            <StatusChip
              tone={drift.status === 'completed' ? 'ok' : 'run'}
              label={drift.status}
            />
          </div>
        ) : null}
      </IntelSection>

      <IntelSection
        label="Investigation"
        hint={
          invStatus ? `${Math.round((invProgress ?? 0) * 100)}%` : undefined
        }
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="field-label">Pipeline</span>
          <StatusChip tone={invTone} label={invStatus ?? 'Not started'} />
        </div>
        {invStatus === 'CREATED' || invStatus === 'RUNNING' ? (
          <div className="dock-progress-track" style={{ width: '100%' }}>
            <span
              className="dock-progress-fill"
              style={{ width: `${Math.round((invProgress ?? 0) * 100)}%` }}
            />
          </div>
        ) : null}
        {conclusion?.status ? (
          <div
            className={`verdict-card ${
              conclusion.status === 'candidate'
                ? 'verdict-card--warn'
                : conclusion.status === 'inconclusive'
                  ? 'verdict-card--ok'
                  : 'verdict-card--danger'
            }`}
          >
            <span className="verdict-card-title">
              {conclusion.status === 'candidate' ? 'Candidate identified' : 'Inconclusive'}
            </span>
            {conclusion.candidate && typeof conclusion.candidate === 'object' ? (
              <span className="text-dim">
                {String(
                  (conclusion.candidate as Record<string, unknown>).mmsi ??
                    (conclusion.candidate as Record<string, unknown>).name ??
                    '—',
                )}
              </span>
            ) : (
              <span className="text-faint">{conclusion.reason ?? 'No decisive ranking.'}</span>
            )}
          </div>
        ) : null}
      </IntelSection>

      {top ? (
        <IntelSection label="Source & ranking">
          <div className="stack" style={{ gap: 6 }}>
            {origin ? (
              <KeyValue
                label="Estimated origin"
                value={`${fmtLatLng(origin)}${uncertainty != null ? ` · ±${uncertainty.toFixed(1)} km` : ''}`}
              />
            ) : null}
            <div className="evidence-row">
              <span className="rank-badge rank--1">#{top.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="evidence-label">{top.name ?? 'Unnamed vessel'}</div>
                <div className="evidence-value">
                  score {top.score != null ? `${(top.score * 100).toFixed(1)}%` : '—'} ·{' '}
                  {top.minDistanceKm != null ? `${top.minDistanceKm.toFixed(1)} km from source` : 'distance n/a'}
                </div>
              </div>
            </div>
            <Disclaimer>
              Highest-<strong>ranked candidate</strong> — a ranking, never a confirmed culprit.
            </Disclaimer>
          </div>
        </IntelSection>
      ) : null}

      <IntelSection label="Data sources">
        <div className="stat-list">
          <div className="stat-row">
            <span className="stat-label">SAR</span>
            <span className={`stat-value ${sar.provenance === 'UNAVAILABLE' ? 'stat--warn' : sar.provenance ? 'stat--ok' : ''}`}>
              {sar.candidates.length > 0
                ? `${sar.candidates.length} candidates`
                : sar.provenance
                  ? 'scene available'
                  : 'not run'}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Currents</span>
            <span className="stat-value">{env.status === 'available' ? 'online' : env.status === 'awaiting' ? 'no data' : 'no data'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Wind</span>
            <span className="stat-value">{wind.status === 'available' ? 'online' : 'no data'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">AIS</span>
            <span className="stat-value">{ranked.length > 0 ? `${ranked.length} ranked` : 'no data'}</span>
          </div>
        </div>
        <div className="text-faint" style={{ fontSize: '10px', lineHeight: 1.4 }}>
          Sources without live credentials report "no data" and are never populated
          with simulated substitutes.
        </div>
      </IntelSection>

      {simId ? (
        <IntelSection label="Mission links">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Link className="chip-btn" to="/simulation">
              Captain Mode
            </Link>
            <Link className="chip-btn" to="/investigation">
              Investigation
            </Link>
            <Link className="chip-btn" to="/backtracking">
              Backtracking
            </Link>
            <Link className="chip-btn" to="/attribution">
              Attribution
            </Link>
          </div>
        </IntelSection>
      ) : (
        <IntelSection label="Next step">
          <div className="empty">
            <span className="empty-label">No simulation in flight</span>
            <span className="text-faint">
              Open <Link className="link-btn" to="/simulation">Captain Mode</Link> to seed a
              scenario, then release a spill to generate an incident.
            </span>
          </div>
        </IntelSection>
      )}
    </IntelShell>
  )
}

export function IntelSection({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="intel-section">
      <div className="intel-section-head">
        <span>{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

export function ProvenanceFooter({ extra }: { extra?: ReactNode }) {
  return (
    <Disclaimer>
      Map layers and figures reflect live investigation state. Demo/controlled
      data is always labelled. {extra}
    </Disclaimer>
  )
}