import { ReactNode, useEffect } from 'react'
import { OperationalBar } from './OperationalBar'
import { CommandPalette } from './CommandPalette'
export function WorkstationShell({
  children,
  leftPanel,
  rightPanel,
  leftCollapsed,
  rightCollapsed,
  setLeftCollapsed,
  setRightCollapsed
}: {
  children: ReactNode
  leftPanel: ReactNode
  rightPanel: ReactNode
  leftCollapsed: boolean
  rightCollapsed: boolean
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
}) {
  // Handle responsive layout based on window width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1440 && window.innerWidth >= 1024) {
        setLeftCollapsed(true)
        setRightCollapsed(false)
      } else if (window.innerWidth < 1024) {
        setLeftCollapsed(true)
        setRightCollapsed(true)
      } else {
        setLeftCollapsed(false)
        setRightCollapsed(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [setLeftCollapsed, setRightCollapsed])

  // Map CSS variables
  const leftWidth = leftCollapsed ? 56 : 260
  const rightWidth = rightCollapsed ? 0 : 360

  return (
    <div 
      className="flex flex-col overflow-hidden bg-[var(--bg-canvas)] text-ink-1 font-sans workstation-theater"
      style={{
        '--panel-left-width': `${leftWidth}px`,
        '--panel-right-width': `${rightWidth}px`,
        '--console-dock-width': `${rightWidth}px` // Bridging with index.css legacy variable
      } as React.CSSProperties}
    >
      <CommandPalette />
      <OperationalBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Rail (Flightpath) */}
        <aside 
          className="h-full border-r border-[var(--border-default)] bg-[var(--bg-canvas)] transition-all duration-200 z-20 flex-shrink-0"
          style={{ width: 'var(--panel-left-width)' }}
        >
          {leftPanel}
        </aside>

        {/* Center Workspace (Map) */}
        <div className="flex-1 relative overflow-hidden bg-[var(--bg-canvas)]" role="region" aria-label="Geospatial Map Viewport">
          {children}
        </div>

        {/* Right Panel (Contextual Console) */}
        <aside 
          className={`h-full border-l border-[var(--border-default)] bg-[var(--bg-canvas)] transition-all duration-200 z-20 flex-shrink-0 ${rightCollapsed ? 'contextual-console--collapsed' : ''}`}
          style={{ width: 'var(--panel-right-width)' }}
        >
          {rightPanel}
        </aside>
      </div>
    </div>
  )
}
