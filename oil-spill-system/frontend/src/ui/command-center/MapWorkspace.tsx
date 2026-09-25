import { MaritimeMapTheater } from '@/ui/console/map/MaritimeMapTheater'
import { AoiCard } from './AoiCard'
import { MapToolbar } from './MapToolbar'
import { MapLegend } from './MapLegend'
import { MapControls } from './MapControls'

/**
 * The map-centric workspace.
 *
 * `MaritimeMapTheater` is mounted unconditionally — the map is the centrepiece,
 * not a toggleable tab. Overlay chrome is split into four focused components
 * (AOI card, toolbar, legend, controls) rather than one monolith, and every
 * one of them reads the existing `mapStore` / `uiStore`; no domain state is
 * duplicated here.
 *
 * Overlay placement is collision-checked against the chrome the theater
 * already ships: the toolbar owns the top strip, the AOI card the top-left
 * corner, the legend the bottom-left stack beneath the compass and scale bar,
 * and the controls the right edge above MapLibre's navigation control.
 */
export function MapWorkspace() {
  return (
    <div className="cc-map" role="region" aria-label="Maritime intelligence map">
      <MaritimeMapTheater showToolbar={false} />

      <AoiCard />
      <MapToolbar />
      <MapLegend />
      <MapControls />
    </div>
  )
}
