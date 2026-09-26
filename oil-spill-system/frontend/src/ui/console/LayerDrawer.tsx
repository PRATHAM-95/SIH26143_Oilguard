import { useEffect } from 'react'
import {
  useMapStore,
  MAP_LAYER_CATALOG,
  LAYER_GROUP_ORDER,
  LAYER_GROUP_LABEL,
  OPERATIONAL_LAYER_IDS,
  MapLayerId,
} from '@/store/mapStore'

/**
 * Full catalogue drawer: all catalogue layers grouped by the store's
 * LAYER_GROUP_ORDER. Opened from the toolbar's single Layers trigger; open
 * state lives in MaritimeMapTheater. Rows are real buttons (aria-pressed);
 * no-data layers are disabled, honouring the availability set without
 * changing toggleLayer semantics. Escape closes the drawer.
 */
export function LayerDrawer({
  open,
  onClose,
  available,
  className = '',
}: {
  open: boolean
  onClose: () => void
  available: Set<MapLayerId> | null
  /** Extra hook classes so a host shell can reposition the drawer. */
  className?: string
}) {
  const visibility = useMapStore((s) => s.visibility)
  const toggleLayer = useMapStore((s) => s.toggleLayer)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const hasData = (id: MapLayerId) => available == null || available.has(id)

  return (
    <div
      id="cc-layers-panel"
      className={`absolute bottom-4 left-4 z-30 w-80 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-2xl flex flex-col max-h-[70vh] ${className}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)] bg-[var(--bg-canvas)]">
        <h3 className="font-semibold text-sm">Map Layers</h3>
        <button
          onClick={onClose}
          aria-label="Close the layer catalogue"
          className="text-ink-3 hover:text-ink-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto p-2" role="group" aria-label="Layer catalogue">
        {LAYER_GROUP_ORDER.map((group) => {
          // Only the operational layers, so the drawer lists the same set the
          // toolbar row and the legend describe. See OPERATIONAL_LAYER_IDS for
          // what that leaves out and why each exclusion is still reachable.
          const layersInGroup = OPERATIONAL_LAYER_IDS.filter(
            (id) => MAP_LAYER_CATALOG[id].group === group,
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
                  const isAvailable = hasData(id)

                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!isAvailable}
                      aria-pressed={isAvailable ? isVisible : undefined}
                      onClick={() => toggleLayer(id)}
                      // The note moves to the tooltip rather than a second line
                      // under every row. It was doubling the height of the list
                      // to repeat text the toolbar pill already carries, and the
                      // reason a layer exists is wanted once, not on every visit.
                      title={isAvailable ? (meta.note ?? meta.label) : (meta.emptyNote ?? 'Not available in this session')}
                      className="group w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--border-default)] disabled:hover:bg-transparent"
                    >
                      <span className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded border border-current"
                          style={{
                            backgroundColor: isVisible ? meta.color || 'white' : 'transparent',
                            borderColor: meta.color || 'white',
                          }}
                          aria-hidden="true"
                        />
                        <span className={`text-sm ${isVisible ? 'text-ink-1' : 'text-ink-3 group-hover:text-ink-1'}`}>
                          {meta.label}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono text-ink-3">
                        {isAvailable ? (isVisible ? 'on' : 'off') : 'no data'}
                      </span>
                    </button>
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