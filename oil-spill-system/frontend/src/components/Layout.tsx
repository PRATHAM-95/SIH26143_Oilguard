import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useHealthProbe } from '@/hooks/useHealthProbe'
import { useConnectionStore } from '@/store/connectionStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
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
  { to: '/', label: 'Command Center', icon: CommandIcon, code: 'CC' },
  { to: '/simulation', label: 'Fleet Simulation', icon: ShipIcon, code: 'SIM' },
  { to: '/investigation', label: 'Investigation Pipeline', icon: RadarIcon, code: 'INV' },
  { to: '/backtracking', label: 'Source Backtracking', icon: BacktraceIcon, code: 'BCK' },
  { to: '/attribution', label: 'Vessel Attribution', icon: RankIcon, code: 'ATR' },
  { to: '/report', label: 'Incident Dossier', icon: DossierIcon, code: 'REP' },
]

const WORKSPACE_MAP: Record<string, { label: string; code: string }> = {
  '/': { label: 'Command Center', code: 'CC' },
  '/simulation': { label: 'Fleet Simulation', code: 'SIM' },
  '/investigation': { label: 'SAR Pipeline', code: 'INV' },
  '/backtracking': { label: 'Source Backtracking', code: 'BCK' },
  '/attribution': { label: 'Vessel Attribution', code: 'ATR' },
  '/report': { label: 'Incident Dossier', code: 'REP' },
}

function UtcSpineClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const stamp = now.toISOString().slice(11, 16)
  return (
    <div className="spine-clock" title={`UTC Zulu Time: ${now.toISOString()}`}>
      <span className="spine-clock-val">{stamp}Z</span>
    </div>
  )
}

function SpineHealthMonitor() {
  const connections = useConnectionStore((s) => s.connections)

  const apiTone =
    connections.api === 'offline' ? 'danger' : connections.api === 'online' ? 'ok' : 'idle'
  const mongoTone =
    connections.mongo === 'offline' ? 'danger' : connections.mongo === 'online' ? 'ok' : 'idle'
  const pythonTone =
    connections.python === 'offline' ? 'warn' : connections.python === 'online' ? 'ok' : 'idle'

  return (
    <div
      className="spine-health-cluster"
      title={`Services: API (${connections.api}), DB (${connections.mongo}), SCI (${connections.python})`}
    >
      <span className={`spine-dot spine-dot--${apiTone}`} />
      <span className={`spine-dot spine-dot--${mongoTone}`} />
      <span className={`spine-dot spine-dot--${pythonTone}`} />
    </div>
  )
}

function SecondaryPageHeader({ currentWorkspace }: { currentWorkspace: { label: string; code: string } }) {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const invStatus = useInvestigationStore((s) => s.status)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const wsStatus = useConnectionStore((s) => s.connections.websocket)

  return (
    <header className="subpage-header">
      <div className="subpage-brand">
        <span className="subpage-mark" aria-hidden="true">◈</span>
        <div className="subpage-titles">
          <span className="subpage-title">{currentWorkspace.label}</span>
          <span className="subpage-sub">OILGUARD MARITIME INTELLIGENCE</span>
        </div>
      </div>

      <div className="subpage-context">
        {investigationId ? (
          <div className="subpage-ctx-pill">
            <span className="ctx-kicker">INV:</span>
            <span className="ctx-id">{investigationId.slice(0, 12)}…</span>
            <StatusChip tone={invStatus === 'COMPLETED' ? 'ok' : 'run'} size="sm">
              {invStatus}
            </StatusChip>
          </div>
        ) : simulationId ? (
          <div className="subpage-ctx-pill">
            <span className="ctx-kicker">CASE:</span>
            <span className="ctx-id">{simulationId.slice(0, 12)}…</span>
          </div>
        ) : null}

        <StatusChip tone={wsStatus === 'online' ? 'ok' : 'idle'} size="sm">
          LIVE
        </StatusChip>

        <NavLink to="/report" className="subpage-dossier-link" title="Open Forensic Incident Dossier">
          <DossierIcon size={13} />
          <span>Dossier</span>
        </NavLink>
      </div>
    </header>
  )
}

export default function Layout() {
  useHealthProbe()
  const location = useLocation()
  const isCommandCenter = location.pathname === '/'
  const currentWorkspace = WORKSPACE_MAP[location.pathname] ?? { label: 'Workspace', code: 'WS' }

  return (
    <div className={`app-shell ${isCommandCenter ? 'app-shell--theater' : 'app-shell--subpage'}`}>
      {/* 1. Integrated Operational Command Spine (Left Navigation) */}
      <nav className="command-spine" aria-label="Operational Navigation Spine">
        {/* Brand Emblem */}
        <div className="spine-brand">
          <NavLink to="/" className="spine-brand-link" title="OilGuard Maritime Command Center">
            <span className="spine-brand-glyph" aria-hidden="true">◈</span>
            <span className="spine-brand-beacon" aria-hidden="true" />
          </NavLink>
        </div>

        {/* Route Action Group */}
        <div className="spine-nav-group" role="menubar">
          {NAV.map(({ to, label, icon: RailIcon, code }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              aria-label={label}
              className={({ isActive }) => `spine-nav-item ${isActive ? 'spine-nav-item--active' : ''}`}
            >
              <RailIcon size={19} />
              <span className="spine-tooltip" role="tooltip">
                <span className="tooltip-code">{code}</span>
                <span className="tooltip-label">{label}</span>
              </span>
            </NavLink>
          ))}
        </div>

        <div className="spine-spacer" />

        {/* Spine Operational Telemetry Footer */}
        <div className="spine-footer">
          <UtcSpineClock />
          <SpineHealthMonitor />
        </div>
      </nav>

      {/* 2. Main Workspace Body */}
      <div className="app-workspace-body">
        {!isCommandCenter ? (
          <SecondaryPageHeader currentWorkspace={currentWorkspace} />
        ) : null}

        <main className={`app-main ${isCommandCenter ? 'app-main--theater' : 'app-main--subpage'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}