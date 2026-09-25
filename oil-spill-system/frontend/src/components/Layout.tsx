import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RouteTransitionBoundary } from '@/ui/motion/RouteTransitionBoundary'
import { EntryReveal } from '@/ui/motion/EntryReveal'
import { SectionEyebrow } from '@/ui/design-system'
import { useHealthProbe } from '@/hooks/useHealthProbe'
import { useConnectionStore } from '@/store/connectionStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useUtcClock } from '@/hooks/useUtcClock'
import { StatusChip } from '@/components/Status'
import { AppShell } from '@/ui/shell/AppShell'
import { useDataProvenance } from '@/ui/hooks/useDataProvenance'
import {
  BacktraceIcon,
  CommandIcon,
  DossierIcon,
  RadarIcon,
  RankIcon,
  ShipIcon,
} from '@/components/ui/Icon'

const NAV = [
  { to: '/command-center', label: 'Command center', icon: CommandIcon, code: 'CC' },
  { to: '/simulation', label: 'Fleet simulation', icon: ShipIcon, code: 'SIM' },
  { to: '/investigation', label: 'Investigation pipeline', icon: RadarIcon, code: 'INV' },
  { to: '/backtracking', label: 'Source backtracking', icon: BacktraceIcon, code: 'BCK' },
  { to: '/attribution', label: 'Vessel attribution', icon: RankIcon, code: 'ATR' },
  { to: '/report', label: 'Incident dossier', icon: DossierIcon, code: 'REP' },
]

const WORKSPACE_MAP: Record<string, { label: string; code: string }> = {
  '/command-center': { label: 'Command center', code: 'CC' },
  '/simulation': { label: 'Fleet simulation', code: 'SIM' },
  '/investigation': { label: 'Investigation pipeline', code: 'INV' },
  '/backtracking': { label: 'Source backtracking', code: 'BCK' },
  '/attribution': { label: 'Vessel attribution', code: 'ATR' },
  '/report': { label: 'Incident dossier', code: 'REP' },
}

function UtcSpineClock() {
  const iso = useUtcClock()
  const stamp = iso.slice(11, 16)
  return (
    <div className="spine-clock" title={`UTC Zulu Time: ${iso}`}>
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

/** Pages that maintain an active WebSocket stream and show stream state. */
const STREAM_PAGES = new Set(['/command-center', '/simulation', '/investigation'])

function SecondaryPageHeader({
  currentWorkspace,
  pathname,
}: {
  currentWorkspace: { label: string; code: string }
  pathname: string
}) {
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const invStatus = useInvestigationStore((s) => s.status)
  const simulationId = useSimulationStore((s) => s.simulationId)
  // Backend REST reachability — set by health probe (connections.api)
  const apiStatus = useConnectionStore((s) => s.connections.api)
  const isApiOnline = apiStatus === 'online'
  // WebSocket stream state — only meaningful on pages that open a stream
  const wsStatus = useConnectionStore((s) => s.connections.websocket)
  const showStream = STREAM_PAGES.has(pathname)
  // Data provenance — derived from explicit store provenance fields only.
  // Never inferred from connectivity or a bare simulation id.
  const provenance = useDataProvenance()

  return (
    <div className="flex items-center justify-between w-full h-full text-xs">
      <div className="flex items-center gap-2">
        <SectionEyebrow code={currentWorkspace.code} label={currentWorkspace.label} />
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
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-sans"
          title={`Data provenance: ${provenance.label}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${provenance.dotClass}`} />
          <span className={provenance.toneClass}>{provenance.label}</span>
        </div>

        {/* Backend reachability – from health probe, accurate on all pages */}
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-sans text-slate-300"
          title={`Backend: ${isApiOnline ? 'Connected' : 'Offline'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isApiOnline
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                : 'bg-rose-500'
            }`}
          />
          <span>{isApiOnline ? 'Connected' : 'Offline'}</span>
        </div>

        {/* Stream state – only pages that open a WebSocket */}
        {showStream ? (
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-sans text-slate-400"
            title={`Stream: ${wsStatus === 'online' ? 'Streaming' : 'Idle'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                wsStatus === 'online' ? 'bg-sonar animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>{wsStatus === 'online' ? 'Streaming' : 'Idle'}</span>
          </div>
        ) : null}

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
  const navigate = useNavigate()
  const location = useLocation()
  const consumedWelcomeEntry = useRef(false)
  const fromWelcome = Boolean(location.state?.fromWelcome)

  // Consume the welcome -> command-center entry flag exactly once so a
  // refresh, back/forward, or any ordinary internal navigation can never
  // re-trigger the one-shot EntryReveal.
  useEffect(() => {
    if (location.state?.fromWelcome === true && !consumedWelcomeEntry.current) {
      consumedWelcomeEntry.current = true
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  const isCommandCenter = location.pathname === '/command-center'
  const isTheater = location.pathname !== '/report'
  const currentWorkspace = WORKSPACE_MAP[location.pathname] ?? { label: 'Workspace', code: 'WS' }
  const pathname = location.pathname

  return (
    <EntryReveal active={fromWelcome}>
      <AppShell
        isTheater={isTheater}
        spine={
          /*
           * The command center owns its own full-height labelled sidebar, so
           * the 56px icon spine is suppressed there to avoid two competing
           * left rails. Every other workspace keeps the spine.
           */
          isCommandCenter ? null : (
          <div className="flex flex-col items-center h-full w-full py-2.5" aria-label="Operational Navigation Spine">
          {/* Brand Emblem */}
          <div className="spine-brand">
            <NavLink to="/command-center" className="spine-brand-link" title="OilGuard Maritime Command Center">
              <span className="spine-brand-glyph" aria-hidden="true">◈</span>
              <span className="spine-brand-beacon" aria-hidden="true" />
            </NavLink>
          </div>

          {/* Route Action Group */}
          <nav className="spine-nav-group" aria-label="Workstation primary routes">
            {NAV.map(({ to, label, icon: RailIcon, code }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/command-center'}
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
          </nav>

          <div className="spine-spacer flex-1" />

          {/* Spine Operational Telemetry Footer */}
          <div className="spine-footer">
            <UtcSpineClock />
            <SpineHealthMonitor />
          </div>
        </div>
          )
        }
      operationalBar={
        !isCommandCenter ? (
          <SecondaryPageHeader currentWorkspace={currentWorkspace} pathname={pathname} />
        ) : null
      }
    >
      <RouteTransitionBoundary>
        <Outlet />
      </RouteTransitionBoundary>
      </AppShell>
    </EntryReveal>
  )
}