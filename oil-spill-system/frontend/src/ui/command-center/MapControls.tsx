import { REGION_BY_ID, useMapStore } from '@/store/mapStore'

/**
 * Right-hand map control cluster.
 *
 * Deliberately does NOT duplicate MapLibre's `NavigationControl`, which is
 * already mounted bottom-right and owns real zoom/compass interaction. These
 * are the workspace-level camera actions that the map store can genuinely
 * perform — the existing `requestFit` path calls `map.fitBounds` directly,
 * which is why "fit" works here while a store-only zoom would not.
 */
export function MapControls() {
  const requestFit = useMapStore((s) => s.requestFit)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const hasSelection = useMapStore((s) => s.selection != null)

  return (
    <div className="cc-mapctl" role="group" aria-label="Map controls">
      <button
        type="button"
        className="cc-mapctl-btn"
        title="Recentre on the Indian Ocean operating region"
        onClick={() => requestFit(REGION_BY_ID.io.bounds)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>

      <button
        type="button"
        className="cc-mapctl-btn"
        title={hasSelection ? 'Clear the selected object' : 'Nothing selected'}
        disabled={!hasSelection}
        onClick={clearSelection}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
