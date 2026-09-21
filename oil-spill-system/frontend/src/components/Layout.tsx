import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useHealthProbe } from '@/hooks/useHealthProbe'
import { useConnectionStore } from '@/store/connectionStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { StatusChip } from '@/components/Status'
import { AppShell } from '@/ui/shell/AppShell'
import {
  BacktraceIcon,
  CommandIcon,
  DossierIcon,
  RadarIcon,
  RankIcon,
  ShipIcon,
} from '@/components/ui/Icon'

const NAV = [
  { to: '/', label: 'Command center', icon: CommandIcon, code: 'CC' },
  { to: '/simulation', label: 'Fleet simulation', icon: ShipIcon, code: 'SIM' },
  { to: '/investigation', label: 'Investigation pipeline', icon: RadarIcon, code: 'INV' },
  { to: '/backtracking', label: 'Source backtracking', icon: BacktraceIcon, code: 'BCK' },
  { to: '/attribution', label: 'Vessel attribution', icon: RankIcon, code: 'ATR' },
  { to: '/report', label: 'Incident dossier', icon: DossierIcon, code: 'REP' },
]

const WORKSPACE_MAP: Record<string, { label: string; code: string }> = {
  '/': { label: 'Command center', code: 'CC' },
  '/simulation': { label: 'Fleet simulation', code: 'SIM' },
  '/investigation': { label: 'Investigation pipeline', code: 'INV' },
  '/backtracking': { label: 'Source backtracking', code: 'BCK' },
  '/attribution': { label: 'Vessel attribution', code: 'ATR' },
  '/report': { label: 'Incident dossier', code: 'REP' },
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
  const simulationMode = useSimulationStore((s) => s.mode)
  const wsStatus = useConnectionStore((s) => s.connections.websocket)
  const isConnected = wsStatus === 'online'

  let provenanceLabel = 'No data'
  let provenanceTone = 'text-dim'
  let provenanceDot = 'bg-slate-500'

  if (simulationId) {
    if (simulationMode === 'captain') {
      provenanceLabel = 'Simulated'
      provenanceTone = 'text-amber-400'
      provenanceDot = 'bg-amber-400'
    } else {
      provenanceLabel = 'Controlled'
      provenanceTone = 'text-cyan-400'
      provenanceDot = 'bg-cyan-400'
    }
  }

  return (
    <div className="flex items-center justify-between w-full h-full text-xs">
      <div className="flex items-center gap-2">
        <span className="text-sonar text-sm" aria-hidden="true">◈</span>
        <div className="flex flex-col">
          <span className="font-sans font-medium text-foam text-[11px] leading-tight">
            {currentWorkspace.label}
          </span>
          <span className="text-[8px] tracking-wider text-dim">OilGuard maritime intelligence</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {investigationId ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-deck border border-chartline rounded text-[10px]">
            <span className="text-dim font-medium">Inv:</span>
            <span className="font-mono text-foam">{investigationId.slice(0, 12)}…</span>
            <StatusChip tone={invStatus === 'COMPLETED' ? 'ok' : 'run'} size="sm">
              {invStatus}
            </StatusChip>
          </div>
        ) : simulationId ? (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-deck border border-chartline rounded text-[10px]">
            <span className="text-dim font-medium">Case:</span>
            <span className="font-mono text-foam">{simulationId.slice(0, 12)}…</span>
          </div>
        ) : null}

        {/* Data Provenance Indicator */}
        <div className="inline-flex items-center gap-1.5 text-[11px] font-sans" title={`Data provenance: ${provenanceLabel}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${provenanceDot}`} />
          <span className={provenanceTone}>{provenanceLabel}</span>
        </div>

        {/* Connection State */}
        <div className="inline-flex items-center gap-1.5 text-[11px] font-sans text-slate-300" title={`Connection: ${isConnected ? 'Connected' : 'Offline'}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-rose-500'}`} />
          <span>{isConnected ? 'Connected' : 'Offline'}</span>
        </div>

        <NavLink to="/report" className="subpage-dossier-link" title="Open Forensic Incident Dossier">
          <DossierIcon size={13} />
          <span>Dossier</span>
        </NavLink>
      </div>
    </div>
  )
}

export default function Layout() {
  useHealthProbe()
  const location = useLocation()
  const isCommandCenter = location.pathname === '/'
  const isTheater = location.pathname !== '/report'
  const currentWorkspace = WORKSPACE_MAP[location.pathname] ?? { label: 'Workspace', code: 'WS' }

  return (
    <AppShell
      isTheater={isTheater}
      spine={
        <div className="flex flex-col items-center h-full w-full py-2.5" aria-label="Operational Navigation Spine">
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

          <div className="spine-spacer flex-1" />

          {/* Spine Operational Telemetry Footer */}
          <div className="spine-footer">
            <UtcSpineClock />
            <SpineHealthMonitor />
          </div>
        </div>
      }
      operationalBar={
        !isCommandCenter ? (
          <SecondaryPageHeader currentWorkspace={currentWorkspace} />
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  )
}