import type { CSSProperties, ReactNode } from 'react'

export type WorkspaceLayout = 'map-first' | 'document' | 'split'

/**
 * Unified maritime workspace shell shared by every operational page:
 *
 *   ┌────────────────────────── toolbar (title / controls) ────────────────┐
 *   │  map stage                           │  right intelligence rail       │
 *   │  (MapView + furniture + overlays)    │  (intel / details / channels)  │
 *   ├── dock (timeline / captain dock) ────┤                                │
 *   └──────────────────────────────────────┴────────────────────────────────┘
 *
 * The map is dominant; the rail provides contextual intelligence without
 * occluding navigational data.
 */
export function MissionWorkspace({
  toolbar,
  map,
  dock,
  rail,
  banner,
  layout = 'map-first',
  className,
  style,
}: {
  toolbar?: ReactNode
  map: ReactNode
  dock?: ReactNode
  rail?: ReactNode
  banner?: ReactNode
  layout?: WorkspaceLayout
  className?: string
  style?: CSSProperties
}) {
  const isDoc = layout === 'document'

  return (
    <div
      className={`workspace ${isDoc ? 'workspace--doc' : ''} ${className ?? ''}`.trim()}
      style={style}
    >
      {banner ? <div className="workspace-banner">{banner}</div> : null}
      {toolbar ? <header className="workspace-toolbar">{toolbar}</header> : null}
      <div className="workspace-body">
        <div className={`workspace-map ${isDoc ? 'workspace-map--doc' : ''}`}>
          {map}
          {dock ?? null}
        </div>
        {rail ? <aside className="workspace-rail rail-stack">{rail}</aside> : null}
      </div>
    </div>
  )
}