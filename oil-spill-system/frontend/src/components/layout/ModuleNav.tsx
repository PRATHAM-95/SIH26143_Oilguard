import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BacktraceIcon,
  CommandIcon,
  CompassIcon,
  RadarIcon,
  RankIcon,
  SoilIcon,
  type IconProps,
} from '@/components/ui/Icon'
import { useSimulationStore } from '@/store/simulationStore'
import { regionFor, useMapStore } from '@/store/mapStore'
import { MODULE_LABEL, useUiStore, type ActiveModule } from '@/store/uiStore'

const MODULES: { id: ActiveModule; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'monitoring', label: MODULE_LABEL.monitoring, icon: CommandIcon },
  { id: 'detection', label: MODULE_LABEL.detection, icon: RadarIcon },
  { id: 'characterization', label: MODULE_LABEL.characterization, icon: SoilIcon },
  { id: 'tracking', label: MODULE_LABEL.tracking, icon: CompassIcon },
  { id: 'attribution', label: MODULE_LABEL.attribution, icon: RankIcon },
  { id: 'investigation', label: MODULE_LABEL.investigation, icon: BacktraceIcon },
]

const MODULE_ROUTE: Record<ActiveModule, string> = {
  monitoring: '/',
  detection: '/',
  characterization: '/',
  tracking: '/',
  attribution: '/attribution',
  investigation: '/investigation',
}

const SPILL_SECTOR = 3

function ActiveIncident() {
  const navigate = useNavigate()
  const spill = useSimulationStore((s) => s.spill)
  if (!spill?.incidentId) {
    return (
      <span className="mi-incident mi-incident--none" title="No active incident">
        <span className="mi-incident-dot" aria-hidden="true" />
        <span className="mi-incident-id">NO ACTIVE INCIDENT</span>
      </span>
    )
  }
  const region = spill.location ? regionFor(spill.location.lat, spill.location.lon) : null
  const shortId = spill.incidentId.slice(0, 18)
  const loc = spill.location
  const clickable = loc != null

  return (
    <button
      type="button"
      className={`mi-incident${clickable ? '' : ' mi-incident--none'}`}
      title={clickable ? 'Active incident — click to centre the map' : 'Active incident'}
      onClick={() => {
        if (!loc) return
        useMapStore
          .getState()
          .requestFit([
            [loc.lon - SPILL_SECTOR, loc.lat - SPILL_SECTOR],
            [loc.lon + SPILL_SECTOR, loc.lat + SPILL_SECTOR],
          ])
        navigate('/')
      }}
    >
      <span className="mi-incident-dot" aria-hidden="true" />
      <span className="mi-incident-id">{shortId}…</span>
      {region ? <span className="mi-incident-region">{region}</span> : null}
    </button>
  )
}

/**
 * Phase 3 module navigation — the amber MII identity card plus the six
 * intelligence modules. It is a *selector*, never a pipeline; modules map to
 * existing routes so users stay inside one working surface.
 */
export function ModuleNav() {
  const navigate = useNavigate()
  const activeModule = useUiStore((s) => s.activeModule)
  const setActiveModule = useUiStore((s) => s.setActiveModule)

  const go = (module: ActiveModule) => {
    setActiveModule(module)
    navigate(MODULE_ROUTE[module])
  }

  return (
    <nav className="module-nav" aria-label="Intelligence modules">
      <button
        type="button"
        className={`mi-card${activeModule === 'monitoring' ? ' mi-card--active' : ''}`}
        onClick={() => go('monitoring')}
        title="Maritime Incident Intelligence — operational overview"
      >
        <span className="mi-card-orbit" aria-hidden="true">
          ◉
        </span>
        <span className="mi-card-meta">
          <span className="mi-card-title">MARITIME INCIDENT INTELLIGENCE</span>
          <span className="mi-card-sub">INDIAN OCEAN REGION</span>
        </span>
      </button>

      <ActiveIncident />

      <span className="mi-divider" aria-hidden="true" />

      <ul className="mi-list">
        {MODULES.map(({ id, label, icon: MIcon }, i) => (
          <li key={id} className={`mi-slot${activeModule === id ? ' mi-slot--active' : ''}`}>
            <button
              type="button"
              className={`mi-item${activeModule === id ? ' mi-item--active' : ''}`}
              onClick={() => go(id)}
              aria-current={activeModule === id ? 'page' : undefined}
            >
              <span className="mi-item-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="mi-item-ico" aria-hidden="true">
                <MIcon size={15} />
              </span>
              <span className="mi-item-label">{label}</span>
            </button>
            {i < MODULES.length - 1 ? <span className="mi-connector" aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>
    </nav>
  )
}