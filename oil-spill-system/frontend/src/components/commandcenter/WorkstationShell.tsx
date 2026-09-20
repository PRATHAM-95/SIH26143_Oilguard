import type { ReactNode } from 'react'
import { FlightpathRail } from './FlightpathRail'
import { OperationalHUD } from './OperationalHUD'
import { ContextualConsole } from './ContextualConsole'
import type { MapLayerId } from '@/store/mapStore'

export function WorkstationShell({
  map,
  availableLayers,
}: {
  map: ReactNode
  availableLayers: MapLayerId[]
}) {
  return (
    <div className="workstation-theater" role="main" aria-label="Maritime Intelligence Geospatial Workstation">
      {/* 1. Primary Full-Bleed Geospatial Map Canvas */}
      <div className="theater-map-canvas" aria-hidden="false">
        {map}
      </div>

      {/* 2. Left-Anchored Vertical Forensic Flightpath */}
      <FlightpathRail />

      {/* 3. Floating Mission Command HUD (Top-Center with Integrated GIS Layers) */}
      <div className="theater-top-hud">
        <OperationalHUD availableLayers={availableLayers} />
      </div>

      {/* 4. Adaptive Contextual Intelligence Console (Right) */}
      <ContextualConsole />

      {/* 5. Tactical Frame Crosshairs */}
      <div className="theater-reticle theater-reticle--tl" aria-hidden="true" />
      <div className="theater-reticle theater-reticle--tr" aria-hidden="true" />
      <div className="theater-reticle theater-reticle--bl" aria-hidden="true" />
      <div className="theater-reticle theater-reticle--br" aria-hidden="true" />
    </div>
  )
}
