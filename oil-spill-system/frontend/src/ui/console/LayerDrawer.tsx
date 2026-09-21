import { useState } from 'react'
import {
  useMapStore,
  MAP_LAYER_CATALOG,
  LAYER_GROUP_ORDER,
  LAYER_GROUP_LABEL,
  MapLayerId,
} from '@/store/mapStore'

export function LayerDrawer() {
  const [open, setOpen] = useState(false)
  const { visibility, toggleLayer } = useMapStore()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 left-4 z-30 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 text-ink-3 hover:text-ink-1 hover:border-ink-3 transition-colors shadow-lg"
        title="Map Layers"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 12 12 17 22 12"></polyline>
          <polyline points="2 17 12 22 22 17"></polyline>
        </svg>
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)] bg-[var(--bg-canvas)]">
        <h3 className="font-semibold text-sm">Map Layers</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-ink-3 hover:text-ink-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div className="overflow-y-auto p-2">
        {LAYER_GROUP_ORDER.map((group) => {
          const layersInGroup = (Object.keys(MAP_LAYER_CATALOG) as MapLayerId[]).filter(
            (id) => MAP_LAYER_CATALOG[id].group === group
          )

          if (layersInGroup.length === 0) return null

          return (
            <div key={group} className="mb-4 last:mb-0">
              <h4 className="text-xs font-semibold text-ink-3 tracking-wider px-2 mb-1">
                {LAYER_GROUP_LABEL[group]}
              </h4>
              <div className="space-y-1">
                {layersInGroup.map((id) => {
                  const meta = MAP_LAYER_CATALOG[id]
                  const isVisible = visibility[id]

                  return (
                    <div 
                      key={id}
                      className="group flex flex-col px-2 py-1.5 rounded hover:bg-[var(--border-default)] transition-colors cursor-pointer"
                      onClick={() => toggleLayer(id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded border border-current"
                            style={{ 
                              backgroundColor: isVisible ? (meta.color || 'white') : 'transparent',
                              borderColor: meta.color || 'white'
                            }}
                          />
                          <span className={`text-sm ${isVisible ? 'text-ink-1' : 'text-ink-3 group-hover:text-ink-1'}`}>
                            {meta.label}
                          </span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={isVisible}
                          readOnly
                          className="pointer-events-none accent-[var(--accent)]"
                        />
                      </div>
                      
                      {meta.emptyNote && !isVisible && (
                        <div className="text-[10px] text-ink-muted mt-1 ml-5">
                          {meta.emptyNote}
                        </div>
                      )}
                      {meta.note && isVisible && (
                        <div className="text-[10px] text-ink-muted mt-1 ml-5">
                          {meta.note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
