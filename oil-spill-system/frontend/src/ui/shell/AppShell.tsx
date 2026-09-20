import React from 'react'
import { clsx } from 'clsx'

export interface AppShellProps {
  spine?: React.ReactNode
  operationalBar?: React.ReactNode
  children: React.ReactNode
  isTheater?: boolean
}

/**
 * Base Application Shell for the "Instrument at Sea" workstation layout.
 * Provides the spatial grid: Command Spine on the left, Operational Bar on top,
 * and the main viewport (Map Theater or Subpage Workspace).
 */
export function AppShell({ spine, operationalBar, children, isTheater = true }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-abyss text-foam font-sans select-none">
      {/* 1. Left Command Spine Navigation */}
      {spine ? (
        <aside
          className="w-14 shrink-0 border-r border-chartline bg-trench flex flex-col z-30"
          aria-label="Operational Spine"
        >
          {spine}
        </aside>
      ) : null}

      {/* 2. Main Workspace Body */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {operationalBar ? (
          <header className="h-10 shrink-0 border-b border-chartline bg-trench/90 px-3 flex items-center justify-between z-20">
            {operationalBar}
          </header>
        ) : null}

        <main
          className={clsx(
            'flex-1 min-h-0 relative overflow-hidden',
            isTheater ? 'bg-abyss' : 'bg-trench/30 p-4 overflow-auto',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
