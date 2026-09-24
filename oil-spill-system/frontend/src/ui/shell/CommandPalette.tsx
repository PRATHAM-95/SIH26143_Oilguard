import { Command } from 'cmdk'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMapStore, MAP_LAYER_CATALOG } from '@/store/mapStore'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { visibility, toggleLayer } = useMapStore()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-2xl overflow-hidden text-ink-1 z-[100]"
    >
      <Command.Input 
        placeholder="Type a command or search..." 
        className="w-full px-4 py-3 bg-transparent border-b border-[var(--border-default)] outline-none text-ink-1 placeholder:text-ink-3 font-mono text-sm"
      />
      <Command.List className="max-h-[300px] overflow-y-auto p-2">
        <Command.Empty className="p-4 text-center text-ink-3">No results found.</Command.Empty>
        
        <Command.Group heading="Navigation" className="px-2 py-1 text-xs font-semibold text-ink-3 tracking-wider">
          <Command.Item
            onSelect={() => { navigate('/command-center'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Command Center
          </Command.Item>
          <Command.Item
            onSelect={() => { navigate('/report'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Final Report
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Stage Jump" className="px-2 py-1 text-xs font-semibold text-ink-3 tracking-wider mt-2">
          <Command.Item
            onSelect={() => { navigate('/simulation'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Stage: Simulation
          </Command.Item>
          <Command.Item
            onSelect={() => { navigate('/investigation'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Stage: Investigation
          </Command.Item>
          <Command.Item
            onSelect={() => { navigate('/backtracking'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Stage: Backtracking
          </Command.Item>
          <Command.Item
            onSelect={() => { navigate('/attribution'); setOpen(false) }}
            className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center outline-none"
          >
            Stage: Attribution
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Map Layers" className="px-2 py-1 text-xs font-semibold text-ink-3 tracking-wider mt-2">
          {(Object.keys(MAP_LAYER_CATALOG) as Array<keyof typeof MAP_LAYER_CATALOG>).map((layerId) => {
            const layer = MAP_LAYER_CATALOG[layerId]
            const isVisible = visibility[layerId]
            return (
              <Command.Item 
                key={layerId} 
                onSelect={() => { toggleLayer(layerId); setOpen(false) }}
                className="px-2 py-2 rounded hover:bg-[var(--border-default)] cursor-pointer text-sm aria-selected:bg-[var(--border-default)] aria-selected:ring-1 aria-selected:ring-signal-blue/50 active:scale-[0.97] transition-all duration-100 ease-out flex items-center justify-between outline-none"
              >
                <span>{layer.label}</span>
                <span className="text-xs text-ink-3">{isVisible ? 'Visible' : 'Hidden'}</span>
              </Command.Item>
            )
          })}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
