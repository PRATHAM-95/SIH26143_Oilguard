import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useHealthProbe } from '@/hooks/useHealthProbe'
import { useConnectionStore } from '@/store/connectionStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { StatusChip } from '@/components/Status'
import {
  BacktraceIcon,
  CommandIcon,
  DossierIcon,
  RadarIcon,
  RankIcon,
  ShipIcon,
} from '@/components/ui/Icon'

const NAV = [
  { to: '/', label: 'Command Center', icon: CommandIcon },
  { to: '/simulation', label: 'Simulation', icon: ShipIcon },
  { to: '/investigation', label: 'Investigation', icon: RadarIcon },
  { to: '/backtracking', label: 'Backtracking', icon: BacktraceIcon },
  { to: '/attribution', label: 'Attribution', icon: RankIcon },
  { to: '/report', label: 'Report', icon: DossierIcon },
]

function UtcClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  return (
    <div className="clock-readout" title="UTC (Zulu)">
      {stamp} Z
    </div>
  )
}

function IncidentContext() {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const status = useInvestigationStore((s) => s.status)
  if (!investigationId) {
    return (
      <div className="cmd-ctx">
        <span className="cmd-ctx-label">Investigation</span>
        <span className="cmd-ctx-value">—</span>
      </div>
    )
  }
  const short = investigationId.length > 16 ? `${investigationId.slice(0, 16)}…` : investigationId
  const tone =
    status === 'COMPLETED'
      ? 'ok'
      : status === 'FAILED' || status === 'CANCELLED'
        ? 'danger'
        : status === 'RUNNING'
          ? 'run'
          : status
            ? 'warn'
            : 'idle'
  return (
    <div className="cmd-ctx">
      <span className="cmd-ctx-label">Investigation</span>
      <span className="cmd-ctx-value">{short}</span>
      <StatusChip tone={tone} label={status?.toUpperCase() ?? '—'}>
        {status ?? '—'}
      </StatusChip>
    </div>
  )
}

function HeaderStatus() {
  const connections = useConnectionStore((s) => s.connections)

  const apiTone =
    connections.api === 'offline' ? 'danger' : connections.api === 'online' ? 'ok' : 'idle'
  const mongoTone =
    connections.mongo === 'offline' ? 'danger' : connections.mongo === 'online' ? 'ok' : 'idle'
  const pythonTone =
    connections.python === 'offline' ? 'warn' : connections.python === 'online' ? 'ok' : 'idle'
  const wsTone = connections.websocket === 'online' ? 'ok' : 'idle'

  return (
    <div className="header-status">
      {/* Health cluster */}
      <div className="header-health" aria-label="System health">
        <StatusChip tone={apiTone} label="API">API</StatusChip>
        <StatusChip tone={mongoTone} label="DB">DB</StatusChip>
        <StatusChip tone={pythonTone} label="SCI">SCI</StatusChip>
      </div>
      <span className="header-sep" aria-hidden="true" />
      {/* Operational cluster */}
      <StatusChip tone={wsTone} label="Live updates">LIVE</StatusChip>
      <UtcClock />
      <NavLink className="header-link" to="/report">
        <DossierIcon size={12} />
        Dossier
      </NavLink>
    </div>
  )
}

export default function Layout() {
  useHealthProbe()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◈
          </span>
          <span>
            <div className="brand-name">MARITIME OIL SPILL INTELLIGENCE</div>
            <div className="brand-sub">SIH 26143 · SYSTEM</div>
          </span>
        </div>
        <IncidentContext />
        <HeaderStatus />
      </header>
      <nav className="tool-rail" aria-label="Primary">
        {NAV.map(({ to, label, icon: RailIcon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            aria-label={label}
            className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}
          >
            <RailIcon size={18} />
          </NavLink>
        ))}
        <div className="rail-spacer" />
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}