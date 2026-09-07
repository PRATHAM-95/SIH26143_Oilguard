import type { ReactNode } from 'react'

/**
 * Unified map-first workspace shell shared by every operational page:
 *
 *   ┌────────────────────────── toolbar (title / controls) ────────────────┐
 *   │  map pane                            │  right intelligence rail       │
 *   │  (MapView + furniture + layers)      │  (intel / details / channels)  │
 *   ├── dock (timeline / captain dock) ────┤                                │
 *   └──────────────────────────────────────┴────────────────────────────────┘
 *
 * The map is dominant; the rail switches between an intelligence panel when
 * an object is selected and the mission overview otherwise.
 */
export function MissionWorkspace({
  toolbar,
  map,
  dock,
  rail,
}: {
  toolbar?: ReactNode
  map: ReactNode
  dock?: ReactNode
  rail: ReactNode
}) {
  return (
    <div className="workspace">
      {toolbar ? <div className="workspace-toolbar">{toolbar}</div> : null}
      <div className="workspace-body">
        <div className="workspace-map">
          {map}
          {dock ?? null}
        </div>
        <aside className="workspace-rail rail-stack">{rail}</aside>
      </div>
    </div>
  )
}