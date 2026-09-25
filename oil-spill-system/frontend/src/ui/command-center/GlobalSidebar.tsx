import { useLocation, useNavigate } from 'react-router-dom'
import {
  CommandIcon,
  CompassIcon,
  DossierIcon,
  RadarIcon,
  ShipIcon,
  type IconProps,
} from '@/components/ui/Icon'
import { useUiStore } from '@/store/uiStore'

/**
 * Global application rail.
 *
 * Navigation is honest about what exists: every enabled entry routes to a real
 * route and drives real UI state. `SETTINGS` has no destination in this build
 * and is rendered disabled rather than pointing at a dead route.
 */

type RailIcon = (p: IconProps) => React.ReactNode

/** Gear glyph — the shared icon set has no settings mark. */
function GearIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </svg>
  )
}

type RailItem = {
  key: string
  label: string
  icon: RailIcon
  /** Route to open, or null when the entry only drives panel state. */
  to: string | null
  tab?: 'quick' | 'simulation' | 'vessels' | 'reports'
  enabled: boolean
}

const ITEMS: RailItem[] = [
  { key: 'home', label: 'Home', icon: CommandIcon, to: '/command-center', tab: 'quick', enabled: true },
  { key: 'incidents', label: 'Incidents', icon: RadarIcon, to: '/command-center', tab: 'quick', enabled: true },
  { key: 'vessels', label: 'Vessels', icon: ShipIcon, to: '/command-center', tab: 'vessels', enabled: true },
  { key: 'analytics', label: 'Analytics', icon: CompassIcon, to: '/command-center', tab: 'simulation', enabled: true },
  { key: 'reports', label: 'Reports', icon: DossierIcon, to: '/report', enabled: true },
  { key: 'settings', label: 'Settings', icon: GearIcon, to: null, enabled: false },
]

export function GlobalSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab)
  const setPanelCollapsed = useUiStore((s) => s.setPanelCollapsed)

  const onCommandCenter = location.pathname.endsWith('/command-center')

  const activate = (item: RailItem) => {
    if (!item.enabled) return
    if (item.to && item.to !== '/command-center') {
      navigate(item.to)
      return
    }
    if (item.tab) {
      setRightPanelTab(item.tab)
      setPanelCollapsed(false)
    }
    if (item.to) navigate(item.to)
  }

  return (
    <nav className="cc-rail" aria-label="Global">
      {ITEMS.map((item) => {
        const IconGlyph = item.icon
        const current =
          item.enabled &&
          ((item.to === '/command-center' && onCommandCenter) ||
            (item.to === '/report' && location.pathname.endsWith('/report')))

        return (
          <button
            key={item.key}
            type="button"
            className="cc-rail-item"
            aria-current={current ? 'page' : undefined}
            disabled={!item.enabled}
            title={
              item.enabled
                ? item.label
                : 'Settings are not part of this build — no destination exists yet'
            }
            onClick={() => activate(item)}
          >
            <IconGlyph size={19} />
            <span className="cc-rail-label">{item.label}</span>
          </button>
        )
      })}
      <div className="cc-rail-spacer" />
    </nav>
  )
}
