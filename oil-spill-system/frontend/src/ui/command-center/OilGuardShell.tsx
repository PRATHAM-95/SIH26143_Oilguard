import { GlobalHeader } from './GlobalHeader'
import { GlobalSidebar } from './GlobalSidebar'
import { ModuleNavigation } from './ModuleNavigation'
import { MapWorkspace } from './MapWorkspace'
import { SystemFooter } from './SystemFooter'
import { AnalysisPanel } from '@/ui/console/AnalysisPanel'
import { SelectionInspectorCard } from '@/ui/console/cards/SelectionInspectorCard'
import { useMapStore } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'
import './command-center.css'

/**
 * OilGuard command center shell.
 *
 * Replaces the `WorkstationShell` composition *for the command center only* —
 * the simulation, investigation, backtracking and attribution pages still
 * render `WorkstationShell` unchanged.
 *
 *   GlobalHeader
 *   └─ GlobalSidebar │ ModuleNavigation
 *                    └─ MapWorkspace │ AnalysisPanel
 *   SystemFooter
 *
 * The right rail mounts the pre-existing `AnalysisPanel` component, which was
 * written for exactly this role (Quick Analysis / Simulation / Vessel Search /
 * Reports, the 2x2 analysis matrix, the live activity feed) but had never been
 * mounted by any route.
 */
export function OilGuardShell() {
  const panelCollapsed = useUiStore((s) => s.panelCollapsed)
  const selection = useMapStore((s) => s.selection)

  return (
    <div className="cc-root" data-panel={panelCollapsed ? 'collapsed' : 'expanded'}>
      <GlobalHeader />

      <div className="cc-body">
        <GlobalSidebar />

        <div className="cc-main">
          <ModuleNavigation />

          <div className="cc-workspace">
            <MapWorkspace />

            <aside className="cc-analysis" aria-label="Analysis and control">
              <AnalysisPanel
                vesselRail={selection ? <SelectionInspectorCard /> : null}
                evidence={null}
              />
            </aside>
          </div>
        </div>
      </div>

      <SystemFooter />
    </div>
  )
}
